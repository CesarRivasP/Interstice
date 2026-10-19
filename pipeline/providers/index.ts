import { AnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from './anthropic.js';
import { BedrockConverseProvider, DEFAULT_BEDROCK_MODEL } from './bedrock.js';
import { FakeProvider } from './fake.js';
import { DEFAULT_GEMINI_MODEL, GeminiProvider } from './gemini.js';
import { DEFAULT_OLLAMA_MODEL, OllamaProvider } from './ollama.js';
import type { DescriptionProvider } from './types.js';

export { AnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from './anthropic.js';
export { withBackoff, waitMsFor } from './backoff.js';
export {
  BEDROCK_BLOCKED_HINT,
  BedrockConverseProvider,
  DEFAULT_BEDROCK_MODEL,
  isAccountBlocked,
  isThrottle,
} from './bedrock.js';
export { FakeProvider, fakeSynthesize, hasFfmpeg, wordsOf } from './fake.js';
export { DEFAULT_GEMINI_MODEL, GEMINI_ENDPOINT, GeminiProvider } from './gemini.js';
export { DEFAULT_OLLAMA_HOST, DEFAULT_OLLAMA_MODEL, OllamaProvider } from './ollama.js';
export { ProviderError, emptyUsage } from './types.js';
export type { DescriptionProvider, ProviderUsage, VisionRequest } from './types.js';

export const PROVIDER_NAMES = ['bedrock', 'anthropic', 'gemini', 'ollama'] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];

/**
 * `DESCRIPTION_PROVIDER=bedrock|anthropic|gemini|ollama`, default bedrock. The fallback is
 * chosen by the operator, never by the pipeline: when Bedrock answers with the
 * account-level refusal of `defects[D4]`, `BedrockConverseProvider` fails fast
 * with a message naming this variable, and the run stops.
 */
export function selectProvider(
  env: NodeJS.ProcessEnv,
  opts: { dryRun: boolean },
): DescriptionProvider {
  if (opts.dryRun) return new FakeProvider();

  const name = env.DESCRIPTION_PROVIDER ?? 'bedrock';
  if (name === 'anthropic') {
    if (!env.ANTHROPIC_API_KEY && !env.ANTHROPIC_AUTH_TOKEN) {
      throw new Error(
        'DESCRIPTION_PROVIDER=anthropic needs ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN) in the environment',
      );
    }
    return new AnthropicProvider({ modelId: env.ANTHROPIC_MODEL_ID ?? DEFAULT_ANTHROPIC_MODEL });
  }
  if (name === 'gemini') {
    if (!env.GEMINI_API_KEY) {
      throw new Error('DESCRIPTION_PROVIDER=gemini needs GEMINI_API_KEY in the environment');
    }
    return new GeminiProvider({
      apiKey: env.GEMINI_API_KEY,
      modelId: env.GEMINI_MODEL_ID ?? DEFAULT_GEMINI_MODEL,
      ...(env.GEMINI_MIN_INTERVAL_MS ? { minIntervalMs: Number(env.GEMINI_MIN_INTERVAL_MS) } : {}),
    });
  }
  if (name === 'ollama') {
    return new OllamaProvider({
      modelId: env.OLLAMA_MODEL_ID ?? DEFAULT_OLLAMA_MODEL,
      ...(env.OLLAMA_HOST ? { host: env.OLLAMA_HOST } : {}),
    });
  }
  if (name === 'bedrock') {
    const region = env.AWS_REGION ?? 'us-east-1'; // limits.bedrock.region
    return new BedrockConverseProvider({
      modelId: env.BEDROCK_MODEL_ID ?? DEFAULT_BEDROCK_MODEL,
      region,
    });
  }
  throw new Error(
    `DESCRIPTION_PROVIDER=${name} is not one of ${PROVIDER_NAMES.join('|')}`,
  );
}
