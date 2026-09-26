import { beforeEach, describe, expect, it, vi } from 'vitest';

// ffmpeg and ffprobe are the two things this module is. Mocking node:child_process
// is therefore the whole harness — 02e §B.0. The real binaries are exercised once,
// by hand, against the real asset, because a mock cannot tell you the JPEG is of
// the film rather than of black.
const calls: { bin: string; args: string[] }[] = [];
let cutsOutput = '';

// The mock keeps stdout and stderr SEPARATE, because ffmpeg does. `showinfo`
// writes to stderr; the null muxer writes nothing useful to stdout. A mock that
// returns one undifferentiated buffer lets a function read the wrong stream and
// still pass — which is how detectCuts shipped reading stdout and returning
// null on every real call until the first run against the real asset.
vi.mock('node:child_process', () => ({
  execFileSync: (bin: string, args: string[]) => {
    calls.push({ bin, args });
    if (args.includes('format=duration')) return Buffer.from('734.166667\n');
    return Buffer.from(''); // stdout, and ffmpeg puts nothing here
  },
  spawnSync: (bin: string, args: string[]) => {
    calls.push({ bin, args });
    return { stdout: '', stderr: cutsOutput, status: 0, error: undefined };
  },
}));

vi.mock('node:fs', () => ({ mkdirSync: () => undefined }));

const { assetDurationMs, detectCuts, framesForCue, framesForTrack, windowKey } =
  await import('../frames.js');

const cue = (start_ms: number, end_ms: number, index = 0) => ({
  index,
  gap_index: 0,
  start_ms,
  end_ms,
  duration_ms: end_ms - start_ms,
  word_target: 20,
  word_ceiling: 30,
  part_index: 1,
  part_count: 1,
  before: null,
  after: null,
});

const extractions = () =>
  calls.filter((c) => c.bin === 'ffmpeg' && c.args.includes('-frames:v'));

beforeEach(() => {
  calls.length = 0;
  cutsOutput = '';
});

describe('assetDurationMs', () => {
  it('reads ffprobe seconds and returns whole milliseconds', () => {
    expect(assetDurationMs('film.mp4')).toBe(734_167);
  });
});

describe('detectCuts', () => {
  it('returns cut timestamps offset by the window start, not by zero', () => {
    // ffmpeg is given -ss, so its pts_time is relative to the segment. A cut 2 s
    // into a window that starts at 20 s is at 22 s of the film, and an
    // implementation that forgets the offset extracts frames from the wrong scene.
    cutsOutput = 'pts_time:2.000\npts_time:5.500\n';
    expect(detectCuts('film.mp4', 20_000, 32_000)).toEqual([22_000, 25_500]);
  });

  it('returns nothing for a window with no scene change', () => {
    expect(detectCuts('film.mp4', 0, 12_000)).toEqual([]);
  });
});

describe('framesForCue — limits.ad.frames_per_gap_max', () => {
  it('extracts the midpoint when the window holds no cut', () => {
    const result = framesForCue('film.mp4', cue(0, 12_000), 'out');
    expect(result.source_frames_ms).toEqual([6_000]);
    expect(extractions()).toHaveLength(1);
  });

  // Fails if: a window with no cut is padded to three frames. The limit is a
  // CEILING, not a target — sampling a static 12-second shot three times spends
  // two Bedrock image slots on identical pixels.
  it('does not pad a single-shot window up to the ceiling', () => {
    expect(framesForCue('film.mp4', cue(0, 12_000), 'out').paths).toHaveLength(1);
  });

  it('never exceeds the ceiling however many cuts are detected', () => {
    cutsOutput = ['1.0', '2.0', '3.0', '4.0', '5.0', '6.0']
      .map((t) => `pts_time:${t}`)
      .join('\n');
    const result = framesForCue('film.mp4', cue(0, 12_000), 'out');
    expect(result.source_frames_ms).toHaveLength(3);
    expect(extractions()).toHaveLength(3);
  });

  it('grabs just INSIDE the new shot, not on the boundary', () => {
    cutsOutput = 'pts_time:4.000\n';
    const result = framesForCue('film.mp4', cue(0, 12_000), 'out');
    expect(result.source_frames_ms).toContain(4_080);
  });

  it('returns frames in time order', () => {
    cutsOutput = 'pts_time:9.000\npts_time:1.000\n';
    const ms = framesForCue('film.mp4', cue(0, 12_000), 'out').source_frames_ms;
    expect([...ms]).toEqual([...ms].sort((a, b) => a - b));
  });

  // Fails if: a cut at or past the window end produces a frame outside it. The
  // description is spoken inside this window, so a frame from after it describes
  // something the viewer has not reached.
  it('drops a grab that would land outside the window', () => {
    cutsOutput = 'pts_time:11.950\n'; // + 80 ms lands past end_ms
    const result = framesForCue('film.mp4', cue(0, 12_000), 'out');
    expect(result.source_frames_ms.every((t) => t >= 0 && t < 12_000)).toBe(true);
  });

  it('names files by window key so two levels agree on the same frame', () => {
    const result = framesForCue('film.mp4', cue(20_000, 32_000), 'out');
    expect(result.window_key).toBe('20000-32000');
    expect(result.paths[0]).toContain('cue_20000-32000_');
  });
});

describe('framesForTrack — extract once, reuse across levels', () => {
  // Fails if: the map is keyed by index. Indices renumber per verbosity level, so
  // an index join hands a cue another cue's frames at every level where something
  // was dropped — and the frame count still looks right, so nothing downstream
  // could detect it.
  it('indexes by window key, which is stable across levels', () => {
    const wide = [cue(0, 12_000, 0), cue(20_000, 32_000, 1), cue(40_000, 52_000, 2)];
    const byWindow = framesForTrack('film.mp4', wide, 'out');

    // the narrower level is a SUBSET, renumbered from 0 — it must still resolve
    const narrower = [cue(20_000, 32_000, 0), cue(40_000, 52_000, 1)];
    for (const c of narrower) {
      expect(byWindow.get(windowKey(c))?.window_key).toBe(windowKey(c));
    }
  });

  it('extracts each window exactly once', () => {
    framesForTrack('film.mp4', [cue(0, 12_000, 0), cue(20_000, 32_000, 1)], 'out');
    expect(extractions()).toHaveLength(2);
  });
});
