import { withBackoff } from './backoff.js';
import { emptyUsage, ProviderError, type DescriptionProvider, type VisionRequest } from './types.js';

/**
 * A local vision model served by Ollama (`ollama serve`, `/api/chat`). Added
 * 2026-10-19: no quota and no cost, for when every hosted provider is closed —
 * Bedrock by `defects[D4]`, Gemini's free tier by 20 requests per model per day.
 * OLLAMA_MODEL_ID (default qwen2.5vl:7b), OLLAMA_HOST (default localhost:11434).
 */
export const DEFAULT_OLLAMA_MODEL = 'qwen2.5vl:7b';
export const DEFAULT_OLLAMA_HOST = 'http://127.0.0.1:11434';

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

interface OllamaChatResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
  done_reason?: string;
}

export class OllamaProvider implements DescriptionProvider {
  readonly id = 'ollama' as const;
  readonly modelId: string;
  readonly usage = emptyUsage();
  private readonly host: string;
  private readonly fetchImpl: FetchLike;
  private readonly sleep: ((ms: number) => Promise<void>) | undefined;

  constructor(opts: { modelId?: string; host?: string; fetch?: FetchLike; sleep?: (ms: number) => Promise<void> } = {}) {
    this.modelId = opts.modelId ?? DEFAULT_OLLAMA_MODEL;
    this.host = (opts.host ?? DEFAULT_OLLAMA_HOST).replace(/\/$/, '');
    this.fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init));
    this.sleep = opts.sleep;
  }

  body(req: VisionRequest): unknown {
    return {
      model: this.modelId,
      stream: false,
      format: 'json',
      options: { num_predict: req.maxTokens, temperature: 0.2 },
      messages: [
        { role: 'user', content: req.text, images: req.images.map((b) => b.toString('base64')) },
      ],
    };
  }

  async describe(req: VisionRequest): Promise<string> {
    return withBackoff(
      async () => {
        let res: Response;
        try {
          res = await this.fetchImpl(`${this.host}/api/chat`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(this.body(req)),
          });
        } catch (err) {
          // Not retried: a server that is not running will not start by waiting.
          throw new ProviderError(`Ollama unreachable at ${this.host} — run \`ollama serve\``, {
            retryable: false,
            code: 'unreachable',
            cause: err,
          });
        }
        if (res.status === 503) {
          throw new ProviderError('Ollama busy (503)', { retryable: true, code: 'throttled' });
        }
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new ProviderError(`Ollama HTTP ${res.status}: ${text.slice(0, 300)}`, {
            retryable: false,
            code: `http_${res.status}`,
          });
        }
        const data = (await res.json()) as OllamaChatResponse;
        this.usage.calls += 1;
        this.usage.input_tokens += data.prompt_eval_count ?? 0;
        this.usage.output_tokens += data.eval_count ?? 0;
        return data.message?.content ?? '';
      },
      {
        label: 'ollama',
        isRetryable: (e) => e instanceof ProviderError && e.retryable,
        ...(this.sleep ? { sleep: this.sleep } : {}),
      },
    );
  }
}
