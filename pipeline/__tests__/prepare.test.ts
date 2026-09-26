import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[][] = [];
let playlist = '';

vi.mock('node:child_process', () => ({
  execFileSync: (bin: string, args: string[]) => {
    calls.push([bin, ...args]);
    // the HLS run writes the playlist ffmpeg would have emitted
    const out = args[args.length - 1]!;
    if (out.endsWith('.m3u8')) writeFileSync(out, playlist);
    return Buffer.from('');
  },
  spawnSync: () => ({stdout: '', stderr: '', status: 0, error: undefined}),
}));

const { prepareAsset } = await import('../prepare.js');

const PLAYLIST = `#EXTM3U
#EXT-X-MAP:URI="init.mp4"
#EXTINF:9.940000,
seg0000.m4s
#EXTINF:10.107000,
seg0001.m4s
#EXT-X-ENDLIST
`;

const authored = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    version: '1',
    asset_id: 'clip',
    media_uri: 'src/assets/clip.mp4',
    subtitles_uri: 'media/tears-of-steel.en.srt',
    duration_ms: 20_047,
    content_windows: [{ start_ms: 0, end_ms: 20_047, label: 'excerpt' }],
    segments: null,
    ...over,
  });

beforeEach(() => {
  calls.length = 0;
  playlist = PLAYLIST;
});

const run = (over: Record<string, unknown> = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'interstice-prep-'));
  return prepareAsset({
    manifestPath: 'media/clip.manifest.json',
    manifestJson: authored(over),
    segmentDir: dir,
  });
};

describe('prepareAsset', () => {
  it('keeps the authored half and adds the derived half', () => {
    const { manifest } = run();
    // authored: measured by a human, cannot be derived
    expect(manifest.content_windows).toEqual([{ start_ms: 0, end_ms: 20_047, label: 'excerpt' }]);
    // derived: read from the playlist ffmpeg emitted
    expect(manifest.segments).toHaveLength(2);
    expect(manifest.segments?.[1]?.start_ms).toBe(9_940);
  });

  // Fails if: absolute build-machine paths reach the manifest. That manifest
  // ships inside the package, so an absolute path exists on exactly one computer
  // and the failure lands on the device as a fetch for a file that is not there.
  it('writes RELATIVE segment uris, never the build machine s paths', () => {
    const { manifest } = run();
    for (const s of manifest.segments ?? []) {
      expect(s.uri.startsWith('/')).toBe(false);
      expect(s.uri).toMatch(/^seg\d+\.m4s$/);
    }
  });

  it('generates the static requires metro needs, with the derived timings', () => {
    const { module_path } = run();
    const generated = readFileSync(module_path, 'utf8');
    expect(generated).toContain("require('./init.mp4')");
    expect(generated).toContain("require('./seg0000.m4s')");
    expect(generated).toContain('start_ms: 9940, end_ms: 20047');
    expect(generated).toContain('GENERATED');
  });

  // Fails if: segments that stop short of the declared duration pass silently.
  // The player would reach the end of the media and sit in `waiting` forever —
  // no error, no cause, and the viewer told nothing.
  it('warns when the segments do not reach the declared end', () => {
    const logged: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((m: string) => logged.push(m));
    run({ duration_ms: 60_000, content_windows: [{ start_ms: 0, end_ms: 60_000 }] });
    spy.mockRestore();
    expect(logged.some((l) => l.includes('prepare.short'))).toBe(true);
  });

  it('does not warn when they do', () => {
    const logged: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((m: string) => logged.push(m));
    run();
    spy.mockRestore();
    expect(logged.some((l) => l.includes('prepare.short'))).toBe(false);
  });
});
