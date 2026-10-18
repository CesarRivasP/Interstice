import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AD } from '../budget.js';
import { buildTimelineModel, fmtClock } from '../../tools/viz/model.js';

/**
 * AC19: the renders are drawn from C7 data, and the figures they print are
 * computed, not typed. This pins the model to the real asset so a strip that
 * says "38 gaps" is saying what `findGaps` says.
 */
const SRT = readFileSync('media/tears-of-steel.en.srt', 'utf8');
const MANIFEST = JSON.parse(readFileSync('media/tears-of-steel.manifest.json', 'utf8'));

describe('tools/viz model', () => {
  const m = buildTimelineModel(SRT, MANIFEST, 'standard');

  // Fails if: the figures the README and the strip print drift from the code
  // that produces them. 76 / 67 / 38 / 18.6% / 78.6% are the R13 measurements.
  it('reproduces the measured figures from the real subtitles', () => {
    expect(m.figures.subtitle_cues).toBe(76);
    expect(m.figures.speech_spans).toBe(67);
    expect(m.figures.gaps).toBe(38);
    expect(m.figures.dialogue_pct).toBe(18.6);
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
