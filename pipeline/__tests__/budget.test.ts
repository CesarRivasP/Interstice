import { describe, expect, it } from 'vitest';
import { VERBOSITY_LEVELS } from '../types.js';
import { baseWordBudget, wordTarget, wordCeiling, VERBOSITY_SCALES } from '../budget.js';

// Every gap size from limits.ad.min_gap_ms upward that a real film produces.
// The loop is the point: a single spot-check at one gap is what hid the
// standard/detailed collapse twice (registry rounds R3 and R8).
const GAPS = [1500, 1600, 1800, 2000, 2500, 3000, 4000, 5000, 8000, 12000];

describe('baseWordBudget — limits.ad.max_words_per_cue', () => {
  it('matches the registry formula at known points', () => {
    expect(baseWordBudget(1500)).toBe(3);
    expect(baseWordBudget(1000)).toBe(1);
  });

  it('never goes negative on a gap shorter than the margin', () => {
    expect(baseWordBudget(200)).toBe(0);
    expect(baseWordBudget(0)).toBe(0);
  });
});

describe('verbosity levels — AC17', () => {
  it('are strictly distinct at every gap size, not just at a convenient one', () => {
    for (const gap of GAPS) {
      const concise = wordTarget(gap, 'concise');
      const standard = wordTarget(gap, 'standard');
      const detailed = wordTarget(gap, 'detailed');
      expect(
        concise < standard && standard < detailed,
        `gap=${gap} collapsed: ${concise}/${standard}/${detailed}`,
      ).toBe(true);
    }
  });

  it('never exceed the ceiling at any level — AC4', () => {
    for (const gap of GAPS) {
      for (const level of VERBOSITY_LEVELS) {
        expect(wordTarget(gap, level)).toBeLessThanOrEqual(wordCeiling(gap));
      }
    }
  });

  it('keeps every scale at or below 1.0 — a level above the ceiling is unreachable', () => {
    for (const level of VERBOSITY_LEVELS) {
      expect(VERBOSITY_SCALES[level]).toBeLessThanOrEqual(1.0);
    }
  });
});

describe('wordCeiling', () => {
  it('does not vary by verbosity — the gap is the gap', () => {
    for (const gap of GAPS) {
      expect(wordCeiling(gap)).toBe(baseWordBudget(gap));
    }
  });
});
