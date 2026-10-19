import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AD } from '../budget.js';
import { buildTimelineModel, fmtClock } from '../../tools/viz/model.js';

/**
 * AC19: the renders are drawn from C7 data, and the figures they print are
 * computed, not typed. This pins the model to the real asset so a strip that
 * says "39 gaps" is saying what `findGaps` + `clipToContent` say.
 */
const SRT = readFileSync('media/tears-of-steel.en.srt', 'utf8');
const MANIFEST = JSON.parse(readFileSync('media/tears-of-steel.manifest.json', 'utf8'));

describe('tools/viz model', () => {
  const m = buildTimelineModel(SRT, MANIFEST, 'standard');

  // Fails if: the figures the strip leads with drift from the registry and the
  // submission. Canonical, after clipToContent — _facts.yml worst_case:
  // gaps_detected 39, describable_pct 61.5 (of the asset), describable_pct_note
  // 451.8 s = 74.2% of the content, cues_by_verbosity.standard 55, dialogue_pct 18.6.
  it('reproduces the canonical figures from the real subtitles', () => {
    expect(m.figures.subtitle_cues).toBe(76);
    expect(m.figures.speech_spans).toBe(67);
    expect(m.figures.gaps_in_content).toBe(39);
    expect(m.figures.silence_in_content_ms).toBe(451_833);
    expect((m.figures.silence_in_content_ms / 1000).toFixed(1)).toBe('451.8');
    expect(m.figures.describable_of_content_pct).toBe(74.2);
    expect(m.figures.silence_in_content_pct).toBe(61.5);
    expect(m.figures.cue_windows).toBe(55);
    expect(m.figures.dialogue_pct).toBe(18.6);
  });

  // Fails if: the raw R13 figures (before clipToContent) change. The strip still
  // prints 38 in a labelled footer note; 78.6% is no longer printed anywhere,
  // because it counts the credits (_facts.yml: "Was 78.6% until R20").
  it('keeps the raw pre-clip figures as R13 measured them', () => {
    expect(m.figures.gaps).toBe(38);
    expect(m.figures.silence_pct).toBe(78.6);
  });

  // Fails if: a rejected silence is long enough to be a gap, or a gap is short
  // enough to be rejected — the two sets must partition the silences.
  it('separates rejected silences from gaps at min_gap_ms', () => {
    expect(m.rejected.every((r) => r.duration_ms < AD.MIN_GAP_MS)).toBe(true);
    expect(m.gaps_raw.every((g) => g.duration_ms >= AD.MIN_GAP_MS)).toBe(true);
    expect(m.rejected.length).toBeGreaterThan(0);
  });

  // Fails if: the dropped-window walk disagrees with splitIntoCues — every
  // window of every gap is either kept or dropped, never both or neither.
  it('accounts for every window of every gap as kept or dropped', () => {
    for (const gap of m.gaps) {
      const windows = Math.max(1, Math.ceil(gap.duration_ms / AD.MAX_CUE_MS));
      const kept = m.cues.filter((c) => c.gap_index === gap.index).length;
      const dropped = m.dropped.filter((d) => d.gap_index === gap.index).length;
      expect(kept + dropped).toBe(windows);
    }
    expect(m.dropped.every((d) => d.word_target < AD.MIN_USEFUL_WORDS)).toBe(true);
  });

  // Fails if: a dropped window at one level is not dropped at a terser one —
  // the cue count must fall monotonically from detailed to concise.
  it('drops more windows at terser verbosity', () => {
    const concise = buildTimelineModel(SRT, MANIFEST, 'concise');
    const detailed = buildTimelineModel(SRT, MANIFEST, 'detailed');
    expect(concise.figures.cue_windows).toBeLessThan(m.figures.cue_windows);
    expect(m.figures.cue_windows).toBeLessThan(detailed.figures.cue_windows);
  });

  it('formats the runtime axis as m:ss', () => {
    expect(fmtClock(0)).toBe('0:00');
    expect(fmtClock(734_167)).toBe('12:14');
  });
});
