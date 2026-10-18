import { describe, expect, it } from 'vitest';
import { MAX_ATTEMPTS } from '../budget.js';
import {
  AnthropicProvider,
  BEDROCK_BLOCKED_HINT,
  BedrockConverseProvider,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_BEDROCK_MODEL,
  FakeProvider,
  ProviderError,
  isAccountBlocked,
  isThrottle,
  selectProvider,
  waitMsFor,
  withBackoff,
  wordsOf,
} from '../providers/index.js';

/**
 * The provider seam of `changes[C9]` (`alternatives[A5]`). Bedrock's own
 * errors are reproduced by a fake `send`, because `defects[D4]` means no test
 * here can reach the real service — and the mapping is what matters: the
 * account refusal must be fatal and the throttle must be retried.
 */

const noSleep = async () => {};

const awsError = (name: string, message = name) => Object.assign(new Error(message), { name });

describe('withBackoff — limits.bedrock.on_throttle', () => {
  it('gives up after MAX_ATTEMPTS retryable failures, sleeping between them', async () => {
    const waits: number[] = [];
    let calls = 0;
    await expect(
      withBackoff(
        async () => { calls++; throw new ProviderError('t', { retryable: true, code: 'throttled' }); },
        { isRetryable: (e) => e instanceof ProviderError && e.retryable, sleep: async (ms) => { waits.push(ms); } },
      ),
    ).rejects.toThrow('t');
    expect(MAX_ATTEMPTS).toBe(5);
    expect(calls).toBe(5);
    expect(waits).toEqual([1000, 2000, 4000, 8000]); // exponential, 4 sleeps for 5 attempts
    expect(waitMsFor(3)).toBe(4000);
  });

  it('returns the first success and sleeps only for the failures before it', async () => {
    const waits: number[] = [];
    let calls = 0;
    const out = await withBackoff(
      async () => { calls++; if (calls < 3) throw new ProviderError('t', { retryable: true, code: 'throttled' }); return 'ok'; },
      { isRetryable: (e) => e instanceof ProviderError && e.retryable, sleep: async (ms) => { waits.push(ms); } },
    );
    expect(out).toBe('ok');
    expect(waits).toEqual([1000, 2000]);
  });

  // Fails if: a non-retryable error is backed off. The account-level refusal
  // would then cost 15 seconds of sleep before the same refusal.
  it('throws a non-retryable error on the first attempt without sleeping', async () => {
    let calls = 0;
    const waits: number[] = [];
    await expect(
      withBackoff(
        async () => { calls++; throw new Error('fatal'); },
        { isRetryable: () => false, sleep: async (ms) => { waits.push(ms); } },
      ),
    ).rejects.toThrow('fatal');
    expect(calls).toBe(1);
    expect(waits).toEqual([]);
  });
});

describe('BedrockConverseProvider — defects[D4] and the throttle', () => {
  const blocked = awsError(
    'ValidationException',
    'Error 002: Access to Bedrock models is not allowed for this account',
  );

  it('recognises the account-level refusal and the throttles by name', () => {
    expect(isAccountBlocked(blocked)).toBe(true);
    expect(isAccountBlocked(awsError('ValidationException', 'malformed input'))).toBe(false);
    expect(isThrottle(awsError('ThrottlingException'))).toBe(true);
    expect(isThrottle(awsError('TooManyRequestsException'))).toBe(true);
    expect(isThrottle(awsError('AccessDeniedException'))).toBe(false);
  });

  // Fails if: Error 002 is retried, swallowed, or answered by silently
  // switching provider. The message must name the fallback env var and the
  // run must stop on the first cue.
  it('fails fast on Error 002 with a message naming DESCRIPTION_PROVIDER and ANTHROPIC_API_KEY', async () => {
    let sends = 0;
    const p = new BedrockConverseProvider({
      client: { send: async () => { sends++; throw blocked; } },
      sleep: noSleep,
    });
    const err = await p.describe({ images: [Buffer.from('x')], text: 'hi', maxTokens: 64 }).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.retryable).toBe(false);
    expect(err.code).toBe('bedrock_account_blocked');
    expect(err.message).toContain('Error 002');
    expect(err.message).toContain('DESCRIPTION_PROVIDER=anthropic');
    expect(err.message).toContain('ANTHROPIC_API_KEY');
    expect(BEDROCK_BLOCKED_HINT).toContain('does not switch providers on its own');
    expect(sends).toBe(1);
  });

  it('retries a ThrottlingException up to MAX_ATTEMPTS then throws retryable', async () => {
    let sends = 0;
    const p = new BedrockConverseProvider({
      client: { send: async () => { sends++; throw awsError('ThrottlingException'); } },
      sleep: noSleep,
    });
    const err = await p.describe({ images: [], text: 'hi', maxTokens: 64 }).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.retryable).toBe(true);
    expect(sends).toBe(MAX_ATTEMPTS);
  });

  it('sends the frames as jpeg image blocks before the text, and records usage', async () => {
    let seen: unknown;
    const p = new BedrockConverseProvider({
      modelId: 'amazon.nova-lite-v1:0',
      client: {
        send: async (cmd) => {
          seen = cmd.input;
          return {
            $metadata: {},
            output: { message: { role: 'assistant', content: [{ text: '{"description": "A door."}' }] } },
            usage: { inputTokens: 1200, outputTokens: 9, totalTokens: 1209 },
            stopReason: 'end_turn',
            metrics: { latencyMs: 1 },
          };
        },
      },
    });
    const out = await p.describe({ images: [Buffer.from('jpg1'), Buffer.from('jpg2')], text: 'prompt', maxTokens: 64 });
    expect(out).toBe('{"description": "A door."}');
    const input = seen as { modelId: string; messages: { content: unknown[] }[]; inferenceConfig: { maxTokens: number } };
    expect(input.modelId).toBe('amazon.nova-lite-v1:0');
    expect(input.inferenceConfig.maxTokens).toBe(64);
    expect(input.messages[0]!.content).toHaveLength(3);
    expect(input.messages[0]!.content[0]).toMatchObject({ image: { format: 'jpeg' } });
    expect(input.messages[0]!.content[2]).toEqual({ text: 'prompt' });
    expect(p.usage).toEqual({ calls: 1, input_tokens: 1200, output_tokens: 9 });
    expect(p.modelId).toBe('amazon.nova-lite-v1:0');
  });
});

describe('AnthropicProvider', () => {
  it('names the model the installed SDK types list, overridable', () => {
    expect(DEFAULT_ANTHROPIC_MODEL).toBe('claude-sonnet-5-5');
    const p = new AnthropicProvider({ modelId: 'claude-sonnet-4-5', apiKey: 'test-key' });
    expect(p.modelId).toBe('claude-sonnet-4-5');
    expect(p.id).toBe('anthropic');
  });
});

describe('selectProvider — DESCRIPTION_PROVIDER', () => {
  it('defaults to bedrock with BEDROCK_MODEL_ID', () => {
    const p = selectProvider({ BEDROCK_MODEL_ID: 'amazon.nova-pro-v1:0', AWS_REGION: 'us-east-1' }, { dryRun: false });
    expect(p.id).toBe('bedrock');
    expect(p.modelId).toBe('amazon.nova-pro-v1:0');
    expect(selectProvider({}, { dryRun: false }).modelId).toBe(DEFAULT_BEDROCK_MODEL);
  });

  it('selects anthropic only when asked, and only with a key', () => {
    expect(() => selectProvider({ DESCRIPTION_PROVIDER: 'anthropic' }, { dryRun: false }))
      .toThrow(/ANTHROPIC_API_KEY/);
    const p = selectProvider(
      { DESCRIPTION_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'test-key', ANTHROPIC_MODEL_ID: 'claude-sonnet-4-5' },
      { dryRun: false },
    );
    expect(p.id).toBe('anthropic');
    expect(p.modelId).toBe('claude-sonnet-4-5');
  });

  it('rejects an unknown provider name and uses the fake for a dry run', () => {
    expect(() => selectProvider({ DESCRIPTION_PROVIDER: 'openai' }, { dryRun: false }))
      .toThrow(/bedrock\|anthropic/);
    expect(selectProvider({ DESCRIPTION_PROVIDER: 'anthropic' }, { dryRun: true }).id).toBe('fake');
  });
});

describe('FakeProvider', () => {
  it('answers a cue prompt with about the words it asked for, and the cast prompt with lines', async () => {
    const p = new FakeProvider();
    const cue = await p.describe({ images: [], text: 'Aim for about 7 words — that is the standard level.', maxTokens: 64 });
    expect(JSON.parse(cue)).toEqual({ description: expect.any(String) });
    expect((JSON.parse(cue).description as string).split(' ')).toHaveLength(7);
    const cast = await p.describe({ images: [], text: 'list the principal characters', maxTokens: 400 });
    expect(cast.split('\n').length).toBeGreaterThan(1);
    expect(p.usage.calls).toBe(2);
    expect(wordsOf(3)).toBe('a figure crosses');
  });
});
