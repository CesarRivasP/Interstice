/**
 * The seam `alternatives[A5]` promised: `changes[C9]` is one function behind one
 * call — up to `limits.ad.frames_per_gap_max` JPEG frames plus text in, one
 * string out — so the vision provider is swappable without touching C7, C8,
 * C10 or anything under `src/`. `defects[D4]` is why there are two real
 * implementations rather than one.
 */

export interface VisionRequest {
  /** JPEG frames in time order. Empty when the dry run has no asset to read. */
  images: Buffer[];
  text: string;
  maxTokens: number;
}

export interface ProviderUsage {
  calls: number;
  input_tokens: number;
  output_tokens: number;
}

export interface DescriptionProvider {
  readonly id: 'bedrock' | 'anthropic' | 'gemini' | 'ollama' | 'fake';
  /** what `contracts.description_track.model_id` records */
  readonly modelId: string;
  /** running totals, so a run can state what it cost */
  readonly usage: ProviderUsage;
  describe(req: VisionRequest): Promise<string>;
}

/**
 * A provider failure the pipeline can reason about. `retryable` is the whole
 * contract of `limits.bedrock.on_throttle`: a throttle is backed off, anything
 * else is surfaced on the first attempt.
 */
export class ProviderError extends Error {
  readonly retryable: boolean;
  readonly code: string;

  constructor(message: string, opts: { retryable: boolean; code: string; cause?: unknown }) {
    super(message, { cause: opts.cause });
    this.name = 'ProviderError';
    this.retryable = opts.retryable;
    this.code = opts.code;
  }
}

export function emptyUsage(): ProviderUsage {
  return { calls: 0, input_tokens: 0, output_tokens: 0 };
}
