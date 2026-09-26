import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { MediaSegment } from './manifest.js';

/**
 * Cut an asset into fragmented-MP4 segments for `limits.mse_buffer`.
 *
 * SEGMENTS RATHER THAN BYTE RANGES, and that is measured rather than chosen:
 * `limits.vega_media.no_range_requests` — a `Range` request against a packaged
 * path returns status 200 and the WHOLE file. A window built on byte offsets
 * would look like it worked and would hold the entire asset in memory.
 *
 * HLS with `hls_segment_type fmp4` is used for the cutting because it emits both
 * halves MSE needs — one init segment carrying the codec configuration, then
 * media segments that can be appended in any order after it — and because its
 * playlist states each segment's duration exactly. Deriving durations by
 * dividing the runtime instead would drift: ffmpeg cuts on keyframes, so real
 * segments are not all `segment_s` long.
 */

/** `limits.mse_buffer.segment_s` */
export const SEGMENT_S = 6;

export interface SegmentedAsset {
  /** the init segment — appended once, before any media segment */
  init_uri: string;
  segments: MediaSegment[];
}

export function segmentAsset(
  assetPath: string,
  outDir: string,
  segmentSeconds: number = SEGMENT_S,
): SegmentedAsset {
  mkdirSync(outDir, { recursive: true });

  const playlist = join(outDir, 'index.m3u8');

  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', assetPath,
    // Stream copy: the asset is already H.264 + AAC, and re-encoding here would
    // change what the device decodes without anybody asking it to.
    '-c', 'copy',
    '-f', 'hls',
    '-hls_time', String(segmentSeconds),
    '-hls_playlist_type', 'vod',
    '-hls_segment_type', 'fmp4',
    '-hls_fmp4_init_filename', 'init.mp4',
    '-hls_segment_filename', join(outDir, 'seg%04d.m4s'),
    playlist,
  ]);

  const segments = parsePlaylist(readFileSync(playlist, 'utf8'), outDir);

  console.log(
    `INTERSTICE.segment.built n=${segments.length} segment_s=${segmentSeconds}` +
      ` total_ms=${segments.length ? segments[segments.length - 1]!.end_ms : 0}`,
  );

  return { init_uri: join(outDir, 'init.mp4'), segments };
}

/**
 * Read `#EXTINF:<seconds>,` / filename pairs out of an HLS playlist.
 *
 * The durations come from the playlist rather than from `segmentSeconds`
 * because ffmpeg cuts on keyframes: a 6-second request produces segments of
 * 5.8, 6.2, 6.0 and so on, and a scheduler that assumed uniform lengths would
 * drift further from the picture with every segment.
 */
export function parsePlaylist(playlist: string, outDir: string): MediaSegment[] {
  const segments: MediaSegment[] = [];
  const lines = playlist.split('\n');
  let cursorMs = 0;
  let pendingMs: number | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    const extinf = /^#EXTINF:([0-9.]+)/.exec(line);
    if (extinf) {
      pendingMs = Math.round(Number(extinf[1]) * 1000);
      continue;
    }
    if (line === '' || line.startsWith('#')) continue;
    if (pendingMs === null) continue;

    const uri = join(outDir, basename(line));
    segments.push({
      index: segments.length,
      start_ms: cursorMs,
      end_ms: cursorMs + pendingMs,
      uri,
      bytes: sizeOf(uri),
    });
    cursorMs += pendingMs;
    pendingMs = null;
  }

  return segments;
}

function sizeOf(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

/**
 * The segments the app should hold to cover `aheadMs` forward of `positionMs`.
 *
 * MEASURED IN TIME, NOT IN COUNT, and the demo clip is why. ffmpeg cuts on
 * keyframes, so a 6-second request produced segments of 9.94, 4.17, 5.29 and
 * 0.65 seconds on this asset. "Keep five segments" would therefore mean anything
 * between 3 and 50 seconds of media depending on where the playhead is — which
 * is not a memory bound at all, and a memory bound is the entire point of
 * `limits.mse_buffer`.
 */
export function segmentsForWindow(
  segments: MediaSegment[],
  positionMs: number,
  aheadMs: number,
): MediaSegment[] {
  return segments.filter((s) => s.end_ms > positionMs && s.start_ms <= positionMs + aheadMs);
}

/** Segments that have fallen more than `behindMs` behind and can be dropped. */
export function segmentsToEvict(
  segments: MediaSegment[],
  positionMs: number,
  behindMs: number,
): MediaSegment[] {
  return segments.filter((s) => s.end_ms < positionMs - behindMs);
}
