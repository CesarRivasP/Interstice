import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import { withBackoff } from './backoff.js';
import { emptyUsage, ProviderError, type DescriptionProvider, type VisionRequest } from './types.js';

/** `endpoints.bedrock_invoke` — the Converse API, which takes image blocks natively. */
export const DEFAULT_BEDROCK_MODEL = 'amazon.nova-pro-v1:0';

/**
 * `defects[D4]`. The account-level refusal is a ValidationException whose
 * message carries "Error 002". It is not a throttle and not a permission; no
 * number of retries changes it, so it is surfaced once, naming the way round.
 */
export const BEDROCK_BLOCKED_HINT =
  'Bedrock refused at the account level (defects[D4], "Error 002"). ' +
  'Set DESCRIPTION_PROVIDER=anthropic and ANTHROPIC_API_KEY to run C9 on the ' +
  'Anthropic Messages API instead; the pipeline does not switch providers on its own.';

interface SendsConverse {
  send(cmd: ConverseCommand): Promise<ConverseCommandOutput>;
}

function nameOf(err: unknown): string {
  return (err as { name?: string })?.name ?? '';
}

function messageOf(err: unknown): string {
  return (err as { message?: string })?.message ?? '';
}

export function isAccountBlocked(err: unknown): boolean {
  return nameOf(err) === 'ValidationException' && /Error 002/.test(messageOf(err));
}

export function isThrottle(err: unknown): boolean {
  return [
    'ThrottlingException',
    'TooManyRequestsException',
    'ServiceUnavailableException',
    'ModelNotReadyException',
  ].includes(nameOf(err));
}

export class BedrockConverseProvider implements DescriptionProvider {
  readonly id = 'bedrock' as const;
  readonly modelId: string;
  readonly usage = emptyUsage();
  private readonly client: SendsConverse;
  private readonly sleep: ((ms: number) => Promise<void>) | undefined;

  constructor(opts: {
    modelId?: string;
    region?: string;
    /** injected so the mapping of Bedrock's errors is testable without an account */
    client?: SendsConverse;
    sleep?: (ms: number) => Promise<void>;
  } = {}) {
    this.modelId = opts.modelId ?? DEFAULT_BEDROCK_MODEL;
    this.client = opts.client ?? new BedrockRuntimeClient({ region: opts.region });
    this.sleep = opts.sleep;
  }

  async describe(req: VisionRequest): Promise<string> {
    const content: ContentBlock[] = [
      ...req.images.map(
        (bytes): ContentBlock => ({
          image: { format: 'jpeg', source: { bytes: new Uint8Array(bytes) } },
        }),
      ),
      { text: req.text },
    ];

    return withBackoff(
      async () => {
        let res: ConverseCommandOutput;
        try {
          res = await this.client.send(
            new ConverseCommand({
              modelId: this.modelId,
              messages: [{ role: 'user', content }],
              inferenceConfig: { maxTokens: req.maxTokens, temperature: 0.2 },
            }),
          );
        } catch (err) {
          if (isAccountBlocked(err)) {
            throw new ProviderError(`${messageOf(err)} — ${BEDROCK_BLOCKED_HINT}`, {
              retryable: false,
              code: 'bedrock_account_blocked',
              cause: err,
            });
          }
          if (isThrottle(err)) {
            throw new ProviderError(`Bedrock throttled: ${nameOf(err)}`, {
              retryable: true,
              code: 'throttled',
              cause: err,
            });
          }
          throw err;
        }

        this.usage.calls += 1;
        this.usage.input_tokens += res.usage?.inputTokens ?? 0;
        this.usage.output_tokens += res.usage?.outputTokens ?? 0;

        const blocks = res.output?.message?.content ?? [];
        return blocks.map((b) => ('text' in b && b.text ? b.text : '')).join('');
      },
      {
        label: 'bedrock',
        isRetryable: (e) => e instanceof ProviderError && e.retryable,
        ...(this.sleep ? { sleep: this.sleep } : {}),
      },
    );
  }
}
