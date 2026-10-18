/**
 * AC19, render 1: the whole film as one strip. Dialogue, silences, the gaps C7
 * accepts, long gaps split into cue windows, and the silences it rejects. Every
 * number printed comes from `buildTimelineModel`, which runs pipeline/gaps.ts.
 */
import { C, group, line, outline, rect, svg, text } from './svg.js';
import { fmtClock, type TimelineModel } from './model.js';

export type Variant = 'video' | 'readme';

interface Layout {
  width: number;
  height: number;
  margin: number;
  title: number;
  stats: boolean;
  zoom: [number, number] | null;
  /** the split-screen clip, bracketed on the strip so the two renders line up */
  clip: [number, number] | null;
}

const LAYOUTS: Record<Variant, Layout> = {
  video: { width: 1920, height: 1080, margin: 80, title: 44, stats: true, zoom: [205_000, 295_000], clip: [215_000, 245_000] },
  readme: { width: 1200, height: 440, margin: 40, title: 26, stats: true, zoom: null, clip: null },
};

export interface TimelineOptions {
  variant: Variant;
  zoom?: [number, number] | null;
  clip?: [number, number] | null;
}

export function renderTimeline(m: TimelineModel, opts: TimelineOptions): string {
  const L = { ...LAYOUTS[opts.variant] };
  if (opts.zoom !== undefined) L.zoom = opts.zoom;
  if (opts.clip !== undefined) L.clip = opts.clip;
  const s = L.width / 1920; // every size below is designed at 1920 and scaled
  const out: string[] = [rect(0, 0, L.width, L.height, { fill: C.bg })];

  // --- title ---------------------------------------------------------------
  const f = m.figures;
  let y = L.margin + L.title;
  out.push(
    text(L.margin, y, `Where the description fits — ${titleCase(m.asset_id)}, ${fmtClock(m.duration_ms)}`, {
      size: L.title,
      weight: 700,
    }),
  );
  y += L.title * 0.95;
  out.push(
    text(
      L.margin,
      y,
      `Dialogue covers ${f.dialogue_pct}% of the runtime. Silence of ${m.limits.min_gap_ms / 1000} s or longer covers ${f.silence_pct}%` +
        ` — ${f.silence_in_content_pct}% inside the content windows — and that is where Interstice speaks.`,
      { size: 22 * s, fill: C.muted },
    ),
  );

  // --- figures, computed live -----------------------------------------------
  if (L.stats) {
    y += 30 * s;
    const cards: [string, string][] = [
      ['subtitle cues', String(f.subtitle_cues)],
      ['speech spans', String(f.speech_spans)],
      [`gaps ≥ ${m.limits.min_gap_ms / 1000} s`, String(f.gaps)],
      [`cue windows ≤ ${m.limits.max_cue_ms / 1000} s`, `${f.cue_windows}`],
      ['dialogue', `${f.dialogue_pct}%`],
      ['describable silence', `${f.silence_pct}%`],
    ];
    const gapPx = 16 * s;
    const cw = (L.width - 2 * L.margin - gapPx * (cards.length - 1)) / cards.length;
    const ch = 92 * s;
    cards.forEach(([label, value], i) => {
      const x = L.margin + i * (cw + gapPx);
      out.push(rect(x, y, cw, ch, { fill: C.panel, rx: 8 * s }));
      out.push(text(x + 18 * s, y + 42 * s, value, { size: 34 * s, weight: 700 }));
      out.push(text(x + 18 * s, y + 72 * s, label, { size: 17 * s, fill: C.muted }));
    });
    y += ch + 36 * s;
  }

  // --- the strip ---------------------------------------------------------------
  const stripTop = y;
  const trackX = L.margin + 230 * s;
  const trackW = L.width - L.margin - trackX;
  const strip = renderStrip(m, { x: trackX, y: stripTop, w: trackW, s, from: 0, to: m.duration_ms, dense: false, labelX: L.margin });
  out.push(strip.svg);
  y = strip.bottom;

  if (L.clip) {
    out.push(bracket(trackX, trackW, 0, m.duration_ms, L.clip, y + 6 * s, s, `split-screen clip ${fmtClock(L.clip[0])}–${fmtClock(L.clip[1])}`, C.text));
    y += 34 * s;
  }

  // --- zoom inset ------------------------------------------------------------------
  if (L.zoom) {
    const [z0, z1] = L.zoom;
    out.push(bracket(trackX, trackW, 0, m.duration_ms, L.zoom, y + 6 * s, s, `zoom ${fmtClock(z0)}–${fmtClock(z1)}`, C.muted));
    y += 48 * s;
    out.push(
      text(L.margin, y + 16 * s, `Zoom ${fmtClock(z0)}–${fmtClock(z1)} — one minute and a half, where every rule is visible`, {
        size: 22 * s,
        weight: 700,
      }),
    );
    y += 30 * s;
    const zoom = renderStrip(m, { x: trackX, y, w: trackW, s, from: z0, to: z1, dense: true, labelX: L.margin });
    out.push(zoom.svg);
    y = zoom.bottom;
  }

  // --- legend and footer ---------------------------------------------------------
  y += 34 * s;
  const legend: [string, string, 'fill' | 'outline' | 'tick' | 'hatch'][] = [
    [C.dialogue, 'dialogue (merged subtitle spans)', 'fill'],
    [C.gap, `silence ≥ ${m.limits.min_gap_ms} ms = a gap`, 'fill'],
    [C.cue, `cue window ≤ ${m.limits.max_cue_ms / 1000} s (long gaps are split)`, 'fill'],
    [C.dropped, `window dropped: < ${m.limits.min_useful_words} useful words at ${m.verbosity}`, 'outline'],
    [C.rejected, `silence < ${m.limits.min_gap_ms} ms, rejected (${f.rejected_silences})`, 'tick'],
    [C.credits, 'outside the content windows — not described', 'hatch'],
  ];
  const colW = (L.width - 2 * L.margin) / 3;
  legend.forEach(([color, label, kind], i) => {
    const lx = L.margin + (i % 3) * colW;
    const ly = y + Math.floor(i / 3) * 30 * s;
    const sw = 26 * s;
    if (kind === 'fill') out.push(rect(lx, ly, sw, 16 * s, { fill: color, rx: 2 }));
    if (kind === 'outline') out.push(outline(lx, ly, sw, 16 * s, color, Math.max(2, 2 * s)));
    if (kind === 'tick') out.push(rect(lx + sw / 2 - 2 * s, ly - 2 * s, 4 * s, 20 * s, { fill: color }));
    if (kind === 'hatch') out.push(hatch(lx, ly, sw, 16 * s, s));
    out.push(text(lx + sw + 10 * s, ly + 13 * s, label, { size: 17 * s, fill: C.text }));
  });

  const footY = L.height - L.margin * 0.45;
  out.push(
    text(
      L.margin,
      footY,
      `Rendered from pipeline/gaps.ts (C7) at verbosity ${m.verbosity} · limits.ad: min_gap ${m.limits.min_gap_ms} ms · max_cue ${m.limits.max_cue_ms} ms · min_useful_words ${m.limits.min_useful_words}` +
        ` · ${f.split_gaps} gaps split · ${f.cue_windows_dropped} windows dropped`,
      { size: 15 * s, fill: C.muted },
    ),
  );
  out.push(
    text(L.width - L.margin, footY, 'Tears of Steel (CC) Blender Foundation | mango.blender.org', {
      size: 15 * s,
      fill: C.muted,
      anchor: 'end',
    }),
  );

  return svg(L.width, L.height, out);
}

interface StripSpec {
  x: number;
  y: number;
  w: number;
  s: number;
  from: number;
  to: number;
  /** zoomed: enough pixels per second to label the blocks */
  dense: boolean;
  labelX: number;
}

function renderStrip(m: TimelineModel, sp: StripSpec): { svg: string; bottom: number } {
  const { x, w, s, from, to } = sp;
  const px = (ms: number) => x + ((clamp(ms, from, to) - from) / (to - from)) * w;
  const rowH = 44 * s;
  const rowGap = 20 * s;
  const rows = ['dialogue', `silence ≥ ${m.limits.min_gap_ms / 1000} s → gaps`, `cue windows (${m.verbosity})`];
  const rowY = (i: number) => sp.y + i * (rowH + rowGap);
  const out: string[] = [];
  const minW = sp.dense ? 2 : 1.5; // never let a real span vanish below a pixel

  // content windows: the describable background; outside is hatched
  const bandTop = rowY(0) - 8 * s;
  const bandH = rowY(2) + rowH - bandTop + 8 * s;
  out.push(hatch(x, bandTop, w, bandH, s));
  for (const cw of m.content_windows) {
    const a = px(cw.start_ms);
    const b = px(cw.end_ms);
    if (b > a) out.push(rect(a, bandTop, b - a, bandH, { fill: C.panel }));
    if (!sp.dense && cw.label && b - a > 60 * s) {
      out.push(text(a + 6 * s, bandTop - 6 * s, cw.label, { size: 14 * s, fill: C.muted }));
    }
  }
  if (!sp.dense) {
    const gapsBetween = creditsSpans(m);
    for (const [a0, b0] of gapsBetween) {
      const a = px(a0);
      const b = px(b0);
      if (b - a > 90 * s) out.push(text((a + b) / 2, bandTop - 6 * s, 'credits — not content', { size: 14 * s, fill: C.muted, anchor: 'middle' }));
    }
  }

  // row labels
  rows.forEach((label, i) => {
    out.push(text(sp.labelX, rowY(i) + rowH * 0.64, label, { size: 17 * s, fill: C.text }));
  });

  // row 0: dialogue
  for (const sub of m.speech) {
    if (sub.end_ms < from || sub.start_ms > to) continue;
    const a = px(sub.start_ms);
    const b = px(sub.end_ms);
    out.push(rect(a, rowY(0), Math.max(b - a, minW), rowH, { fill: C.dialogue }));
  }
  // rejected silences, as ticks under the dialogue row
  for (const rj of m.rejected) {
    if (rj.end_ms < from || rj.start_ms > to) continue;
    const a = px(rj.start_ms);
    const b = px(rj.end_ms);
    const cx = (a + b) / 2;
    out.push(rect(cx - 1.5 * s, rowY(0) + rowH + 2 * s, 3 * s, rowGap - 4 * s, { fill: C.rejected }));
  }

  // row 1: gaps (raw in content = teal; raw outside content = hatched already, draw dim)
  for (const g of m.gaps_raw) {
    if (g.end_ms < from || g.start_ms > to) continue;
    const a = px(g.start_ms);
    const b = px(g.end_ms);
    out.push(rect(a, rowY(1), Math.max(b - a, minW), rowH, { fill: C.gap, 'fill-opacity': 0.25 }));
  }
  for (const g of m.gaps) {
    if (g.end_ms < from || g.start_ms > to) continue;
    const a = px(g.start_ms);
    const b = px(g.end_ms);
    out.push(rect(a, rowY(1), Math.max(b - a, minW), rowH, { fill: C.gap }));
    if (sp.dense && b - a > 34 * s) {
      out.push(text((a + b) / 2, rowY(1) + rowH * 0.64, `${(g.duration_ms / 1000).toFixed(1)} s`, { size: 13 * s, fill: C.bg, anchor: 'middle', weight: 700 }));
    }
  }

  // row 2: cue windows, with the split boundaries visible, and the dropped ones outlined
  for (const c of m.cues) {
    if (c.end_ms < from || c.start_ms > to) continue;
    const a = px(c.start_ms);
    const b = px(c.end_ms);
    out.push(rect(a, rowY(2), Math.max(b - a, minW), rowH, { fill: C.cue }));
    if (c.part_index > 1) out.push(line(a, rowY(2), a, rowY(2) + rowH, { stroke: C.bg, 'stroke-width': Math.max(1.5, 2 * s) }));
    if (sp.dense && b - a > 40 * s) {
      const label = c.part_count > 1 ? `${c.part_index}/${c.part_count} · ${c.word_target} w` : `${c.word_target} w`;
      out.push(text((a + b) / 2, rowY(2) + rowH * 0.64, label, { size: 13 * s, fill: '#fff', anchor: 'middle', weight: 700 }));
    }
  }
  for (const d of m.dropped) {
    if (d.end_ms < from || d.start_ms > to) continue;
    const a = px(d.start_ms);
    const b = px(d.end_ms);
    out.push(rect(a, rowY(2), Math.max(b - a, minW), rowH, { fill: C.dropped, 'fill-opacity': 0.12 }));
    out.push(outline(a, rowY(2), Math.max(b - a, minW), rowH, C.dropped, Math.max(2, 2 * s)));
    if (sp.dense && b - a > 24 * s) {
      out.push(text((a + b) / 2, rowY(2) + rowH * 0.64, `${d.word_target} w`, { size: 12 * s, fill: C.dropped, anchor: 'middle', weight: 700 }));
    }
  }

  // axis
  const axisY = rowY(2) + rowH + 14 * s;
  out.push(line(x, axisY, x + w, axisY, { stroke: C.grid, 'stroke-width': 1 }));
  const span = to - from;
  const step = span > 300_000 ? 60_000 : span > 60_000 ? 10_000 : 5_000;
  for (let t = Math.ceil(from / step) * step; t <= to; t += step) {
    const tx = px(t);
    if (to === m.duration_ms && px(to) - tx < 44 * s && t !== to) continue;
    out.push(line(tx, axisY, tx, axisY + 6 * s, { stroke: C.muted, 'stroke-width': 1 }));
    out.push(text(tx, axisY + 22 * s, fmtClock(t), { size: 13 * s, fill: C.muted, anchor: 'middle' }));
  }
  if (to === m.duration_ms) {
    out.push(text(px(to), axisY + 22 * s, fmtClock(to), { size: 13 * s, fill: C.text, anchor: 'middle', weight: 700 }));
  }

  return { svg: group({}, out), bottom: axisY + 30 * s };
}

function bracket(x: number, w: number, from: number, to: number, range: [number, number], y: number, s: number, label: string, color: string): string {
  const px = (ms: number) => x + ((ms - from) / (to - from)) * w;
  const a = px(range[0]);
  const b = px(range[1]);
  return group({}, [
    line(a, y, b, y, { stroke: color, 'stroke-width': 2 * s }),
    line(a, y - 6 * s, a, y + 6 * s, { stroke: color, 'stroke-width': 2 * s }),
    line(b, y - 6 * s, b, y + 6 * s, { stroke: color, 'stroke-width': 2 * s }),
    text(b + 10 * s, y + 5 * s, label, { size: 14 * s, fill: color }),
  ]);
}

/** the spans between content windows (and after the last one): the credits */
function creditsSpans(m: TimelineModel): [number, number][] {
  const ws = [...m.content_windows].sort((a, b) => a.start_ms - b.start_ms);
  const out: [number, number][] = [];
  let cursor = 0;
  for (const w of ws) {
    if (w.start_ms > cursor) out.push([cursor, w.start_ms]);
    cursor = Math.max(cursor, w.end_ms);
  }
  if (cursor < m.duration_ms) out.push([cursor, m.duration_ms]);
  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function titleCase(id: string): string {
  return id
    .split('-')
    .map((p, i) => (i > 0 && ['of', 'the', 'a', 'and'].includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

/** diagonal hatching drawn as lines: ImageMagick's SVG renderer has no <pattern> */
function hatch(x: number, y: number, w: number, h: number, s: number): string {
  const out: string[] = [rect(x, y, w, h, { fill: C.credits })];
  const step = 10 * s;
  for (let d = -h; d < w; d += step) {
    // the segment of the 45° line x - x0 = d + (y - y0) that lies inside the box
    const x1 = x + Math.max(d, 0);
    const y1 = y + Math.max(-d, 0);
    const x2 = x + Math.min(d + h, w);
    const y2 = y + Math.min(w - d, h);
    if (x2 > x1) out.push(line(x1, y1, x2, y2, { stroke: '#3a4656', 'stroke-width': 1.5 * s }));
  }
  return group({}, out);
}
