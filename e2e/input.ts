import { runCmd } from './device.js';

export type Key = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'ENTER' | 'BACK';

/** contracts.run_record.input_route — set from `02` Phase 0.1 */
export const INPUT_ROUTE: 'inputd-cli' | 'grpc' = 'inputd-cli';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One press. `inputd-cli button_press KEY_ENTER` is the form the app set
 * measured on 2026-09-25; KEY_BACK is confirmed in `02` Phase 0.1 step 3.
 *
 * [AFTER PHASE 0] If INPUT_ROUTE is 'grpc' (defects D2 dead, D1 fixed), replace
 * the body with the key call of whatever client `e2e/capture.ts` ended up
 * using. The signature does not change.
 */
export async function press(key: Key): Promise<void> {
  runCmd(`inputd-cli button_press KEY_${key}`);
  await sleep(300); // limits.timing.key_gap_ms
}

export async function pressAll(keys: Key[]): Promise<void> {
  for (const key of keys) await press(key);
}
