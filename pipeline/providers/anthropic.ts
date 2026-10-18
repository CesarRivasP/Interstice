import Anthropic from '@anthropic-ai/sdk';
import { withBackoff } from './backoff.js';
import { emptyUsage, ProviderError, type DescriptionProvider, type VisionRequest } from './types.js';

/**
 * The latest Sonnet the installed SDK's `Model` type names (0.135.0). Overridden
 * by ANTHROPIC_MODEL_ID; the pipeline writes whichever ran into the track's
 * `model_id`, so a track always says what produced it.
 */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5-5';

export class AnthropicProvider implements DescriptionProvider {
  readonly id = 'anthropic' as const;
  readonly modelId: string;
  readonly usage = emptyUsage();
  private readonly client: Anthropic;
  private readonly sleep: ((ms: number) => Promise<void>) | undefined;

  constructor(opts: {
    modelId?: string;
    /** ANTHROPIC_API_KEY when omitted — the SDK reads it itself */
    apiKey?: string;
    client?: Anthropic;
    sleep?: (ms: number) => Promise<void>;
  } = {}) {
    this.modelId = opts.modelId ?? DEFAULT_ANTHROPIC_MODEL;
    // maxRetries 0: the pipeline owns the backoff (limits.bedrock.on_throttle
    // applies to both providers) so attempts are counted in one place.
    this.client =
      opts.client ??
      new Anthropic({ ...(opts.apiKey ? { apiKey: opts.apiKey } : {}), maxRetries: 0 });
    this.sleep = opts.sleep;
  }

  async describe(req: VisionRequest): Promise<string> {
    const content: Anthropic.ContentBlockParam[] = [
      ...req.images.map(
        (bytes): Anthropic.ImageBlockParam => ({
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: bytes.toString('base64') },
        }),
      ),
      { type: 'text', text: req.text },
    ];

    return withBackoff(
      async () => {
        let res: Anthropic.Message;
        try {
          res = await this.client.messages.create({
            model: this.modelId,
            max_tokens: req.maxTokens,
            messages: [{ role: 'user', content }],
          });
        } catch (err) {
          const retryable =
            err instanceof Anthropic.RateLimitError ||
            err instanceof Anthropic.InternalServerError ||
            err instanceof Anthropic.APIConnectionError ||
            (err instanceof Anthropic.APIError && err.status === 529);
          if (retryable) {
            throw new ProviderError(`Anthropic transient: ${(err as Error).message}`, {
              retryable: true,
              code: 'throttled',
              cause: err,
            });
          }
          throw err;
        }

        this.usage.calls += 1;
        this.usage.input_tokens += res.usage.input_tokens;
        this.usage.output_tokens += res.usage.output_tokens;

        // A refusal is HTTP 200 with no usable text. Returned empty so the
        // shape validator rejects it and the cue is written `failed`, exactly
        // as an over-budget answer would be — never as a hand-written cue (AC7).
        if (res.stop_reason === 'refusal') {
          console.log(
            `INTERSTICE.describe.refusal category=${res.stop_details?.category ?? 'null'}`,
          );
          return '';
        }

        return res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
      },
      {
        label: 'anthropic',
        isRetryable: (e) => e instanceof ProviderError && e.retryable,
        ...(this.sleep ? { sleep: this.sleep } : {}),
      },
    );
  }
}
