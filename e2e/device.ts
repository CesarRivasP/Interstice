import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';

const PROFILE = readFileSync('docs/features/_profile.yml', 'utf8');
/** `_profile.yml component_id` — the id every device command takes */
export const COMPONENT = /^component_id:\s*(\S+)/m.exec(PROFILE)![1]!;

const BUILT = 'build/aarch64-release/interstice_aarch64.vpkg';
export const PKG = {
  release: 'e2e/out/pkg/release.vpkg',
  variant: 'e2e/out/pkg/variant.vpkg',
} as const;

const vega = (...args: string[]): string =>
  execFileSync('vega', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const npm = (...args: string[]): void => {
  execFileSync('npm', args, { stdio: 'inherit' });
};

export function virtualDeviceRunning(): boolean {
  return /"running":\s*true/.test(vega('virtual-device', 'status'));
}

/** device -> host, so the app's `localhost:<port>` is this machine */
export function reverseForward(port: number): void {
  vega('device', 'start-port-forwarding', '--port', String(port), '--forward', 'false');
}

/**
 * Build what the suite needs and keep a copy of each package under e2e/out/pkg.
 * VARIANT is built FIRST and Release LAST, so `build/` always ends up holding
 * the Release package — the one a later manual install would pick up.
 */
export function buildPackages(suite: 'release' | 'variant'): void {
  mkdirSync('e2e/out/pkg', { recursive: true });
  if (suite === 'variant') {
    npm('run', 'build:e2e');
    copyFileSync(BUILT, PKG.variant);
  }
  npm('run', 'build');
  copyFileSync(BUILT, PKG.release);
}

export const install = (pkg: string): void => void vega('device', 'install-app', '--packagePath', pkg);
export const launch = (): void => void vega('device', 'launch-app', '--appName', COMPONENT);
/** `_profile.yml commands.force_stop`. Not running is not an error. */
export function terminate(): void {
  try {
    vega('device', 'terminate-app', '--appName', COMPONENT);
  } catch {
    /* already stopped */
  }
}

/** on-device shell command — `vega device run-cmd` */
export const runCmd = (command: string): string => vega('device', 'run-cmd', '--command', command);

/** for `contracts.run_record.conditions` */
export function describeDevice(): string {
  try {
    const info = JSON.parse(vega('device', 'info')) as Record<string, unknown>;
    return `${info.simulated ? 'Vega Virtual Device' : 'Fire TV'}, ${String(info.architecture)}, ${String(info.buildDescription)}`;
  } catch {
    return 'unknown — `vega device info` did not return JSON';
  }
}
export const sdkVersion = (): string =>
  /Active SDK Version:\s*(\S+)/.exec(vega('--version'))?.[1] ?? 'unknown';
