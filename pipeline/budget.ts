import type { Verbosity } from './types.js';

/** _facts.yml limits.ad */
export const AD = {
  MIN_GAP_MS: 1500,            // limits.ad.min_gap_ms
  SPEAKING_RATE_WPM: 160,      // limits.ad.speaking_rate_wpm
  DUCK_TARGET_PCT: 25,         // limits.ad.duck_target_pct
  DUCK_RAMP_MS: 200,           // limits.ad.duck_ramp_ms
  FRAMES_PER_GAP_MAX: 3,       // limits.ad.frames_per_gap_max
  ROLLING_CONTEXT_CUES: 10,    // limits.ad.rolling_context_cues
  BUDGET_MARGIN_MS: 300,       // the `- 300` in limits.ad.max_words_per_cue
} as const;

/**
 * _facts.yml limits.ad.verbosity_scales — TARGETS as a fraction of the physical
 * ceiling, never multipliers of it. Every value is <= 1.0 by construction.
 */
export const VERBOSITY_SCALES: Record<Verbosity, number> = {
  concise: 0.6,
  standard: 0.85,
  detailed: 1.0,
};

/** _facts.yml limits.clip_cache.max_clips_in_memory */
export const MAX_CLIPS_IN_MEMORY = 8;

/** _facts.yml limits.bedrock.on_throttle — "exponential backoff, max 5 attempts" */
export const MAX_ATTEMPTS = 5;

function wordsIn(ms: number): number {
  return Math.floor((ms / 1000) * AD.SPEAKING_RATE_WPM / 60);
}

/**
 * _facts.yml limits.ad.max_words_per_cue:
 *   floor((gap_ms - 300) / 1000 * 160 / 60)
 * This is the STANDARD-level budget. The 300 ms subtrahend is the duck ramp
 * (200 ms) plus a 100 ms margin.
 */
export function baseWordBudget(gapMs: number): number {
  return Math.max(0, wordsIn(gapMs - AD.BUDGET_MARGIN_MS));
}

/**
 * The number of words the C9 prompt ASKS FOR at this level. Always <= the
 * ceiling, so no clamp is needed and none exists.
 */
export function wordTarget(gapMs: number, verbosity: Verbosity): number {
  return Math.floor(baseWordBudget(gapMs) * VERBOSITY_SCALES[verbosity]);
}

/**
 * The number of words a cue may not exceed, at any level. This is what C9's
 * shape validation rejects against and what AC4 is scored on. It does not vary
 * by verbosity: the gap is the gap.
 */
export function wordCeiling(gapMs: number): number {
  return baseWordBudget(gapMs);
}
