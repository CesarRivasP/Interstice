import React, {useCallback, useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {
  KeplerVideoSurfaceView,
  MediaSource,
  VideoPlayer,
} from '@amazon-devices/react-native-w3cmedia';
import {playCue} from '../ad/DescriptionAudio';
import {log} from '../diagnostics';

/**
 * First increment of changes[C2]. Its job is to prove the Vega Virtual Device
 * decodes and renders the demo asset — the half of defects[D3] that "installs
 * and runs" did not cover.
 *
 * Vega media is W3C MSE/EME (_facts.yml limits.vega_media). VideoPlayer does not
 * render by itself: the app mounts a KeplerVideoSurfaceView, receives the surface
 * handle in onSurfaceViewCreated, and passes it to the player. Decoded pixels go
 * to that native surface and never reach JavaScript, which is why defects[D1] is
 * false and changes[C11] will not ship.
 *
 * PLAYBACK GOES THROUGH MSE, NOT `src`. See limits.vega_media.url_mode_broken:
 * on this SDK, assigning a URL to `src` fails with MEDIA_ERR_SRC_NOT_SUPPORTED
 * before a single byte is requested — for a remote URL, a packaged file and an
 * AudioPlayer alike. Handing the same bytes to the same player through a
 * MediaSource plays them. So this screen fetches the asset itself and appends it.
 */

export interface PlayerScreenProps {
  /** URI of the asset to play. JavaScript fetches it; the player never sees it. */
  uri: string;
  /**
   * One description cue, fired once shortly after playback starts.
   *
   * TEMPORARY, and it is the runtime test for defects[D6] and defects[D2] —
   * changes[C3] replaces this with a scheduler driven by the gap timeline. It
   * lives here rather than in a separate probe app because the question is
   * whether a cue plays WHILE the film is playing, which needs both players
   * alive in one process.
   */
  cueUri?: string;
}

type Status = 'initialising' | 'playing' | 'error';

/**
 * The demo asset's codecs, measured with ffprobe: H.264 Constrained Baseline
 * L3.0 (avc1.42C01E) and AAC-LC (mp4a.40.2). MSE requires the exact codec
 * parameters — a bare 'video/mp4' is rejected at addSourceBuffer.
 */
const MIME = 'video/mp4; codecs="avc1.42C01E,mp4a.40.2"';

export function PlayerScreen({uri, cueUri}: PlayerScreenProps) {
  const cueFired = useRef(false);
  const player = useRef<VideoPlayer | null>(null);
  const surface = useRef<string | null>(null);
  const [status, setStatus] = useState<Status>('initialising');
  const [detail, setDetail] = useState<string>('');

  // Two asynchronous readiness signals, and playback needs BOTH.
  //
  // The player initialises asynchronously and the platform hands over the video
  // surface asynchronously, in no guaranteed order. Measured on the Virtual
  // Device: the surface arrived 26 ms BEFORE initialize() resolved. A surface
  // callback that calls play() directly therefore plays a player that has no
  // media attached yet, and gets MEDIA_ERR_SRC_NOT_SUPPORTED (code 4) — which
  // reads exactly like an unsupported file and is not one.
  const ready = useRef({player: false, surface: false});

  const startIfReady = useCallback(() => {
    const p = player.current;
    if (!p || !ready.current.player || !ready.current.surface) return;
    log('INTERSTICE.player.ready buffered=appended');
    p.play()
      .then(() => log('INTERSTICE.player.play resolved'))
      .catch((err: Error) =>
        log(`INTERSTICE.player.play rejected err=${err.message}`),
      );
  }, []);

  useEffect(() => {
    let cancelled = false;
    const p = new VideoPlayer();
    player.current = p;

    (async () => {
      try {
        await p.initialize();
        if (cancelled) return;

        p.addEventListener('error', () => {
          const code = p.error?.code ?? -1;
          // The native TurboModule carries the real reason in `message`; the
          // numeric code alone is almost always MEDIA_ERR_SRC_NOT_SUPPORTED and
          // says nothing about which of a dozen causes fired.
          const msg = (p.error as {message?: string} | null)?.message ?? 'none';
          log(`INTERSTICE.player.error code=${code} msg=${msg}`);
          setStatus('error');
          setDetail(`media error ${code}`);
        });
        p.addEventListener('loadedmetadata', () => {
          log(
            `INTERSTICE.player.loaded duration_s=${p.duration.toFixed(1)}` +
              ` w=${p.videoWidth} h=${p.videoHeight}`,
          );
        });
        p.addEventListener('canplay', () => log('INTERSTICE.player.canplay'));
        p.addEventListener('resize', () =>
          log(`INTERSTICE.player.resize w=${p.videoWidth} h=${p.videoHeight}`),
        );
        p.addEventListener('playing', () => {
          log(`INTERSTICE.player.playing w=${p.videoWidth} h=${p.videoHeight}`);
          setStatus('playing');

          // D6/D2 probe: one cue, two seconds in, over a film that is playing.
          if (cueUri && !cueFired.current) {
            cueFired.current = true;
            setTimeout(() => {
              log('INTERSTICE.cue.fire');
              playCue(cueUri, p);
            }, 2000);
          }
          // w=0/h=0 at loadedmetadata is the signature of audio-only playback,
          // and this app cannot tell the difference by looking. Sampling the
          // clock and the frame size a few seconds in distinguishes a decoding
          // video track from a soundtrack over a black surface.
          setTimeout(() => {
            // videoWidth only updates on a 'resize' event (VideoPlayer.js:225),
            // so w=0 proves nothing on its own. Decoded FRAME COUNT does: a
            // soundtrack over a black surface cannot produce one.
            const q = p.getVideoPlaybackQuality();
            log(
              `INTERSTICE.player.progress t=${p.currentTime.toFixed(2)}` +
                ` w=${p.videoWidth} h=${p.videoHeight} paused=${p.paused}` +
                ` frames=${q.totalVideoFrames} dropped=${q.droppedVideoFrames}`,
            );
          }, 4000);
        });

        const supported = MediaSource.isTypeSupported(MIME);
        log(
          `INTERSTICE.player.init ok=true mse_supported=${supported} uri=${uri}`,
        );
        if (!supported) {
          setStatus('error');
          setDetail('this device cannot decode the demo asset');
          return;
        }

        const mediaSource = new MediaSource();

        const onSourceOpen = async () => {
          try {
            const buffer = mediaSource.addSourceBuffer(MIME);

            // One append. The demo clip is 2.6 MB; a full feature would be
            // appended in chunks against SourceBuffer.updating, which is
            // changes[C2]'s problem and not this increment's.
            const response = await fetch(uri);
            const bytes = new Uint8Array(await response.arrayBuffer());
            log(`INTERSTICE.player.fetched bytes=${bytes.byteLength}`);

            buffer.addEventListener('updateend', () => {
              if (mediaSource.readyState !== 'open') return;
              mediaSource.endOfStream();
              log(
                'INTERSTICE.player.appended readyState=' +
                  mediaSource.readyState,
              );
              ready.current.player = true;
              startIfReady();
            });

            buffer.appendBuffer(bytes);
          } catch (err) {
            log(
              `INTERSTICE.player.append failed err=${(err as Error).message}`,
            );
            setStatus('error');
            setDetail((err as Error).message);
          }
        };

        mediaSource.addEventListener('sourceopen', () => {
          onSourceOpen().catch(() => {
            // onSourceOpen handles its own failures; this guard only keeps an
            // unexpected one from becoming an unhandled rejection.
          });
        });

        // srcObject, NOT src. The `src` path is the broken one.
        p.srcObject = mediaSource;
      } catch (err) {
        log(`INTERSTICE.player.init ok=false err=${(err as Error).message}`);
        setStatus('error');
        setDetail((err as Error).message);
      }
    })();

    return () => {
      cancelled = true;
      ready.current = {player: false, surface: false};
      p.deinitialize().catch(() => {
        // best-effort during unmount; must not throw into React's cleanup path
      });
    };
  }, [uri, cueUri, startIfReady]);

  const onSurfaceViewCreated = useCallback(
    (handle: string) => {
      log(`INTERSTICE.player.surface created handle=${handle}`);
      surface.current = handle;
      player.current?.setSurfaceHandle(handle);
      ready.current.surface = true;
      startIfReady();
    },
    [startIfReady],
  );

  const onSurfaceViewDestroyed = useCallback((handle: string) => {
    log(`INTERSTICE.player.surface destroyed handle=${handle}`);
    player.current?.clearSurfaceHandle(handle);
    surface.current = null;
    ready.current.surface = false;
  }, []);

  return (
    <View style={styles.root}>
      <KeplerVideoSurfaceView
        style={StyleSheet.absoluteFill}
        scalingmode="fit"
        onSurfaceViewCreated={onSurfaceViewCreated}
        onSurfaceViewDestroyed={onSurfaceViewDestroyed}
      />
      {status !== 'playing' && (
        <View
          style={styles.overlay}
          accessible
          accessibilityRole={status === 'error' ? 'alert' : 'progressbar'}
          accessibilityLabel={
            status === 'error'
              ? `This title could not be played. ${detail}`
              : 'Loading title'
          }>
          <Text style={styles.text}>
            {status === 'error'
              ? `Could not play this title — ${detail}`
              : 'Loading…'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000'},
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {color: '#fff', fontSize: 28},
});
