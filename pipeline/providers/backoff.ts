import { MAX_ATTEMPTS } from '../budget.js';

export interface BackoffOptions {
  /** `limits.bedrock.on_throttle`: "exponential backoff, max 5 attempts" */
  maxAttempts?: number;
  isRetryable: (err: unknown) => boolean;
  /** injected so a test does not wait 31 seconds to prove five attempts */
  sleep?: (ms: number) => Promise<void>;
  label?: string;
}

export function waitMsFor(attempt: number): number {
  return 2 ** attempt * 500; // 1s, 2s, 4s, 8s — then the fifth attempt fails
}

/**
 * Run `fn` up to `maxAttempts` times, sleeping between attempts only when the
 * failure is one the provider marked retryable. A non-retryable error is thrown
 * on the spot: an account-level refusal (`defects[D4]`) does not become a
 * 15-second wait before the same refusal.
 */
export async function withBackoff<T>(fn: () => Promise<T>, o: BackoffOptions): Promise<T> {
  const max = o.maxAttempts ?? MAX_ATTEMPTS;
  const sleep = o.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  let lastError: unknown;

  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!o.isRetryable(err)) throw err;
      if (attempt === max) break;
      const waitMs = waitMsFor(attempt);
      console.log(
        `INTERSTICE.describe.throttled provider=${o.label ?? 'unknown'}` +
          ` attempt=${attempt} wait_ms=${waitMs}`,
      );
      await sleep(waitMs);
    }
  }

  throw lastError;
}
