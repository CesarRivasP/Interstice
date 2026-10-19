import { describe, expect, it } from 'vitest';
import { MAX_ATTEMPTS } from '../budget.js';
import {
  AnthropicProvider,
  BEDROCK_BLOCKED_HINT,
  BedrockConverseProvider,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_BEDROCK_MODEL,
  DEFAULT_GEMINI_MODEL,
  FakeProvider,
  GeminiProvider,
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

describe('GeminiProvider — the third real implementation of the seam', () => {
  const ok = (text: string, usage = { promptTokenCount: 700, candidatesTokenCount: 20 }) =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }], usageMetadata: usage }), { status: 200 });

  it('sends the frames as inline jpeg parts before the text, with the key in a header, and records usage', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const p = new GeminiProvider({ apiKey: 'k', fetch: async (url, init) => { seen.push({ url, init }); return ok('A man enters.'); } });
    const out = await p.describe({ images: [Buffer.from('a'), Buffer.from('b')], text: 'describe', maxTokens: 40 });
    expect(out).toBe('A man enters.');
    expect(seen[0]!.url).toContain(`/models/${DEFAULT_GEMINI_MODEL}:generateContent`);
    expect((seen[0]!.init.headers as Record<string, string>)['x-goog-api-key']).toBe('k');
    const body = JSON.parse(seen[0]!.init.body as string);
    const parts = body.contents[0].parts;
    expect(parts).toHaveLength(3);
    expect(parts[0].inline_data.mime_type).toBe('image/jpeg');
    expect(parts[0].inline_data.data).toBe(Buffer.from('a').toString('base64'));
    expect(parts[2]).toEqual({ text: 'describe' });
    expect(body.generationConfig.maxOutputTokens).toBe(40);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 }); // thoughts would eat the cue budget
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(p.usage).toEqual({ calls: 1, input_tokens: 700, output_tokens: 20 });
  });

  it('retries 429 up to MAX_ATTEMPTS then throws retryable, and fails fast on 400', async () => {
    let calls = 0;
    const p = new GeminiProvider({ apiKey: 'k', sleep: noSleep, fetch: async () => { calls++; return new Response('slow down', { status: 429 }); } });
    await expect(p.describe({ images: [], text: 't', maxTokens: 10 })).rejects.toMatchObject({ retryable: true });
    expect(calls).toBe(MAX_ATTEMPTS);
    let bad = 0;
    const q = new GeminiProvider({ apiKey: 'k', sleep: noSleep, fetch: async () => { bad++; return new Response('{"error":"bad key"}', { status: 400 }); } });
    await expect(q.describe({ images: [], text: 't', maxTokens: 10 })).rejects.toMatchObject({ retryable: false, code: 'http_400' });
    expect(bad).toBe(1);
  });

  // Fails if: a safety block is turned into a cue. It must come back empty so
  // the validator writes the cue `failed` (AC7), as the Anthropic refusal does.
  it('returns empty text on a safety block', async () => {
    const p = new GeminiProvider({ apiKey: 'k', fetch: async () => new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' }, usageMetadata: { promptTokenCount: 5 } }), { status: 200 }) });
    expect(await p.describe({ images: [], text: 't', maxTokens: 10 })).toBe('');
  });

  it('is selected only when asked, and only with a key', () => {
    expect(() => selectProvider({ DESCRIPTION_PROVIDER: 'gemini' }, { dryRun: false })).toThrow('GEMINI_API_KEY');
    const p = selectProvider({ DESCRIPTION_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', GEMINI_MODEL_ID: 'gemini-x' }, { dryRun: false });
    expect(p.id).toBe('gemini');
    expect(p.modelId).toBe('gemini-x');
  });
});
