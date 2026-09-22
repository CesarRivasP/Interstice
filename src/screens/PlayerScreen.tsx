import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  KeplerVideoSurfaceView,
  VideoPlayer,
} from '@amazon-devices/react-native-w3cmedia';

/**
 * First increment of changes[C2]. Its only job right now is to prove that the
 * Vega Virtual Device decodes and renders the demo asset — the half of
 * defects[D3] that "installs and runs" did not cover.
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

  // --- create and initialise the player once ---
  useEffect(() => {
    let cancelled = false;
    const p = new VideoPlayer();
    player.current = p;

    (async () => {
      try {
        await p.initialize();
        if (cancelled) return;
        console.log(`INTERSTICE.player.init ok=true uri=${uri}`);

        p.addEventListener('error', () => {
          const code = p.error?.code ?? -1;
          console.log(`INTERSTICE.player.error code=${code}`);
          setStatus('error');
          setDetail(`media error ${code}`);
        });
        p.addEventListener('loadedmetadata', () => {
          console.log(
            `INTERSTICE.player.loaded duration_s=${p.duration.toFixed(1)}` +
              ` w=${p.videoWidth} h=${p.videoHeight}`,
          );
        });
        p.addEventListener('playing', () => {
          console.log('INTERSTICE.player.playing');
          setStatus('playing');
        });

        p.src = uri;
        p.load();
      } catch (err) {
        console.log(`INTERSTICE.player.init ok=false err=${(err as Error).message}`);
        setStatus('error');
        setDetail((err as Error).message);
      }
    })();

    return () => {
      cancelled = true;
      p.deinitialize().catch(() => {
        // deinitialise is best-effort during unmount; a failure here must not
        // throw into React's cleanup path.
      });
    };
  }, [uri]);

  // --- the surface arrives asynchronously; playback starts once it does ---
  const onSurfaceViewCreated = useCallback((handle: string) => {
    console.log(`INTERSTICE.player.surface created handle=${handle}`);
    surface.current = handle;
    const p = player.current;
    if (!p) return;
    p.setSurfaceHandle(handle);
    p.play()
      .then(() => console.log('INTERSTICE.player.play resolved'))
      .catch((err: Error) =>
        console.log(`INTERSTICE.player.play rejected err=${err.message}`),
      );
  }, []);

  const onSurfaceViewDestroyed = useCallback((handle: string) => {
    console.log(`INTERSTICE.player.surface destroyed handle=${handle}`);
    player.current?.clearSurfaceHandle(handle);
    surface.current = null;
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
