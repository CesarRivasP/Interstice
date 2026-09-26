import React, { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import {
  AudioContentType,
  AudioPlayer,
  AudioUsageType,
  KeplerVideoSurfaceView,
  MediaSource,
  VideoPlayer as VegaVideoPlayer,
} from '@amazon-devices/react-native-w3cmedia';
import type {
  AppLifecycle,
  ClipPlayer,
  MediaAdapter,
  Unsubscribe,
  VideoPlayer,
  VideoSurfaceProps,
} from '../MediaAdapter';
import { log } from '../../diagnostics';

/**
 * The Vega implementation of the seam. Everything in this directory is an
 * EXTRACTION of code that already ran on the device — `src/screens/PlayerScreen.tsx`
 * and `src/ad/DescriptionAudio.ts` as of R20/R21 — not a fresh guess at an API.
 *
 * Do not rewrite these from the interface down. Each of the following is a bug
 * somebody already paid for:
 *   - dual readiness tracking (`limits.vega_media.surface_races_init`): the
 *     surface arrived 26 ms BEFORE initialize() resolved, and playing before
 *     both have landed yields MEDIA_ERR_SRC_NOT_SUPPORTED, which reads exactly
 *     like an unsupported file and is not one;
 *   - `srcObject`, never `src` (`limits.vega_media.url_mode_broken`);
 *   - fragmented MP4 only (`limits.vega_media.mse_path`);
 *   - restoring volume in a `finally`, so a failed cue cannot leave the film at
 *     25% for the rest of the runtime.
 */

/**
 * The demo asset's codecs, measured with ffprobe: H.264 Constrained Baseline
 * L3.0 and AAC-LC. MSE requires exact codec parameters — a bare 'video/mp4' is
 * rejected at addSourceBuffer.
 */
const VIDEO_MIME = 'video/mp4; codecs="avc1.42C01E,mp4a.40.2"';
const CLIP_MIME = 'audio/mp4; codecs="mp4a.40.2"';

type Listener = () => void;

function fetchAndAppend(source: MediaSource, mime: string, uri: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    source.addEventListener('sourceopen', () => {
      (async () => {
        try {
          const buffer = source.addSourceBuffer(mime);

          // WHOLE-FILE APPEND, and it is bounded by the demo clip rather than by
          // design. limits.mse_buffer specifies a window — ahead_s/behind_s in
          // chunk_bytes slices, with SourceBuffer.remove() behind the playhead —
          // and AC23 is the criterion that measures it on the worst device. That
          // work needs contracts.asset_manifest.byte_index to serve a seek and
          // is deliberately NOT in this seam. Anything feature-length will run
          // this process out of heap.
          const response = await fetch(uri);
          const bytes = new Uint8Array(await response.arrayBuffer());

          buffer.addEventListener('updateend', () => {
            if (source.readyState !== 'open') return;
            source.endOfStream();
            resolve(bytes.byteLength);
          });

          buffer.appendBuffer(bytes);
        } catch (err) {
          reject(err as Error);
        }
      })().catch(reject);
    });
  });
}

class VegaVideo implements VideoPlayer {
  readonly player = new VegaVideoPlayer();

  private ready = { player: false, surface: false };
  private pendingPlay: (() => void) | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private initialised: Promise<void> | null = null;
  private lastError: Error | null = null;

  private async initialize(): Promise<void> {
    if (!this.initialised) {
      this.initialised = this.player.initialize().then(() => {
        this.player.addEventListener('error', () => {
          const code = this.player.error?.code ?? -1;
          const msg = (this.player.error as { message?: string } | null)?.message ?? 'none';
          log(`INTERSTICE.player.error code=${code} msg=${msg}`);
          this.lastError = new Error(`media error ${code}: ${msg}`);
          this.emit('error');
        });
        for (const type of ['timeupdate', 'seeked', 'waiting', 'stalled', 'playing', 'ended'] as const) {
          this.player.addEventListener(type, () => this.emit(type));
        }
      });
    }
    return this.initialised;
  }

  private emit(type: string): void {
    for (const cb of this.listeners.get(type) ?? []) cb();
  }

  private on(type: string, cb: Listener): Unsubscribe {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(cb);
    this.listeners.set(type, set);
    return () => set.delete(cb);
  }

  /** called by the surface component when the platform hands over a handle */
  attachSurface(handle: string): void {
    log(`INTERSTICE.player.surface created handle=${handle}`);
    this.player.setSurfaceHandle(handle);
    this.ready.surface = true;
    this.release();
  }

  detachSurface(handle: string): void {
    log(`INTERSTICE.player.surface destroyed handle=${handle}`);
    this.player.clearSurfaceHandle(handle);
    this.ready.surface = false;
  }

  /** whichever of the two readiness signals lands second lets playback start */
  private release(): void {
    if (!this.ready.player || !this.ready.surface) return;
    const go = this.pendingPlay;
    this.pendingPlay = null;
    go?.();
  }

  async open(uri: string): Promise<void> {
    await this.initialize();

    const source = new MediaSource();
    const appended = fetchAndAppend(source, VIDEO_MIME, uri);

    // srcObject, NOT src — see limits.vega_media.url_mode_broken.
    this.player.srcObject = source;

    const bytes = await appended;
    log(`INTERSTICE.player.opened bytes=${bytes} uri=${uri}`);
    this.ready.player = true;
    this.release();
  }

  play(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const start = () => {
        this.player
          .play()
          .then(() => {
            log('INTERSTICE.player.play resolved');
            resolve();
          })
          .catch(reject);
      };
      if (this.ready.player && this.ready.surface) start();
      else this.pendingPlay = start; // the surface race, handled once, here
    });
  }

  pause(): void {
    this.player.pause();
  }

  positionMs(): number {
    return Math.round(this.player.currentTime * 1000);
  }

  durationMs(): number {
    const d = this.player.duration;
    return Number.isFinite(d) ? Math.round(d * 1000) : 0;
  }

  isPlaying(): boolean {
    return !this.player.paused;
  }

  setVolumePct(pct: number): void {
    this.player.volume = Math.max(0, Math.min(100, pct)) / 100;
  }

  onPosition(cb: (ms: number) => void): Unsubscribe {
    return this.on('timeupdate', () => cb(this.positionMs()));
  }

  onSeek(cb: (ms: number) => void): Unsubscribe {
    return this.on('seeked', () => cb(this.positionMs()));
  }

  onStalled(cb: () => void): Unsubscribe {
    const offWaiting = this.on('waiting', cb);
    const offStalled = this.on('stalled', cb);
    return () => {
      offWaiting();
      offStalled();
    };
  }

  onPlaying(cb: () => void): Unsubscribe {
    return this.on('playing', cb);
  }

  onEnded(cb: () => void): Unsubscribe {
    return this.on('ended', cb);
  }

  onError(cb: (err: Error) => void): Unsubscribe {
    return this.on('error', () => cb(this.lastError ?? new Error('media error')));
  }

  async destroy(): Promise<void> {
    this.listeners.clear();
    this.ready = { player: false, surface: false };
    this.pendingPlay = null;
    await this.player.deinitialize().catch(() => {
      // best effort during teardown; must not throw into React's cleanup path
    });
  }
}

class VegaClips implements ClipPlayer {
  private current: AudioPlayer | null = null;

  async play(uri: string): Promise<void> {
    const player = new AudioPlayer(
      AudioContentType.CONTENT_TYPE_SPEECH,
      AudioUsageType.USAGE_ACCESSIBILITY,
    );
    this.current = player;

    try {
      await player.initialize();

      if (!MediaSource.isTypeSupported(CLIP_MIME)) {
        throw new Error(`cue container unsupported: ${CLIP_MIME}`);
      }

      const source = new MediaSource();
      const appended = fetchAndAppend(source, CLIP_MIME, uri);
      player.srcObject = source;
      const bytes = await appended;
      log(`INTERSTICE.cue.audio bytes=${bytes}`);

      await new Promise<void>((resolve, reject) => {
        player.addEventListener('error', () => {
          const code = player.error?.code ?? -1;
          reject(new Error(`cue media error ${code}`));
        });
        player.addEventListener('ended', () => {
          log(`INTERSTICE.cue.audio state=ended t=${player.currentTime.toFixed(2)}`);
          resolve();
        });
        player.play().catch(reject);
      });
    } finally {
      this.current = null;
      await player.deinitialize().catch(() => {
        // a cue that cannot be torn down must not stop the film
      });
    }
  }

  stop(): void {
    this.current?.pause();
  }
}

class VegaLifecycle implements AppLifecycle {
  onBackground(cb: () => void): Unsubscribe {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') cb();
    });
    return () => sub.remove();
  }
}

export function createVegaAdapter(): MediaAdapter {
  const video = new VegaVideo();

  function VideoSurface({ style }: VideoSurfaceProps) {
    const onCreated = useCallback((handle: string) => video.attachSurface(handle), []);
    const onDestroyed = useCallback((handle: string) => video.detachSurface(handle), []);

    useEffect(() => () => undefined, []);

    return (
      <KeplerVideoSurfaceView
        style={style}
        scalingmode="fit"
        onSurfaceViewCreated={onCreated}
        onSurfaceViewDestroyed={onDestroyed}
      />
    );
  }

  return {
    video,
    clips: new VegaClips(),
    lifecycle: new VegaLifecycle(),
    VideoSurface,
  };
}
