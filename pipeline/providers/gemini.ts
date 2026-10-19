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
  readonly usage = emptyUsage();
  /** GEMINI_MODEL_ID, comma-separated: tried in order, see describe() */
  readonly models: string[];
  /** per-model answer counts, so the track can say exactly what wrote it */
  readonly answeredBy = new Map<string, number>();
  private readonly exhausted = new Set<string>();
  private current = 0;
  private readonly minIntervalMs: number;
  private lastCallAt = 0;
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;
  private readonly sleep: ((ms: number) => Promise<void>) | undefined;

  constructor(opts: { apiKey: string; modelId?: string; fetch?: FetchLike; sleep?: (ms: number) => Promise<void>; minIntervalMs?: number }) {
    this.apiKey = opts.apiKey;
    // GEMINI_MIN_INTERVAL_MS: the free tier also limits requests per minute, and
    // a 429 answered to a burst is a request the daily quota may still count.
    this.minIntervalMs = opts.minIntervalMs ?? 0;
    this.models = (opts.modelId ?? DEFAULT_GEMINI_MODEL)
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
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

  /**
   * What `contracts.description_track.model_id` records: every model that
   * answered, joined with `+`, in the order configured; the configured first
   * model before any has answered.
   */
  get modelId(): string {
    const used = this.models.filter((m) => this.answeredBy.has(m));
    return used.length ? used.join('+') : this.models[0]!;
  }

  /**
   * The free tier allows 20 requests per model per day (measured 2026-10-18),
   * and a full standard-level run is 56. With a LIST in GEMINI_MODEL_ID, a model
   * whose daily quota is gone is dropped for the rest of the run, and one still
   * overloaded after its five backoff attempts (503) is skipped for this cue;
   * either way the next model answers. Only when every model has failed the
   * cue does the error reach describe.ts.
   */
  async describe(req: VisionRequest): Promise<string> {
    let lastError: unknown;
    for (let tried = 0; tried < this.models.length; tried++) {
      const model = this.models[this.current]!;
      if (this.exhausted.has(model)) {
        this.current = (this.current + 1) % this.models.length;
        continue;
      }
      try {
        const out = await this.describeWith(model, req);
        this.answeredBy.set(model, (this.answeredBy.get(model) ?? 0) + 1);
        return out;
      } catch (err) {
        lastError = err;
        if (!(err instanceof ProviderError)) throw err;
        if (err.code === 'quota_exhausted') this.exhausted.add(model);
        else if (!err.retryable) throw err;
        if (this.models.length > 1) {
          console.log(`INTERSTICE.describe.rotate provider=gemini from=${model} reason=${err.code}`);
        }
        this.current = (this.current + 1) % this.models.length;
      }
    }
    throw lastError;
  }

  private async describeWith(model: string, req: VisionRequest): Promise<string> {
    const url = `${GEMINI_ENDPOINT}/models/${model}:generateContent`;
    return withBackoff(
      async () => {
        const wait = this.lastCallAt + this.minIntervalMs - Date.now();
        if (wait > 0) await (this.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms))))(wait);
        this.lastCallAt = Date.now();
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

        if (res.status === 429) {
          // A per-day quota (the free tier: 20 requests per model per day,
          // measured 2026-10-18) answers 429 with a retryDelay of hours.
          // Backing that off five times is 15 s spent on a certain failure, so
          // a long delay is fatal and says why.
          const text = await res.text().catch(() => '');
          const delay = Number(/"retryDelay":\s*"(\d+)s"/.exec(text)?.[1] ?? 0);
          if (delay > 60) {
            throw new ProviderError(
              `Gemini quota exhausted (retry in ${Math.round(delay / 3600)} h): ` +
                `${/"quotaId":\s*"([^"]+)"/.exec(text)?.[1] ?? 'unknown quota'} — ` +
                'enable billing on the key\'s Google project or set GEMINI_MODEL_ID to another model',
              { retryable: false, code: 'quota_exhausted' },
            );
          }
          throw new ProviderError('Gemini transient HTTP 429', { retryable: true, code: 'throttled' });
        }
        if (res.status === 503 || res.status === 500) {
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
        // With a model list, an overloaded model is skipped at once for the next
        // one rather than backed off five times — every retry is a request.
        ...(this.models.length > 1 ? { maxAttempts: 1 } : {}),
        isRetryable: (e) => e instanceof ProviderError && e.retryable,
        ...(this.sleep ? { sleep: this.sleep } : {}),
      },
    );
  }
}
