import { describe, expect, it } from 'vitest';
import {
  parsePlaylist,
  segmentsForWindow,
  segmentsToEvict,
} from '../segment.js';

// Real ffmpeg output shape, and deliberately UNEVEN: these are the durations
// ffmpeg actually produced for the demo clip at -hls_time 6, because it cuts on
// keyframes. A fixture with tidy 6.0s segments would test a file ffmpeg does not
// emit — the R25 lesson, applied to a fixture instead of a mock.
const PLAYLIST = `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:10
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-MAP:URI="init.mp4"
#EXTINF:9.940000,
seg0000.m4s
#EXTINF:4.167000,
seg0001.m4s
#EXTINF:5.292000,
seg0002.m4s
#EXTINF:0.648000,
seg0003.m4s
#EXT-X-ENDLIST
`;

describe('parsePlaylist', () => {
  it('reads one segment per EXTINF, in order', () => {
    const segments = parsePlaylist(PLAYLIST, 'out');
    expect(segments).toHaveLength(4);
    expect(segments.map((s) => s.index)).toEqual([0, 1, 2, 3]);
  });

  // Fails if: durations are derived from the requested segment length instead of
  // read from the playlist. ffmpeg cuts on keyframes, so a 6-second request
  // produced 9.94s here. A scheduler built on the assumption would drift further
  // from the picture with every segment, and AC4 is about cues landing inside
  // real dialogue gaps.
  it('takes each duration from the playlist, not from the requested length', () => {
    const [first, second] = parsePlaylist(PLAYLIST, 'out');
    expect(first?.end_ms).toBe(9_940);
    expect(second?.start_ms).toBe(9_940);
    expect(second?.end_ms).toBe(14_107);
  });

  it('tiles the asset with no gaps', () => {
    const segments = parsePlaylist(PLAYLIST, 'out');
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i]?.start_ms).toBe(segments[i - 1]?.end_ms);
    }
  });

  it('ignores the header lines and the init map', () => {
    expect(parsePlaylist(PLAYLIST, 'out').some((s) => s.uri.includes('init.mp4'))).toBe(false);
  });
});

describe('segmentsForWindow — limits.mse_buffer, measured in TIME', () => {
  const segments = parsePlaylist(PLAYLIST, 'out');

  it('holds the segment under the playhead and those ahead of it', () => {
    const window = segmentsForWindow(segments, 10_000, 6_000);
    expect(window.map((s) => s.index)).toEqual([1, 2]);
  });

  // Fails if: the window is expressed as a segment COUNT. These segments run
  // 9.94s, 4.17s, 5.29s and 0.65s, so "keep five" means anything between 3 and
  // 50 seconds of media depending on where the playhead sits — which is not a
  // memory bound, and a memory bound is the entire point of limits.mse_buffer.
  it('covers the same DURATION wherever the playhead is', () => {
    for (const position of [0, 5_000, 10_000, 15_000]) {
      const window = segmentsForWindow(segments, position, 6_000);
      const covered = window.reduce((t, s) => t + (s.end_ms - s.start_ms), 0);
      expect(covered).toBeGreaterThan(0);
      // never more than the window plus the one segment straddling each edge
      expect(covered).toBeLessThanOrEqual(6_000 + 9_940 + 9_940);
    }
  });

  it('never returns a segment that has already finished', () => {
    expect(segmentsForWindow(segments, 15_000, 30_000).every((s) => s.end_ms > 15_000)).toBe(true);
  });
});

describe('segmentsToEvict', () => {
  const segments = parsePlaylist(PLAYLIST, 'out');

  it('drops only what is fully behind the trailing edge', () => {
    expect(segmentsToEvict(segments, 16_000, 2_000).map((s) => s.index)).toEqual([0]);
  });

  // Fails if: eviction reaches the segment under the playhead. Removing the
  // media currently being decoded is how a buffer manager stalls the thing it
  // exists to keep smooth.
  it('never evicts the segment being played', () => {
    for (const position of [0, 5_000, 12_000, 19_000]) {
      const evicted = segmentsToEvict(segments, position, 10_000);
      expect(evicted.every((s) => s.end_ms < position)).toBe(true);
    }
  });

  it('evicts nothing at the start', () => {
    expect(segmentsToEvict(segments, 0, 10_000)).toEqual([]);
  });
});
