import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  KeplerVideoSurfaceView,
  VideoPlayer,
} from '@amazon-devices/react-native-w3cmedia';
import { log } from '../diagnostics';

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
 */

export interface PlayerScreenProps {
  /** URI of the asset to play. */
  uri: string;
}

type Status = 'initialising' | 'playing' | 'error';

export function PlayerScreen({ uri }: PlayerScreenProps) {
  const player = useRef<VideoPlayer | null>(null);
  const surface = useRef<string | null>(null);
  const [status, setStatus] = useState<Status>('initialising');
  const [detail, setDetail] = useState<string>('');

  // Two asynchronous readiness signals, and playback needs BOTH.
  //
  // The player initialises asynchronously and the platform hands over the video
  // surface asynchronously, in no guaranteed order. Measured on the Virtual
  // Device: the surface arrived 26 ms BEFORE initialize() resolved. A surface
  // callback that calls play() directly therefore plays a player whose src has
  // not been set yet, and gets MEDIA_ERR_SRC_NOT_SUPPORTED (code 4) — which
  // reads exactly like an unsupported file and is not one.
  const ready = useRef({ player: false, surface: false });

  const startIfReady = useCallback(() => {
    const p = player.current;
    if (!p || !ready.current.player || !ready.current.surface) return;
    log(`INTERSTICE.player.ready src=${p.src ? 'set' : 'EMPTY'}`);
    p.play()
      .then(() => log('INTERSTICE.player.play resolved'))
      .catch((err: Error) => log(`INTERSTICE.player.play rejected err=${err.message}`));
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
          log(`INTERSTICE.player.error code=${code}`);
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
        p.addEventListener('playing', () => {
          log('INTERSTICE.player.playing');
          setStatus('playing');
        });

        // Discriminator: can the JS side reach this URL at all? If JS can and
        // the player cannot, the media stack is a separate process that does
        // not share the app's reverse port forwarding.
        fetch(uri, { method: 'GET', headers: { Range: 'bytes=0-1023' } })
          .then((r) =>
            log(
              `INTERSTICE.probe.fetch ok status=${r.status}` +
                ` type=${r.headers.get('content-type') ?? 'none'}`,
            ),
          )
          .catch((e: Error) => log(`INTERSTICE.probe.fetch failed err=${e.message}`));

        const support = p.canPlayType('video/mp4');
        log(
          `INTERSTICE.player.init ok=true canPlayType_mp4=${support || 'empty'} uri=${uri}`,
        );

        p.src = uri;
        p.load();
        ready.current.player = true;
        startIfReady();
      } catch (err) {
        log(`INTERSTICE.player.init ok=false err=${(err as Error).message}`);
        setStatus('error');
        setDetail((err as Error).message);
      }
    })();

    return () => {
      cancelled = true;
      ready.current = { player: false, surface: false };
      p.deinitialize().catch(() => {
        // best-effort during unmount; must not throw into React's cleanup path
      });
    };
  }, [uri, startIfReady]);

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
          }
        >
          <Text style={styles.text}>
            {status === 'error' ? `Could not play this title — ${detail}` : 'Loading…'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: '#fff', fontSize: 28 },
});
