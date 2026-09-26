import { AD, wordCeiling, wordTarget } from './budget.js';
import type { Verbosity } from './types.js';

export interface Subtitle {
  start_ms: number;
  end_ms: number;
  text: string;
}

export interface Gap {
  index: number;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  /** the subtitle immediately before this gap, or null if the gap opens the asset */
  before: Subtitle | null;
  /** the subtitle immediately after this gap, or null if the gap closes the asset */
  after: Subtitle | null;
}

const TIMING = /^(\d{1,3}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{1,3}:\d{2}:\d{2}[.,]\d{3})/;

export function parseTimestamp(ts: string): number {
  const m = /^(\d{1,3}):(\d{2}):(\d{2})[.,](\d{3})$/.exec(ts.trim());
  if (!m) throw new Error(`INTERSTICE.gaps.badTimestamp ts=${ts}`);
  const [, h, min, s, ms] = m as unknown as [string, string, string, string, string];
  return ((Number(h) * 60 + Number(min)) * 60 + Number(s)) * 1000 + Number(ms);
}

export function parseWebVtt(source: string): Subtitle[] {
  const subs: Subtitle[] = [];
  const blocks = source.replace(/\r\n/g, '\n').split(/\n{2,}/);

  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    const timingLine = lines.find((l) => TIMING.test(l));
    if (!timingLine) continue; // WEBVTT header, NOTE blocks, cue identifiers alone

    const m = TIMING.exec(timingLine)!;
    const start_ms = parseTimestamp(m[1]!);
    const end_ms = parseTimestamp(m[2]!);
    const text = lines
      .slice(lines.indexOf(timingLine) + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '') // strip WebVTT inline tags (<v Speaker>, <i>)
      .trim();

    if (end_ms > start_ms) subs.push({ start_ms, end_ms, text });
  }

  return subs.sort((a, b) => a.start_ms - b.start_ms);
}

/**
 * Overlapping or touching subtitles are one span of speech. Differencing without
 * this step manufactures negative gaps wherever two speakers overlap.
 */
export function mergeSpeech(subs: Subtitle[]): Subtitle[] {
  const merged: Subtitle[] = [];
  for (const s of subs) {
    const last = merged[merged.length - 1];
    if (last && s.start_ms <= last.end_ms) {
      last.end_ms = Math.max(last.end_ms, s.end_ms);
      last.text = `${last.text} ${s.text}`.trim();
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}

/** _facts.yml changes[C7]: every dialogue gap >= limits.ad.min_gap_ms. */
export function findGaps(subs: Subtitle[], assetDurationMs: number): Gap[] {
  const speech = mergeSpeech(subs);
  const gaps: Gap[] = [];
  let cursor = 0;
  let before: Subtitle | null = null;

  const push = (start: number, end: number, after: Subtitle | null) => {
    const duration = end - start;
    if (duration >= AD.MIN_GAP_MS) {
      gaps.push({
        index: gaps.length,
        start_ms: start,
        end_ms: end,
        duration_ms: duration,
        before,
        after,
      });
    }
  };

  for (const s of speech) {
    push(cursor, s.start_ms, s);       // the span before this line of dialogue
    cursor = s.end_ms;
    before = s;
  }
  push(cursor, assetDurationMs, null); // the span after the last line

  return gaps;
}

/**
 * A span of the asset that may be described. Everything outside these windows is
 * NOT content — credits, bumpers, a distributor sting — and a description placed
 * there narrates typography over music.
 *
 * Declared per asset and MEASURED, not inferred: there is no reliable way to tell
 * credits from a wordless scene by looking at the pixels, and the demo asset proves
 * why guessing is unsafe. Tears of Steel puts a 21-second POST-CREDITS SCENE after
 * 119 seconds of credits, so the obvious rule — "drop the trailing gap" — would
 * delete real content, which is exactly the material a sighted viewer keeps and a
 * blind viewer loses.
 */
export interface ContentWindow {
  start_ms: number;
  end_ms: number;
  /** for the log line and the AC19 timeline; not load-bearing */
  label?: string;
}

/**
 * Intersect gaps with the asset's describable windows.
 *
 * An empty window list means the whole asset is content — the previous behaviour,
 * kept deliberately so an asset with no measured windows still produces a track
 * rather than nothing. The cost of that default is describable credits, which is
 * an asset-authoring gap and is stated as one.
 *
 * A gap that straddles a window boundary is CLIPPED, not dropped, and a gap that
 * spans two windows yields one clipped gap per window.
 */
export function clipToContent(gaps: Gap[], windows: ContentWindow[]): Gap[] {
  if (windows.length === 0) return gaps;

  const clipped: Gap[] = [];
  for (const g of gaps) {
    for (const w of windows) {
      const start = Math.max(g.start_ms, w.start_ms);
      const end = Math.min(g.end_ms, w.end_ms);
      if (end - start >= AD.MIN_GAP_MS) {
        clipped.push({ ...g, start_ms: start, end_ms: end, duration_ms: end - start });
      }
    }
  }

  return clipped
    .sort((a, b) => a.start_ms - b.start_ms)
    .map((g, index) => ({ ...g, index }));
}

/**
 * One description window. `changes[C7]` emits these, not gaps — the R13 finding
 * that a gap is not a cue. Five gaps in the demo asset run past 30 seconds and
 * carry 68% of the words; one description covering 167 seconds is not a
 * description, and limits.ad.frames_per_gap_max frames cannot represent it.
 */
export interface CueWindow {
  index: number;
  /** which gap this window came from, so AC19 can draw the split boundaries */
  gap_index: number;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  /** the word count the C9 prompt asks for at the requested verbosity */
  word_target: number;
  /** the count no cue may exceed, whatever the verbosity — the gap is the gap */
  word_ceiling: number;
  /** 1-based position of this window within its gap */
  part_index: number;
  /** how many windows the gap was split into */
  part_count: number;
  before: Subtitle | null;
  after: Subtitle | null;
}

/**
 * Split every gap longer than limits.ad.max_cue_ms into consecutive windows, and
 * drop any window that cannot carry limits.ad.min_useful_words at the requested
 * verbosity.
 *
 * THE CUE COUNT VARIES BY VERBOSITY, and that is deliberate rather than a wart:
 * `concise` asks for 60% of the ceiling, so more short windows fall under the
 * useful-words floor and are dropped. changes[C10] therefore writes one track
 * file per level, each declaring its own cue set — a single track with a shared
 * cue list would be wrong at two of the three levels.
 *
 * The last window of a split gap is whatever remains and may be short; it is
 * kept or dropped by the same floor as any other, with no special case.
 */
export function splitIntoCues(gaps: Gap[], verbosity: Verbosity): CueWindow[] {
  const cues: CueWindow[] = [];

  for (const gap of gaps) {
    const windows = Math.max(1, Math.ceil(gap.duration_ms / AD.MAX_CUE_MS));
    const span = gap.duration_ms / windows;

    for (let i = 0; i < windows; i++) {
      const start_ms = Math.round(gap.start_ms + i * span);
      const end_ms = i === windows - 1 ? gap.end_ms : Math.round(gap.start_ms + (i + 1) * span);
      const duration_ms = end_ms - start_ms;
      const word_target = wordTarget(duration_ms, verbosity);

      // A window too short to say anything is dropped rather than filled with
      // noise. 13 of the demo asset's 38 gaps are 1.5-2 s and yield one or two
      // words at concise.
      if (word_target < AD.MIN_USEFUL_WORDS) continue;

      cues.push({
        index: cues.length,
        gap_index: gap.index,
        start_ms,
        end_ms,
        duration_ms,
        word_target,
        word_ceiling: wordCeiling(duration_ms),
        // part_index/part_count exist so C9 can tell "silence on both sides
        // because this is the middle of one long gap" from "silence on both
        // sides because this gap opens or closes the film". Both present as
        // before === null && after === null, and they need opposite prompts.
        part_index: i + 1,
        part_count: windows,
        // Only the first and last window of a gap touch real dialogue. A middle
        // window has silence on both sides, and Phase 5 must not pretend
        // otherwise when it builds the prompt.
        before: i === 0 ? gap.before : null,
        after: i === windows - 1 ? gap.after : null,
      });
    }
  }

  return cues;
}

export function logCues(cues: CueWindow[], verbosity: Verbosity): void {
  const split = new Set(cues.map((c) => c.gap_index));
  console.log(
    `INTERSTICE.cues.built n=${cues.length} verbosity=${verbosity}` +
      ` from_gaps=${split.size} max_cue_ms=${AD.MAX_CUE_MS}` +
      ` min_useful_words=${AD.MIN_USEFUL_WORDS}`,
  );
}

export function logGaps(gaps: Gap[]): void {
  const durations = gaps.map((g) => g.duration_ms);
  console.log(
    `INTERSTICE.gaps.found n=${gaps.length} min_ms=${AD.MIN_GAP_MS}` +
      ` shortest_ms=${durations.length ? Math.min(...durations) : 0}` +
      ` longest_ms=${durations.length ? Math.max(...durations) : 0}`,
  );
}
