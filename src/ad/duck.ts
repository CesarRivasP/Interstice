import type { VideoPlayer } from '../platform/MediaAdapter';
import { AD } from '../../pipeline/budget';

/** how often the fade writes; a floor, since timers on the device fire late */
const STEP_MS = 16;

/**
 * Fade the main track between two volume percentages over `rampMs`.
 *
 * `limits.vega_media.no_volume_ramp`: the platform setter is instantaneous, so
 * the ramp is stepped here. Written once, in one place, because a fade
 * duplicated per platform is a fade that differs per platform — which is also
 * why `MediaAdapter.VideoPlayer.setVolumePct` takes no `rampMs`.
 *
 * Each step sets the level for the time ELAPSED, not for its step number.
 * Measured 2026-09-27 on the Virtual Device: a fade counted as 13 steps of
 * 16 ms took ~510 ms instead of 200, because timers fire late there, and three
 * of four cues brought the film back up after their window had closed (AC4).
 */
export async function rampVolumePct(
  video: VideoPlayer,
  fromPct: number,
  toPct: number,
  rampMs: number = AD.DUCK_RAMP_MS,
  /**
   * Checked between steps. A fade is a loop that outlives the reason it
   * started: unmount the screen mid-duck and it keeps stepping the volume of a
   * player that is being torn down, toward a target nobody wants any more.
   */
  isCancelled: () => boolean = () => false,
): Promise<void> {
  const start = Date.now();
  for (;;) {
    if (isCancelled()) return;
    const t = rampMs > 0 ? Math.min(1, (Date.now() - start) / rampMs) : 1;
    // t reaches exactly 1, so the fade lands exactly on the target: AC5 is
    // asserted against the final value, and rounding must never leave the film
    // at 99% forever.
    video.setVolumePct(t >= 1 ? toPct : fromPct + (toPct - fromPct) * t);
    if (t >= 1) return;
    await new Promise((r) => setTimeout(r, STEP_MS));
  }
}
