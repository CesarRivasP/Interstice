import { withBackoff } from './backoff.js';
import { emptyUsage, ProviderError, type DescriptionProvider, type VisionRequest } from './types.js';

/**
 * Google Gemini through the public `generateContent` REST endpoint — no SDK,
 * Node's own `fetch`. Added 2026-10-18 as the third real implementation of the
 * seam: `defects[D4]` keeps Bedrock closed, and this was the key the owner had.
 * Overridden by GEMINI_MODEL_ID; the pipeline writes whichever ran into the
 * track's `model_id`, so a track always says what produced it. Measured
 * 2026-10-18: `gemini-2.5-flash` answers 404 "no longer available to new
 * users" and names 3.8 Flash as the replacement, hence the default.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta';

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

export class GeminiProvider implements DescriptionProvider {
  readonly id = 'gemini' as const;
  readonly modelId: string;
  readonly usage = emptyUsage();
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;
  private readonly sleep: ((ms: number) => Promise<void>) | undefined;

  constructor(opts: { apiKey: string; modelId?: string; fetch?: FetchLike; sleep?: (ms: number) => Promise<void> }) {
    this.apiKey = opts.apiKey;
    this.modelId = opts.modelId ?? DEFAULT_GEMINI_MODEL;
    this.fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init));
    this.sleep = opts.sleep;
  }

  /** the request body, exported for the test that pins frames-before-text */
  body(req: VisionRequest): unknown {
    return {
      contents: [
        {
          role: 'user',
          parts: [
            ...req.images.map((bytes) => ({
              inline_data: { mime_type: 'image/jpeg', data: bytes.toString('base64') },
            })),
            { text: req.text },
          ],
        },
      ],
      // Gemini 3.x models think by default and the thoughts are billed against
      // maxOutputTokens: measured 2026-10-18 on gemini-3.7-flash, 57 of 60 tokens
      // went to thoughtsTokenCount and the answer came back empty (MAX_TOKENS).
      // The cue budget is a few dozen tokens, so thinking is off; the JSON mime
      // type keeps fences and prose out of the answer the validator parses.
      generationConfig: {
        maxOutputTokens: req.maxTokens,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'application/json',
      },
    };
  }

  async describe(req: VisionRequest): Promise<string> {
    const url = `${GEMINI_ENDPOINT}/models/${this.modelId}:generateContent`;
    return withBackoff(
      async () => {
        let res: Response;
        try {
          res = await this.fetchImpl(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
            body: JSON.stringify(this.body(req)),
          });
        } catch (err) {
          throw new ProviderError(`Gemini connection: ${(err as Error).message}`, {
            retryable: true,
            code: 'throttled',
            cause: err,
          });
        }

        if (res.status === 429 || res.status === 503 || res.status === 500) {
          throw new ProviderError(`Gemini transient HTTP ${res.status}`, {
            retryable: true,
            code: 'throttled',
          });
        }
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new ProviderError(`Gemini HTTP ${res.status}: ${text.slice(0, 300)}`, {
            retryable: false,
            code: `http_${res.status}`,
          });
        }

        const data = (await res.json()) as GeminiResponse;
        this.usage.calls += 1;
        this.usage.input_tokens += data.usageMetadata?.promptTokenCount ?? 0;
        this.usage.output_tokens += data.usageMetadata?.candidatesTokenCount ?? 0;

        // A safety block is HTTP 200 with no candidate text. Returned empty so the
        // shape validator rejects it and the cue is written `failed` — never a
        // hand-written cue (AC7). Same contract as the Anthropic refusal.
        const cand = data.candidates?.[0];
        const text = cand?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
        if (!text) {
          console.log(
            `INTERSTICE.describe.refusal provider=gemini reason=${
              data.promptFeedback?.blockReason ?? cand?.finishReason ?? 'null'
            }`,
          );
          return '';
        }
        return text;
      },
      {
        label: 'gemini',
        isRetryable: (e) => e instanceof ProviderError && e.retryable,
        ...(this.sleep ? { sleep: this.sleep } : {}),
      },
    );
  }
}
