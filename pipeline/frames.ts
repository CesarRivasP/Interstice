import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { AD } from './budget.js';
import type { CueWindow } from './gaps.js';

/**
 * `_facts.yml changes[C8]` — up to `limits.ad.frames_per_gap_max` frames per CUE.
 *
 * Per cue, not per gap: three frames for a 167-second gap is three frames for a
 * minute and a half of film. The registry key keeps its old name for continuity
 * and means *per cue*, which `limits.ad.note` states.
 */

export interface CueFrames {
  /** `${start_ms}-${end_ms}` — stable across verbosity levels, unlike the index */
  window_key: string;
  /** contracts.description_cue.source_frames_ms — every frame this cue was built from */
  source_frames_ms: number[];
  paths: string[];
}

export function windowKey(cue: Pick<CueWindow, 'start_ms' | 'end_ms'>): string {
  return `${cue.start_ms}-${cue.end_ms}`;
}

export function assetDurationMs(assetPath: string): number {
  const out = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    assetPath,
  ]).toString().trim();
  return Math.round(Number(out) * 1000);
}

/**
 * Shot boundaries inside [startMs, endMs), via ffmpeg scene detection.
 * Returns their timestamps in ms. One ffmpeg pass per cue, on a short segment.
 *
 * READS STDERR, NOT STDOUT, and that is not a style choice: the `showinfo`
 * filter writes its `pts_time:` lines to stderr along with the rest of ffmpeg's
 * diagnostics, while stdout carries the (discarded) null-muxer output. An
 * earlier version of this function took execFileSync's RETURN VALUE, which is
 * stdout, and got `null` on every real invocation. The unit tests passed,
 * because a mock that returns one buffer cannot tell the two streams apart —
 * which is exactly why 02b Phase 4 requires a run against the real asset.
 */
export function detectCuts(assetPath: string, startMs: number, endMs: number): number[] {
  const result = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-ss', String(startMs / 1000),
      '-t', String((endMs - startMs) / 1000),
      '-i', assetPath,
      '-vf', "select='gt(scene,0.4)',showinfo",
      '-f', 'null', '-',
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.error) throw result.error;
  const out = result.stderr ?? '';

  const cuts: number[] = [];
  for (const m of out.matchAll(/pts_time:([0-9.]+)/g)) {
    cuts.push(startMs + Math.round(Number(m[1]) * 1000));
  }
  return cuts;
}

export function extractFrame(assetPath: string, atMs: number, outPath: string): void {
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', String(atMs / 1000),
    '-i', assetPath,
    '-frames:v', '1',
    '-q:v', '3',
    outPath,
  ]);
}

export function framesForCue(assetPath: string, cue: CueWindow, outDir: string): CueFrames {
  mkdirSync(outDir, { recursive: true });

  const midpoint = cue.start_ms + Math.floor(cue.duration_ms / 2);
  const cuts = detectCuts(assetPath, cue.start_ms, cue.end_ms);

  // Midpoint first — it is the frame that is always meaningful. Then one frame
  // just after each detected cut, in time order, until the bound is reached.
  //
  // `+ 80` puts the grab just inside the new shot rather than on the boundary,
  // where ffmpeg can hand back the last frame of the outgoing shot or a blend.
  // A frame-grab offset, not a limit — it appears in exactly one place.
  const wanted = [midpoint, ...cuts.map((c) => c + 80)]
    .filter((t, i, all) => all.indexOf(t) === i)
    .filter((t) => t >= cue.start_ms && t < cue.end_ms)
    .slice(0, AD.FRAMES_PER_GAP_MAX)
    .sort((a, b) => a - b);

  const key = windowKey(cue);
  const paths = wanted.map((t) => {
    const p = join(outDir, `cue_${key}_${t}.jpg`);
    extractFrame(assetPath, t, p);
    return p;
  });

  console.log(
    `INTERSTICE.frames.extracted window=${key} frames=${paths.length}` +
      ` at_ms=[${wanted.join(',')}]`,
  );

  return { window_key: key, source_frames_ms: wanted, paths };
}

/**
 * Extract for the widest cue set (detailed) and index by window key, so the
 * narrower levels reuse the same JPEGs.
 *
 * Sound because cue windows NEST — boundaries depend only on duration, and
 * verbosity decides only which windows fall under limits.ad.min_useful_words.
 * `02b` Phase 4 §4.1, pinned by a test in pipeline/__tests__/gaps.test.ts.
 */
export function framesForTrack(
  assetPath: string,
  cues: CueWindow[],
  outDir: string,
): Map<string, CueFrames> {
  const byWindow = new Map<string, CueFrames>();
  for (const cue of cues) {
    byWindow.set(windowKey(cue), framesForCue(assetPath, cue, outDir));
  }
  console.log(`INTERSTICE.frames.track cues=${cues.length} windows=${byWindow.size}`);
  return byWindow;
}
