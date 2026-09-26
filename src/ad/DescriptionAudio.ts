import {
  AudioContentType,
  AudioPlayer,
  AudioUsageType,
  MediaSource,
  type VideoPlayer,
} from '@amazon-devices/react-native-w3cmedia';
import {log} from '../diagnostics';

/**
 * First increment of changes[C4]. It plays one description clip over the main
 * track while ducking it, which is the whole product in miniature.
 *
 * It exists now, ahead of the scheduler, because it is the test for two open
 * hypotheses and they gate everything downstream of them:
 *
 *   defects[D6] — can an AudioPlayer on this device take an audio-only
 *     SourceBuffer at all? limits.vega_media.url_mode_broken removed the only
 *     documented way to play a clip, and MSE was measured working for VIDEO,
 *     with a surface attached. Audio-only is a different question and nothing in
 *     this set had answered it.
 *   defects[D2] — does a second stream play while the main track ducks, or does
 *     the platform stop one of them?
 *
 * Clips are appended whole rather than windowed: limits.mse_buffer is about the
 * feature-length asset in changes[C2], and a cue is seconds long.
 */

/** limits.ad.duck_target_pct as a W3C volume. */
const DUCK_VOLUME = 0.25;

/**
 * AAC-LC in a FRAGMENTED mp4 — the container discipline of
 * limits.vega_media.mse_path, applied to audio. Polly's default MP3 cannot be
 * appended to a SourceBuffer, which is why changes[C10] emits this instead.
 */
const CUE_MIME = 'audio/mp4; codecs="mp4a.40.2"';

export interface CuePlayback {
  /** resolves when the cue has finished and the main track is back to full */
  done: Promise<void>;
}

/**
 * Play one description cue, ducking `main` for its duration.
 *
 * `main` is ducked before the first byte is appended and restored on `ended`
 * OR on failure — a cue that fails must not leave the film at 25% forever,
 * which is the failure mode that turns one bad clip into an unwatchable film.
 */
export function playCue(uri: string, main: VideoPlayer | null): CuePlayback {
  const done = (async () => {
    const player = new AudioPlayer(
      AudioContentType.CONTENT_TYPE_SPEECH,
      AudioUsageType.USAGE_ACCESSIBILITY,
    );
    const restore = () => {
      if (main) main.volume = 1;
    };

    try {
      await player.initialize();

      const supported = MediaSource.isTypeSupported(CUE_MIME);
      log(`INTERSTICE.cue.audio mse_supported=${supported} uri=${uri}`);
      if (!supported) {
        log('INTERSTICE.cue.audio state=unsupported');
        return;
      }

      const source = new MediaSource();

      await new Promise<void>((resolve, reject) => {
        player.addEventListener('error', () => {
          const code = player.error?.code ?? -1;
          const msg =
            (player.error as {message?: string} | null)?.message ?? 'none';
          log(`INTERSTICE.cue.audio state=error code=${code} msg=${msg}`);
          reject(new Error(`cue media error ${code}`));
        });

        player.addEventListener('canplay', () => {
          log('INTERSTICE.cue.audio state=canplay');
          // Duck HERE, not at append time: the gap between "we decided to speak"
          // and "sound comes out" is dead air at 25% otherwise.
          if (main) {
            main.volume = DUCK_VOLUME;
            log(`INTERSTICE.cue.duck main_volume=${main.volume}`);
          }
          player
            .play()
            .then(() => log('INTERSTICE.cue.audio state=playing'))
            .catch((err: Error) => reject(err));
        });

        player.addEventListener('ended', () => {
          log(
            `INTERSTICE.cue.audio state=ended t=${player.currentTime.toFixed(
              2,
            )}`,
          );
          resolve();
        });

        source.addEventListener('sourceopen', () => {
          appendWhole(source, uri).catch(reject);
        });

        // srcObject, not src — see limits.vega_media.url_mode_broken.
        player.srcObject = source;
      });
    } catch (err) {
      log(`INTERSTICE.cue.audio state=failed err=${(err as Error).message}`);
    } finally {
      restore();
      log('INTERSTICE.cue.duck restored');
      await player.deinitialize().catch(() => {
        // best effort; a cue that cannot be torn down must not stop the film
      });
    }
  })();

  return {done};
}

async function appendWhole(source: MediaSource, uri: string): Promise<void> {
  const buffer = source.addSourceBuffer(CUE_MIME);
  const response = await fetch(uri);
  const bytes = new Uint8Array(await response.arrayBuffer());
  log(`INTERSTICE.cue.audio bytes=${bytes.byteLength}`);

  buffer.addEventListener('updateend', () => {
    if (source.readyState !== 'open') return;
    source.endOfStream();
  });

  buffer.appendBuffer(bytes);
}
