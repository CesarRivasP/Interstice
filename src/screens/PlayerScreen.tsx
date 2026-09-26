import React, {useCallback, useEffect, useRef, useState} from 'react';
import {BackHandler, StyleSheet, Text, View} from 'react-native';
import type {MediaAdapter} from '../platform/MediaAdapter';
import {ADControls, type ADState} from '../ad/ADControls';
import {coalesce, CueScheduler} from '../ad/CueScheduler';
import {DescriptionAudio} from '../ad/DescriptionAudio';
import {loadTrack} from '../ad/TrackLoader';
import type {DescriptionCue, Verbosity} from '../../pipeline/types';
import {log} from '../diagnostics';

/**
 * `changes[C2]`. Since R28 this file names NO platform API: everything it needs
 * arrives through `MediaAdapter`, and the decoded picture renders into the
 * surface the adapter supplies. That is what makes `changes[C12]` a package
 * rather than a Vega app with a package-shaped README.
 *
 * What the adapter hides, and why each was worth hiding:
 *   - byte delivery, because `limits.vega_media.url_mode_broken` means the
 *     player fetches nothing itself;
 *   - the surface race, because `initialize()` and the surface handover have no
 *     guaranteed order and the loser presents as an unsupported file;
 *   - the absence of a volume ramp, which `src/ad/duck.ts` supplies once.
 */

export interface PlayerScreenProps {
  media: MediaAdapter;
  /** URI of the asset to play. The adapter decides how the bytes are obtained. */
  uri: string;
  /**
   * One description cue, fired once shortly after playback starts.
   *
   * TEMPORARY — it is the runtime probe that resolved `defects[D6]` and
   * `defects[D2]`, and `changes[C3]` replaces it with a scheduler driven by the
   * gap timeline. It stays until a real track exists to schedule, which is
   * blocked on `defects[D4]`.
   */
  cueUri?: string;
  /** where track files sit, per decisions.verbosity_levels' lookup rule */
  assetDir: string;
  assetId: string;
  readJson: (path: string) => Promise<unknown>;
  /** AC2: BACK's stated destination */
  onExit: () => void;
}

type Status = 'loading' | 'playing' | 'stalled' | 'error';

export function PlayerScreen({
  media,
  uri,
  cueUri,
  assetDir,
  assetId,
  readJson,
  onExit,
}: PlayerScreenProps) {
  const [status, setStatus] = useState<Status>('loading');
  const [detail, setDetail] = useState<string>('');
  const [ad, setAd] = useState<ADState>({kind: 'missing', detail: 'not loaded yet'});
  const [verbosity, setVerbosity] = useState<Verbosity>('standard');
  const audio = useRef<DescriptionAudio | null>(null);
  const scheduler = useRef<CueScheduler | null>(null);
  const cueFired = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let cueTimer: ReturnType<typeof setTimeout> | null = null;
    audio.current = new DescriptionAudio(media);
    scheduler.current = new CueScheduler({
      onFire: cue => {
        void audio.current?.speak(cue);
      },
    });

    const offPosition = media.video.onPosition(ms => scheduler.current?.tick(ms));
    // AC6: act on the SETTLED position. A held direction emits a stream of key
    // events, and one resync per event is a resync storm through every seek.
    const offSeek = media.video.onSeek(coalesce(ms => scheduler.current?.resync(ms)));

    // AC22 / R21-F3: running dry raises no error, so it needs its own listener
    // and its own state. Without this the screen stays in `playing` forever
    // while the picture sits still and says nothing.
    const offStalled = media.video.onStalled(() => {
      log('INTERSTICE.player.stalled');
      void audio.current?.stop(); // never leave the film ducked under a stall
      setStatus('stalled');
    });

    // MSE emits `waiting` at the start of normal playback, so `stalled` must be
    // a state playback can LEAVE. Measured on the device: it fired 2 ms after
    // play() resolved, on a film that then played fine. Treating it as terminal
    // leaves "Buffering" spoken over a working film.
    const offPlaying = media.video.onPlaying(() => {
      setStatus(current => {
        if (current !== 'stalled' && current !== 'loading') return current;
        log(`INTERSTICE.player.resumed from=${current}`);
        return 'playing';
      });
    });

    const offError = media.video.onError(err => {
      log(`INTERSTICE.player.error msg=${err.message}`);
      setStatus('error');
      setDetail(err.message);
    });

    (async () => {
      try {
        await media.video.open(uri);
        if (cancelled) return;
        await media.video.play();
        if (cancelled) return;
        setStatus('playing');

        if (cueUri && !cueFired.current) {
          cueFired.current = true;
          cueTimer = setTimeout(() => {
            log('INTERSTICE.cue.fire');
            void audio.current?.speak(probeCue(cueUri));
          }, 2000);
        }
      } catch (err) {
        log(`INTERSTICE.player.open failed err=${(err as Error).message}`);
        setStatus('error');
        setDetail((err as Error).message);
      }
    })();

    return () => {
      cancelled = true;
      // A scheduled cue must not outlive the screen that scheduled it: leaving
      // this pending fires a cue at an adapter that is being destroyed, and the
      // window for it is the two seconds a viewer is most likely to change
      // their mind in.
      if (cueTimer) clearTimeout(cueTimer);
      offPosition();
      offSeek();
      offStalled();
      offPlaying();
      offError();
      void audio.current?.stop();
      void media.video.destroy();
    };
  }, [media, uri, cueUri]);

  // AC17: switching level re-runs the loader and nothing else. The video keeps
  // playing, the position is untouched, and the scheduler is reloaded with the
  // new track's cues.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await loadTrack(readJson, assetDir, assetId, verbosity);
      if (cancelled) return;

      if (!result.ok) {
        // AC8: a stated state, never silence. The film still plays; only the
        // description is absent, and the sentence says so.
        setAd({kind: result.reason, detail: result.detail});
        scheduler.current?.load([]);
        return;
      }

      scheduler.current?.load(result.track.cues);
      setAd({
        kind: 'ready',
        enabled: true,
        verbosity: result.loaded_verbosity,
        cues: result.track.cues.filter(c => c.status === 'ok').length,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [readJson, assetDir, assetId, verbosity]);

  // AC2: BACK has ONE stated destination, from every state, and it stops the
  // cue on the way out so nothing speaks over the list.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      log(`INTERSTICE.player.back from=${status}`);
      void audio.current?.stop();
      onExit();
      return true;
    });
    return () => sub.remove();
  }, [status, onExit]);

  const onToggle = useCallback(
    (enabled: boolean) => {
      scheduler.current?.setEnabled(enabled); // AC3: the video is untouched
      if (!enabled) void audio.current?.stop();
      setAd(s => (s.kind === 'ready' ? {...s, enabled} : s));
    },
    [],
  );

  const Surface = media.VideoSurface;
  const overlay = overlayFor(status, detail);

  return (
    <View style={styles.root}>
      <Surface style={StyleSheet.absoluteFill} />
      <View style={styles.controls}>
        <ADControls state={ad} onToggle={onToggle} onVerbosity={setVerbosity} />
      </View>
      {overlay && (
        <View
          style={styles.overlay}
          accessible
          accessibilityRole={overlay.role}
          accessibilityLabel={overlay.spoken}>
          <Text style={styles.text}>{overlay.shown}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * AC2 + AC8 + AC24: every state that is not `playing` is BOTH shown and spoken.
 * A frozen picture says nothing to this app's users, and a stall raises no error
 * for anything else to report.
 */
function overlayFor(
  status: Status,
  detail: string,
): {role: 'alert' | 'progressbar'; shown: string; spoken: string} | null {
  switch (status) {
    case 'playing':
      return null;
    case 'loading':
      return {role: 'progressbar', shown: 'Loading…', spoken: 'Loading title'};
    case 'stalled':
      return {
        role: 'alert',
        shown: 'Buffering…',
        spoken:
          'The video paused while it loads more. Press back to return to the list.',
      };
    case 'error':
      return {
        role: 'alert',
        shown: `Could not play this title — ${detail}`,
        spoken: `This title could not be played. ${detail}`,
      };
  }
}

/** the probe cue, shaped as a real one so it exercises the real path */
function probeCue(audio_uri: string): DescriptionCue {
  return {
    id: 'probe',
    start_ms: 0,
    end_ms: 0,
    words: 0,
    text: '',
    audio_uri,
    source_frames_ms: [],
    status: 'ok',
  };
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000'},
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {color: '#fff', fontSize: 28},
  controls: {position: 'absolute', left: 48, bottom: 48, gap: 12},
});
