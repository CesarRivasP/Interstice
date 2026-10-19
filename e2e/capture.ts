import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, rmSync, statSync } from 'node:fs';

/** contracts.run_record.capture_rung */
export type Rung = 'grpc' | 'appium' | 'none';

export interface Capture {
  rung: Rung;
  /** once per run, before the first capture */
  prepare(): void;
  /** true when a non-empty file was written. Never throws: a missing picture is not a failed scenario. */
  screenshot(path: string): Promise<boolean>;
  /** records for a fixed time from now */
  startClip(path: string, seconds: number): Promise<void>;
  /** waits for the recording to end; true when a non-empty clip was written */
  stopClip(): Promise<boolean>;
}

const written = (path: string) => existsSync(path) && statSync(path).size > 0;

/** rung 3 — always available, and enough for a verdict */
const none: Capture = {
  rung: 'none',
  prepare: () => {},
  screenshot: async () => false,
  startClip: async () => {},
  stopClip: async () => false,
};

/**
 * rung 1 — the emulator gRPC interface, through the wrapper of R-VVD-DRIVER
 * (MIT, pinned at a9ea5d5; measured on 2026-10-04, defects D1 and D3).
 * `bin` is its dist/bin.js. The wrapper is run with this Node, never installed.
 */
function grpc(bin: string): Capture {
  const vvd = (args: string[], timeout: number) =>
    execFileSync(process.execPath, [bin, ...args], { stdio: 'ignore', timeout });
  let recording: { child: ChildProcess; path: string; done: Promise<void> } | null = null;

  return {
    rung: 'grpc',
    prepare() {
      // off after every start of the device; safe to repeat
      vvd(['enable-grpc'], 15_000);
    },
    async screenshot(path) {
      // limits.capture.frame_size: a film frame is 1.36 MB as PNG and 76 KB as
      // a 1280-wide JPEG, and the published bound is 300 KB.
      const png = `${path}.png`;
      try {
        vvd(['screenshot', png], 10_000);
        execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-vf', 'scale=1280:-1', '-q:v', '4', path]);
        return written(path);
      } catch {
        return false;
      } finally {
        rmSync(png, { force: true });
      }
    },
    async startClip(path, seconds) {
      const child = spawn(process.execPath, [bin, 'record', path, '--seconds', String(seconds)], { stdio: 'ignore' });
      const done = new Promise<void>((resolve) => child.once('exit', () => resolve()));
      recording = { child, path, done };
    },
    async stopClip() {
      if (!recording) return false;
      const { path, done } = recording;
      recording = null;
      await done;
      return written(path);
    },
  };
}

/** E2E_CAPTURE = none | grpc:<path to the wrapper's dist/bin.js>. Unset means none. */
export function createCapture(env = process.env.E2E_CAPTURE ?? 'none'): Capture {
  if (env.startsWith('grpc:')) return grpc(env.slice('grpc:'.length));
  return none;
}
