/**
 * AC19, render 2: the split-screen before/after. Top: the film as shipped —
 * silence in the gap. Bottom: the same seconds with the film ducked to
 * limits.ad.duck_target_pct, the description as a caption inside the cue window,
 * an animated level meter, and a playhead moving over a mini timeline.
 *
 * ffmpeg does the compositing. This build of ffmpeg has no drawtext (no
 * libfreetype), so every piece of text is an SVG rendered to a transparent PNG
 * by `raster.ts` and placed with `overlay`, switched on and off with
 * `enable='between(t,a,b)'`. The ducking curve is one expression in `t`, used
 * twice: as the film's `volume`, and as the x position of the level bar — this
 * ffmpeg does not re-evaluate `drawbox` per frame, so the bar is a PNG that
 * slides left under an opaque shield by `(1 - level) * METER_W` pixels. The ramp
 * is limits.ad.duck_ramp_ms, not a guess.
 *
 * The description audio: if a generated track (contracts.description_track)
 * exists for this asset and verbosity, its cue text is the caption and its
 * clip is mixed over the ducked film. If not, the caption says PLACEHOLDER and
 * the film is only ducked — the coordinator swaps the track in by re-running.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fmtClock, type TimelineModel } from './model.js';
import type { Rasterizer } from './raster.js';
import { C, line, outline, rect, svg, text, wrap } from './svg.js';
import { trackFileName, type DescriptionTrack } from '../../pipeline/types.js';
import type { CueWindow } from '../../pipeline/gaps.js';

export interface SplitOptions {
  film: string;
  from_ms: number;
  to_ms: number;
  /** a contracts.description_track file; null = look beside the asset, then placeholder */
  trackPath: string | null;
  outDir: string;
  work: string;
  raster: Rasterizer;
  dryRun: boolean;
}

export interface SplitResult {
  outPath: string;
  cmdPath: string;
  cues: number;
  placeholder: boolean;
  bytes: number;
}

/** 1280x720, designed once; everything below reads these */
const W = 1280;
const H = 720;
const PANEL_W = 672;
const PANEL_H = 280;
const PANEL_X = 16;
const TOP_Y = 44;
const BOT_Y = 352;
const COL_X = 712;
const COL_W = W - 16 - COL_X;
const METER_W = 330;
const METER_H = 18;
const METER_X = COL_X + 110;
/** the right column's rows, as offsets from the panel top */
const ROW_METER = 36;
const ROW_DESC = 100;
const ROW_INFO = 130;
const ROW_NOTE = 190;
const TOP_METER_Y = TOP_Y + ROW_METER;
const BOT_METER_Y = BOT_Y + ROW_METER;
const TL_X = 16;
const TL_Y = 640;
const TL_W = W - 32;
const TL_H = 40;
const FPS = 24;
const MAX_COMMIT_BYTES = 3 * 1024 * 1024;

interface ResolvedCue {
  window: CueWindow;
  text: string;
  /** absolute path to the clip, or null when there is none */
  audio: string | null;
  placeholder: boolean;
}

export async function renderSplitScreen(m: TimelineModel, o: SplitOptions): Promise<SplitResult> {
  const dur_ms = o.to_ms - o.from_ms;
  if (dur_ms <= 0 || dur_ms > 30_000) {
    throw new Error(`INTERSTICE.viz.split.badRange from=${o.from_ms} to=${o.to_ms} — the clip is 1..30 s`);
  }
  const windows = m.cues.filter((c) => c.start_ms >= o.from_ms && c.end_ms <= o.to_ms);
  if (windows.length === 0) throw new Error('INTERSTICE.viz.split.noCueInRange — pick a range that holds a whole cue window');
  const cues = resolveCues(m, windows, o.trackPath);
  const work = join(o.work, 'split');
  mkdirSync(work, { recursive: true });

  // --- overlays -----------------------------------------------------------------
  const png = (name: string, body: string): string => {
    const svgPath = join(work, `${name}.svg`);
    const pngPath = join(work, `${name}.png`);
    writeFileSync(svgPath, body);
    o.raster.render(svgPath, pngPath);
    return pngPath;
  };
  const chrome = png('chrome', chromeSvg(m, o.from_ms, o.to_ms, cues));
  const playhead = png('playhead', svg(4, TL_H + 12, [rect(0, 0, 4, TL_H + 12, { fill: '#ffffff' })]));
  const silence = png('silence', badgeSvg(PANEL_X + PANEL_W - 150, TOP_Y + 14, 'SILENCE', C.rejected, 'nothing is said — a blind viewer gets nothing here', COL_X, TOP_Y + ROW_NOTE));
  const describing = png('describing', badgeSvg(PANEL_X + PANEL_W - 170, BOT_Y + 14, 'DESCRIBING', C.cue, `film ducked to ${m.limits.duck_target_pct}% over ${m.limits.duck_ramp_ms} ms · description plays in the gap`, COL_X, BOT_Y + ROW_NOTE));
  const captions = cues.map((c, i) => png(`caption-${i}`, captionSvg(m, c)));
  const bar = png('bar', svg(METER_W, METER_H, [rect(0, 0, METER_W, METER_H, { fill: C.duck, rx: 3 })]));
  const idle = png('idle', svg(W, H, [text(METER_X, BOT_Y + ROW_DESC, 'idle — dialogue, or a silence too short to speak in', { size: 16, fill: C.muted })]));
  const track = png('track', svg(METER_W, METER_H, [rect(0, 0, METER_W, METER_H, { fill: C.grid, rx: 3 })]));
  const shield = png('shield', shieldSvg(m));

  // --- the ffmpeg graph ----------------------------------------------------------------
  const rel = (ms: number) => ((ms - o.from_ms) / 1000).toFixed(3);
  const ramp = (m.limits.duck_ramp_ms / 1000).toFixed(3);
  const duck = (m.limits.duck_target_pct / 100).toFixed(2);
  // 1 - (1-duck) * max over windows of a trapezoid that ramps in and out
  const ramps = cues.map((c) => `min(1,max(0,(t-${rel(c.window.start_ms)})/${ramp}))*min(1,max(0,(${rel(c.window.end_ms)}-t)/${ramp}))`);
  const level = `(1-(1-${duck})*${nestMax(ramps)})`;
  const inWindow = cues.map((c) => `between(t,${rel(c.window.start_ms)},${rel(c.window.end_ms)})`).join('+');

  const inputs: string[] = ['-ss', (o.from_ms / 1000).toFixed(3), '-t', (dur_ms / 1000).toFixed(3), '-i', o.film];
  const pngs = [chrome, playhead, silence, describing, bar, shield, track, idle, ...captions];
  for (const p of pngs) inputs.push('-i', p);
  const clipInputs = cues.filter((c) => c.audio !== null);
  for (const c of clipInputs) inputs.push('-i', c.audio!);
  const idx = (n: number) => 1 + n; // png n → input index
  const clipIdx = (n: number) => 1 + pngs.length + n;

  const g: string[] = [];
  g.push(`color=c=${C.bg.replace('#', '0x')}:s=${W}x${H}:r=${FPS}[bg]`);
  g.push(`[0:v]scale=${PANEL_W}:${PANEL_H},setsar=1,split=2[top][bot]`);
  // the level bar goes down first: it slides left by (1 - level) * METER_W and the
  // bottom panel and the shield, drawn over it, clip whatever crosses the meter's edge
  g.push(`[bg][${idx(6)}:v]overlay=${METER_X}:${BOT_METER_Y}[bgt]`);
  g.push(`[bgt][${idx(4)}:v]overlay=x='${METER_X}-${METER_W}*(1-${level})':y=${BOT_METER_Y}:eval=frame[v0]`);
  g.push(`[v0][${idx(5)}:v]overlay=0:0[v0b]`);
  g.push(`[v0b][top]overlay=${PANEL_X}:${TOP_Y}:shortest=1[v1]`);
  g.push(`[v1][bot]overlay=${PANEL_X}:${BOT_Y}[v2]`);
  g.push(`[v2][${idx(0)}:v]overlay=0:0[v4]`);
  g.push(`[v4][${idx(2)}:v]overlay=0:0:enable='${inWindow}'[v5]`);
  g.push(`[v5][${idx(3)}:v]overlay=0:0:enable='${inWindow}'[v6]`);
  g.push(`[v6][${idx(7)}:v]overlay=0:0:enable='not(${inWindow})'[v7]`);
  let last = 'v7';
  cues.forEach((c, i) => {
    const next = `c${i}`;
    g.push(`[${last}][${idx(8 + i)}:v]overlay=0:0:enable='between(t,${rel(c.window.start_ms)},${rel(c.window.end_ms)})'[${next}]`);
    last = next;
  });
  g.push(`[${last}][${idx(1)}:v]overlay=x='${TL_X}+(t/${(dur_ms / 1000).toFixed(3)})*${TL_W}-2':y=${TL_Y - 6}:eval=frame[vout]`);
  g.push(`[0:a]volume='${level}':eval=frame[a0]`);
  if (clipInputs.length > 0) {
    const labels = ['[a0]'];
    clipInputs.forEach((c, i) => {
      const d = Math.round(c.window.start_ms - o.from_ms);
      g.push(`[${clipIdx(i)}:a]adelay=${d}|${d}[d${i}]`);
      labels.push(`[d${i}]`);
    });
    g.push(`${labels.join('')}amix=inputs=${labels.length}:duration=first:normalize=0[aout]`);
  } else {
    g.push('[a0]anull[aout]');
  }

  const tmpOut = join(work, 'gap-split-screen.mp4');
  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    ...inputs,
    '-filter_complex', g.join(';\n'),
    '-map', '[vout]', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '96k',
    '-movflags', '+faststart',
    tmpOut,
  ];
  const cmdPath = join(work, 'ffmpeg-command.txt');
  writeFileSync(cmdPath, `ffmpeg ${args.map(shellQuote).join(' ')}\n`);

  if (o.dryRun) return { outPath: tmpOut, cmdPath, cues: cues.length, placeholder: cues.some((c) => c.placeholder), bytes: 0 };

  if (!existsSync(o.film)) {
    throw new Error(`INTERSTICE.viz.split.noFilm ${o.film} — pass --film <path> or set INTERSTICE_FILM (media/*.mp4 is never committed)`);
  }
  const run = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (run.status !== 0) throw new Error(`INTERSTICE.viz.split.ffmpegFailed status=${run.status}`);

  const bytes = statSync(tmpOut).size;
  let outPath = tmpOut;
  if (bytes <= MAX_COMMIT_BYTES) {
    outPath = join(o.outDir, 'gap-split-screen.mp4');
    copyFileSync(tmpOut, outPath);
  } else {
    console.warn(`INTERSTICE.viz.split.tooLarge bytes=${bytes} limit=${MAX_COMMIT_BYTES} — left under ${work}, not copied to ${o.outDir}`);
  }
  return { outPath, cmdPath, cues: cues.length, placeholder: cues.some((c) => c.placeholder), bytes };
}

function nestMax(xs: string[]): string {
  if (xs.length === 0) return '0';
  if (xs.length === 1) return xs[0]!;
  return `max(${xs[0]},${nestMax(xs.slice(1))})`;
}

function shellQuote(s: string): string {
  return /^[A-Za-z0-9_./:=+-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
}

/** cue text and audio from a generated track when there is one; placeholder otherwise */
function resolveCues(m: TimelineModel, windows: CueWindow[], trackPath: string | null): ResolvedCue[] {
  const candidate = trackPath ?? join('media', trackFileName(m.asset_id, m.verbosity));
  let track: DescriptionTrack | null = null;
  if (existsSync(candidate)) {
    track = JSON.parse(readFileSync(candidate, 'utf8')) as DescriptionTrack;
    console.log(`INTERSTICE.viz.split.track path=${candidate} cues=${track.cues.length}`);
  } else {
    console.log(`INTERSTICE.viz.split.track none path=${candidate} → PLACEHOLDER captions, film ducked only`);
  }
  return windows.map((w) => {
    const cue = track?.cues.find((c) => c.status === 'ok' && c.start_ms >= w.start_ms - 500 && c.start_ms < w.end_ms);
    if (cue) {
      const audio = resolve(dirname(candidate), cue.audio_uri);
      return { window: w, text: cue.text, audio: existsSync(audio) ? audio : null, placeholder: false };
    }
    return {
      window: w,
      text: `PLACEHOLDER — ${w.word_target} words fit this ${(w.duration_ms / 1000).toFixed(1)} s gap (ceiling ${w.word_ceiling})`,
      audio: null,
      placeholder: true,
    };
  });
}

// --- the SVG pieces --------------------------------------------------------------------

function chromeSvg(m: TimelineModel, from: number, to: number, cues: ResolvedCue[]): string {
  const out: string[] = [];
  // panel frames and headers
  out.push(outline(PANEL_X - 3, TOP_Y - 3, PANEL_W + 6, PANEL_H + 6, C.grid, 3));
  out.push(outline(PANEL_X - 3, BOT_Y - 3, PANEL_W + 6, PANEL_H + 6, C.cue, 3));
  out.push(text(PANEL_X, TOP_Y - 12, 'AS SHIPPED', { size: 20, weight: 700 }));
  out.push(text(PANEL_X + 140, TOP_Y - 12, 'the film, its dialogue, and the silence between', { size: 16, fill: C.muted }));
  out.push(text(PANEL_X, BOT_Y - 12, 'WITH INTERSTICE', { size: 20, weight: 700, fill: C.cue }));
  out.push(text(PANEL_X + 190, BOT_Y - 12, 'same seconds — the gap is described, the film ducks under it', { size: 16, fill: C.muted }));

  // right column, top: the as-shipped meter, always full
  out.push(text(COL_X, TOP_METER_Y + 14, 'film audio', { size: 16, fill: C.muted }));
  out.push(rect(METER_X, TOP_METER_Y, METER_W, METER_H, { fill: C.grid, rx: 3 }));
  out.push(rect(METER_X, TOP_METER_Y, METER_W, METER_H, { fill: C.dialogue, rx: 3 }));
  out.push(text(METER_X + METER_W + 10, TOP_METER_Y + 14, '100%', { size: 14, fill: C.text }));
  out.push(text(METER_X, TOP_METER_Y + 36, 'never ducks — there is nothing to duck under', { size: 13, fill: C.muted }));
  out.push(text(COL_X, TOP_Y + ROW_DESC, 'description', { size: 16, fill: C.muted }));
  out.push(text(METER_X, TOP_Y + ROW_DESC, 'none', { size: 16, fill: C.muted }));

  // right column, bottom: the ducking meter background and the target mark
  out.push(text(METER_X, BOT_METER_Y + 36, `ducks to ${m.limits.duck_target_pct}% while describing, ${m.limits.duck_ramp_ms} ms ramp (limits.ad)`, { size: 13, fill: C.muted }));
  out.push(text(COL_X, BOT_Y + ROW_DESC, 'description', { size: 16, fill: C.muted }));
  out.push(text(COL_X, BOT_Y + PANEL_H - 30, `below: ${fmtClock(from)}–${fmtClock(to)} · ${cues.length} cue window${cues.length === 1 ? '' : 's'} · C7 on the real subtitles`, { size: 13, fill: C.muted }));
  out.push(text(COL_X, BOT_Y + PANEL_H - 8, 'what you hear is this panel', { size: 13, fill: C.muted }));

  // the mini timeline for the clip range
  const px = (ms: number) => TL_X + ((Math.min(Math.max(ms, from), to) - from) / (to - from)) * TL_W;
  out.push(rect(TL_X, TL_Y, TL_W, TL_H, { fill: C.panel, rx: 3 }));
  for (const sp of m.speech) {
    if (sp.end_ms < from || sp.start_ms > to) continue;
    out.push(rect(px(sp.start_ms), TL_Y + 4, Math.max(px(sp.end_ms) - px(sp.start_ms), 2), 14, { fill: C.dialogue }));
  }
  for (const rj of m.rejected) {
    if (rj.end_ms < from || rj.start_ms > to) continue;
    const cx = (px(rj.start_ms) + px(rj.end_ms)) / 2;
    out.push(rect(cx - 1.5, TL_Y + 4, 3, 14, { fill: C.rejected }));
  }
  for (const c of m.cues) {
    if (c.end_ms < from || c.start_ms > to) continue;
    out.push(rect(px(c.start_ms), TL_Y + 22, Math.max(px(c.end_ms) - px(c.start_ms), 2), 14, { fill: C.cue }));
    if (c.part_index > 1) out.push(line(px(c.start_ms), TL_Y + 22, px(c.start_ms), TL_Y + 36, { stroke: C.bg, 'stroke-width': 2 }));
  }
  for (const d of m.dropped) {
    if (d.end_ms < from || d.start_ms > to) continue;
    out.push(outline(px(d.start_ms), TL_Y + 22, Math.max(px(d.end_ms) - px(d.start_ms), 2), 14, C.dropped, 2));
  }
  for (let t = Math.ceil(from / 5000) * 5000; t <= to; t += 5000) {
    out.push(line(px(t), TL_Y + TL_H, px(t), TL_Y + TL_H + 4, { stroke: C.muted, 'stroke-width': 1 }));
    out.push(text(px(t), TL_Y + TL_H + 16, fmtClock(t), { size: 11, fill: C.muted, anchor: 'middle' }));
  }
  out.push(text(TL_X + TL_W, H - 6, 'dialogue · gap ≥ 1.5 s → cue window · rejected silence · dropped window', { size: 12, fill: C.muted, anchor: 'end' }));

  // attribution — on every frame that shows the film
  out.push(text(W - 16, TOP_Y - 12, 'Tears of Steel (CC) Blender Foundation | mango.blender.org', { size: 13, fill: C.muted, anchor: 'end' }));
  return svg(W, H, out);
}

/** opaque to the left of the meter, so the sliding bar is clipped at the meter's edge */
function shieldSvg(m: TimelineModel): string {
  const out: string[] = [];
  out.push(rect(PANEL_X + PANEL_W, BOT_METER_Y - 10, METER_X - PANEL_X - PANEL_W, METER_H + 20, { fill: C.bg }));
  out.push(text(COL_X, BOT_METER_Y + 14, 'film audio', { size: 16, fill: C.muted }));
  const tick = METER_X + METER_W * (m.limits.duck_target_pct / 100);
  out.push(line(tick, BOT_METER_Y - 6, tick, BOT_METER_Y + METER_H + 6, { stroke: C.text, 'stroke-width': 2 }));
  return svg(W, H, out);
}

function badgeSvg(bx: number, by: number, label: string, color: string, note: string, nx: number, ny: number): string {
  const out: string[] = [];
  const bw = label.length * 12 + 28;
  out.push(rect(bx, by, bw, 30, { fill: color, rx: 4 }));
  out.push(text(bx + bw / 2, by + 21, label, { size: 16, weight: 700, fill: C.bg, anchor: 'middle' }));
  wrap(note, Math.floor(COL_W / 9)).forEach((ln, i) => out.push(text(nx, ny + i * 22, ln, { size: 16, fill: C.text })));
  return svg(W, H, out);
}

function captionSvg(m: TimelineModel, c: ResolvedCue): string {
  const out: string[] = [];
  const lines = wrap(c.text, Math.floor((PANEL_W - 40) / 11));
  const bandH = 18 + lines.length * 28;
  const bandY = BOT_Y + PANEL_H - bandH - 10;
  out.push(rect(PANEL_X + 10, bandY, PANEL_W - 20, bandH, { fill: '#000000', 'fill-opacity': 0.72, rx: 6 }));
  lines.forEach((ln, i) =>
    out.push(text(PANEL_X + PANEL_W / 2, bandY + 28 + i * 28, ln, { size: 22, weight: 700, fill: c.placeholder ? C.dropped : '#ffffff', anchor: 'middle' })),
  );
  // the right column: the window's budget, so the words-per-gap rule is on screen
  const w = c.window;
  out.push(text(METER_X, BOT_Y + ROW_DESC, c.placeholder ? 'placeholder · awaiting the generated track' : 'playing', { size: 16, fill: c.placeholder ? C.dropped : C.cue }));
  out.push(text(COL_X, BOT_Y + ROW_INFO, `gap ${w.gap_index} · ${fmtClock(w.start_ms)}–${fmtClock(w.end_ms)} · ${(w.duration_ms / 1000).toFixed(1)} s`, { size: 15, fill: C.text }));
  out.push(text(COL_X, BOT_Y + ROW_INFO + 22, `budget ${w.word_target} words at ${m.verbosity} · ceiling ${w.word_ceiling}`, { size: 15, fill: C.muted }));
  return svg(W, H, out);
}
