import type { MediaAdapter } from '../platform/MediaAdapter';
import { AD } from '../../pipeline/budget';
import type { DescriptionCue } from '../../pipeline/types';
import { rampVolumePct } from './duck';
import {log} from '../diagnostics';

/**
 * `_facts.yml changes[C4]` — duck, speak, restore.
 *
 * `defects[D2]` resolved TRUE on 2026-09-25: a cue played its full duration
 * while the film kept decoding with zero dropped frames. So this plays a second
 * stream rather than switching a pre-mixed track, and `decisions.d2_fallback`
 * stays in the registry only for hardware, where concurrency is untested.
 */
export class DescriptionAudio {
  private active = false;
  /**
   * Bumped by `stop()`. A cue in flight when the screen unmounts keeps running —
   * its `await` chain does not know the component is gone — and its `finally`
   * would then ramp the volume on a player that has been destroyed, after
   * `stop()` already restored it. Found by a test complaining that it logged
   * after the run finished, which is the same defect wearing a smaller hat.
   */
  private generation = 0;

  constructor(private readonly media: MediaAdapter) {
    // mobile-tv gap sweep F5: backgrounding during playback must stop the clip
    // and restore the main level, or the app returns ducked and silent.
    this.media.lifecycle.onBackground(() => {
      if (!this.active) return;
      log('INTERSTICE.audio.background active=true');
      void this.stop();
    });
  }

  async speak(cue: DescriptionCue): Promise<void> {
    if (this.active) return; // a cue already speaking is never interrupted by another
    this.active = true;
    const mine = this.generation;
    const stale = () => mine !== this.generation;

    try {
      log(`INTERSTICE.audio.duck id=${cue.id} to_pct=${AD.DUCK_TARGET_PCT}`);
      await rampVolumePct(this.media.video, 100, AD.DUCK_TARGET_PCT, undefined, stale);
      await this.media.clips.play(cue.audio_uri);
      log(`INTERSTICE.audio.spoke id=${cue.id} words=${cue.words}`);
    } catch (err) {
      log(`INTERSTICE.audio.failed id=${cue.id} err=${(err as Error).message}`);
    } finally {
      // AC5: the main track ALWAYS returns to full, including on failure. A cue
      // that fails must not leave the film at 25% for the rest of the runtime.
      //
      // Unless stop() already did it: then this cue is stale, the player may be
      // torn down, and ramping again is work against a dead object.
      if (!stale()) {
        await rampVolumePct(this.media.video, AD.DUCK_TARGET_PCT, 100, undefined, stale);
        // AC5 asserts the main track returns to full. An assertion nobody can
        // observe on the device is an assertion that closes on trust.
        log(`INTERSTICE.audio.restored id=${cue.id}`);
        this.active = false;
      }
    }
  }

  async stop(): Promise<void> {
    this.generation++; // anything in flight is now stale and must not restore
    this.media.clips.stop();
    await rampVolumePct(this.media.video, AD.DUCK_TARGET_PCT, 100);
    this.active = false;
  }
}
