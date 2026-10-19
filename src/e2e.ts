/**
 * The ONLY place the build flag is read.
 *
 * `babel.config.js` replaces `__INTERSTICE_E2E__` with the value of the
 * INTERSTICE_E2E environment variable at build time, or with ''. A Release
 * build therefore compiles `E2E` to null and nothing at run time can change
 * that — see docs/features/e2e-harness/_facts.yml decisions.two_suites and
 * alternatives[A3] for why this is not a run-time switch.
 */
declare const __INTERSTICE_E2E__: string;

export interface E2EConfig {
  /** origin of the collector as the device sees it */
  host: string;
  asset_id: string;
  /** where track files resolve */
  asset_dir: string;
  /** where init and media segments resolve */
  segment_base: string;
}

const host: string = __INTERSTICE_E2E__;

export const E2E: E2EConfig | null = host
  ? {
      host,
      asset_id: 'e2e-fixture',
      asset_dir: `${host}/fx`,
      segment_base: `${host}/fx`,
    }
  : null;
