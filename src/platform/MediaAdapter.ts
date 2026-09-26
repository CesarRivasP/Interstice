import type { ComponentType } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * The only surface the app uses to reach the platform. Implementations live in
 * `src/platform/<platform>/`. No file outside `src/platform/` may import a
 * platform module directly — that is what makes `changes[C12]` a real package
 * rather than a Vega app with a package-shaped README.
 *
 * The structural assertion, which a program can run:
 *
 *   rg -n "@amazon-devices/react-native-w3cmedia" src/ --glob '!src/platform/**'
 *
 * must return nothing.
 */

export type Unsubscribe = () => void;

export interface VideoPlayer {
  /**
   * Point the player at an asset and get it ready to play.
   *
   * Implementations must NOT assume the platform will fetch the URI. On Vega it
   * will not (`limits.vega_media.url_mode_broken`) and the implementation reads
   * the bytes itself. Kept out of this interface deliberately: a caller that had
   * to know would leak one platform's defect into every other.
   */
  open(uri: string): Promise<void>;
  play(): Promise<void>;
  pause(): void;

  /** current playback position, ms */
  positionMs(): number;
  durationMs(): number;
  isPlaying(): boolean;

  /**
   * Set the main track volume as a percentage of full, EFFECTIVE IMMEDIATELY.
   *
   * There is no ramp parameter, and its absence is measured rather than chosen:
   * `limits.vega_media.no_volume_ramp` — the W3C volume setter is instantaneous
   * and the platform exposes no fade. `limits.ad.duck_ramp_ms` is implemented in
   * JS, once, in `src/ad/duck.ts`, and never per platform. An interface that
   * accepted `rampMs` would invite every implementation to reimplement the same
   * loop and would imply a capability no platform here has.
   */
  setVolumePct(pct: number): void;

  /** fires on every position update the platform emits ('timeupdate') */
  onPosition(cb: (ms: number) => void): Unsubscribe;
  /** fires after a seek settles, with the new position ('seeked') */
  onSeek(cb: (ms: number) => void): Unsubscribe;
  /**
   * Fires when playback cannot continue because the buffer ran dry
   * ('waiting' / 'stalled').
   *
   * `R21-F3`: with the app owning byte delivery this is a REACHABLE state and it
   * is NOT an error — no `error` event follows it. A UI that only listens for
   * `onError` shows a frozen picture and says nothing, which for this app's
   * users is indistinguishable from the film having stopped being interesting.
   */
  onStalled(cb: () => void): Unsubscribe;
  /**
   * Fires when playback is actually running ('playing').
   *
   * The counterpart to `onStalled`, and not optional: MSE emits `waiting` at the
   * START of normal playback while the first frames decode, so a screen that
   * treats stalling as terminal shows "Buffering" over a film that is playing
   * fine. Measured on the device in R28 — 2 ms after `play()` resolved.
   */
  onPlaying(cb: () => void): Unsubscribe;
  onEnded(cb: () => void): Unsubscribe;
  onError(cb: (err: Error) => void): Unsubscribe;

  /** release everything; safe to call twice */
  destroy(): Promise<void>;
}

export interface ClipPlayer {
  /**
   * Plays one description clip to completion; rejects if it cannot be played.
   * Same rule as `VideoPlayer.open`: no implementation may assume the platform
   * fetches the URI.
   */
  play(uri: string): Promise<void>;
  stop(): void;
}

export interface AppLifecycle {
  /** fires when the app leaves the foreground */
  onBackground(cb: () => void): Unsubscribe;
}

export interface VideoSurfaceProps {
  style?: StyleProp<ViewStyle>;
}

export interface MediaAdapter {
  video: VideoPlayer;
  clips: ClipPlayer;
  lifecycle: AppLifecycle;
  /**
   * The platform's own view that decoded pixels render into, already wired to
   * `video`.
   *
   * It is part of the adapter rather than something the screen imports, because
   * mounting it IS platform code: on Vega it is `KeplerVideoSurfaceView` and the
   * handle it hands back has to reach the player (`defects[D1]` — pixels never
   * enter JavaScript). A screen that imported the surface directly would put a
   * platform symbol back in `src/screens/`, which is the one thing this seam
   * exists to prevent.
   */
  VideoSurface: ComponentType<VideoSurfaceProps>;
}
