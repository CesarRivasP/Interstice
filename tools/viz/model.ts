/**
 * The data behind both AC19 renders. Nothing here draws: this module runs C7
 * (`pipeline/gaps.ts`) over an asset's subtitles and manifest and returns every
 * number the strip and the split-screen print, so the figures on screen are
 * computed from the same functions the pipeline ships — never typed in.
 */
import { AD, VERBOSITY_SCALES, wordTarget } from '../../pipeline/budget.js';
import {
  clipToContent,
  findGaps,
  mergeSpeech,
  parseWebVtt,
  splitIntoCues,
  type ContentWindow,
  type CueWindow,
  type Gap,
  type Subtitle,
} from '../../pipeline/gaps.js';
import type { Verbosity } from '../../pipeline/types.js';

export interface AssetManifestLike {
  asset_id: string;
  duration_ms: number;
  content_windows: ContentWindow[] | null;
}

/** A silence between two merged speech spans that C7 did not accept. */
export interface RejectedSilence {
  start_ms: number;
  end_ms: number;
  duration_ms: number;
}

/**
 * A window `splitIntoCues` produced and then dropped because its word target at
 * this verbosity is under limits.ad.min_useful_words. Recomputed here with the
 * same arithmetic, because C7 drops them silently and the strip must show them.
 */
export interface DroppedWindow {
  gap_index: number;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  word_target: number;
}

export interface TimelineModel {
  asset_id: string;
  duration_ms: number;
  verbosity: Verbosity;
  content_windows: ContentWindow[];
  subtitles: Subtitle[];
  speech: Subtitle[];
  /** every silence >= min_gap_ms, before the content-window clip (38 on the demo asset) */
  gaps_raw: Gap[];
  /** the raw gaps intersected with content windows — what C7 hands to C8/C9 (39) */
  gaps: Gap[];
  cues: CueWindow[];
  dropped: DroppedWindow[];
  rejected: RejectedSilence[];
  figures: {
    subtitle_cues: number;
    speech_spans: number;
    /** raw gaps, before clipToContent — a secondary figure, not the canonical one */
    gaps: number;
    /** gaps after clipToContent — the canonical count (worst_case.gaps_detected) */
    gaps_in_content: number;
    cue_windows: number;
    cue_windows_dropped: number;
    split_gaps: number;
    rejected_silences: number;
    dialogue_ms: number;
    dialogue_pct: number;
    silence_ms: number;
    silence_pct: number;
    /** describable silence after clipping, as % of the whole asset (worst_case.describable_pct) */
    silence_in_content_ms: number;
    silence_in_content_pct: number;
    /** total length of the content windows (the whole asset when none are declared) */
    content_ms: number;
    /** describable silence after clipping, as % of the content itself — the headline figure */
    describable_of_content_pct: number;
    longest_gap_ms: number;
  };
  limits: {
    min_gap_ms: number;
    max_cue_ms: number;
    min_useful_words: number;
    duck_target_pct: number;
    duck_ramp_ms: number;
    verbosity_scale: number;
  };
}

export function buildTimelineModel(
  srt: string,
  manifest: AssetManifestLike,
  verbosity: Verbosity = 'standard',
): TimelineModel {
  const subtitles = parseWebVtt(srt);
  const speech = mergeSpeech(subtitles);
  const content_windows = manifest.content_windows ?? [];
  const gaps_raw = findGaps(subtitles, manifest.duration_ms);
  const gaps = clipToContent(gaps_raw, content_windows);
  const cues = splitIntoCues(gaps, verbosity);

  const rejected: RejectedSilence[] = [];
  for (let i = 1; i < speech.length; i++) {
    const prev = speech[i - 1]!;
    const next = speech[i]!;
    const d = next.start_ms - prev.end_ms;
    if (d > 0 && d < AD.MIN_GAP_MS) {
      rejected.push({ start_ms: prev.end_ms, end_ms: next.start_ms, duration_ms: d });
    }
  }

  const dropped = droppedWindows(gaps, cues, verbosity);

  const sum = (xs: { duration_ms: number }[]) => xs.reduce((a, x) => a + x.duration_ms, 0);
  const dialogue_ms = speech.reduce((a, s) => a + s.end_ms - s.start_ms, 0);
  const silence_ms = sum(gaps_raw);
  const silence_in_content_ms = sum(gaps);
  const content_ms = content_windows.length ? sum(content_windows.map((w) => ({ duration_ms: w.end_ms - w.start_ms }))) : manifest.duration_ms;
  const pctOf = (ms: number, of: number) => Math.round((ms / of) * 1000) / 10;
  const pct = (ms: number) => pctOf(ms, manifest.duration_ms);

  return {
    asset_id: manifest.asset_id,
    duration_ms: manifest.duration_ms,
    verbosity,
    content_windows,
    subtitles,
    speech,
    gaps_raw,
    gaps,
    cues,
    dropped,
    rejected,
    figures: {
      subtitle_cues: subtitles.length,
      speech_spans: speech.length,
      gaps: gaps_raw.length,
      gaps_in_content: gaps.length,
      cue_windows: cues.length,
      cue_windows_dropped: dropped.length,
      split_gaps: gaps.filter((g) => g.duration_ms > AD.MAX_CUE_MS).length,
      rejected_silences: rejected.length,
      dialogue_ms,
      dialogue_pct: pct(dialogue_ms),
      silence_ms,
      silence_pct: pct(silence_ms),
      silence_in_content_ms,
      silence_in_content_pct: pct(silence_in_content_ms),
      content_ms,
      describable_of_content_pct: pctOf(silence_in_content_ms, content_ms),
      longest_gap_ms: gaps_raw.reduce((a, g) => Math.max(a, g.duration_ms), 0),
    },
    limits: {
      min_gap_ms: AD.MIN_GAP_MS,
      max_cue_ms: AD.MAX_CUE_MS,
      min_useful_words: AD.MIN_USEFUL_WORDS,
      duck_target_pct: AD.DUCK_TARGET_PCT,
      duck_ramp_ms: AD.DUCK_RAMP_MS,
      verbosity_scale: VERBOSITY_SCALES[verbosity],
    },
  };
}

/**
 * Re-walk the windows `splitIntoCues` cuts and report the ones it dropped. The
 * split arithmetic is repeated verbatim from pipeline/gaps.ts so the two agree
 * window for window; a kept window is one that appears in `cues`.
 */
function droppedWindows(gaps: Gap[], cues: CueWindow[], verbosity: Verbosity): DroppedWindow[] {
  const kept = new Set(cues.map((c) => `${c.gap_index}:${c.start_ms}`));
  const out: DroppedWindow[] = [];
  for (const gap of gaps) {
    const windows = Math.max(1, Math.ceil(gap.duration_ms / AD.MAX_CUE_MS));
    const span = gap.duration_ms / windows;
    for (let i = 0; i < windows; i++) {
      const start_ms = Math.round(gap.start_ms + i * span);
      const end_ms = i === windows - 1 ? gap.end_ms : Math.round(gap.start_ms + (i + 1) * span);
      if (kept.has(`${gap.index}:${start_ms}`)) continue;
      const duration_ms = end_ms - start_ms;
      out.push({
        gap_index: gap.index,
        start_ms,
        end_ms,
        duration_ms,
        word_target: wordTarget(duration_ms, verbosity),
      });
    }
  }
  return out;
}

export function fmtClock(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtSeconds(ms: number, digits = 1): string {
  return `${(ms / 1000).toFixed(digits)} s`;
}
