import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import type { CueFrames } from './frames.js';
import { windowKey } from './frames.js';
import type { CueWindow } from './gaps.js';
import type { DescriptionCue, DescriptionTrack, Verbosity } from './types.js';
import { trackFileName } from './types.js';

/**
 * `_facts.yml changes[C10]` — Polly, the container the device can actually play,
 * and one track file per verbosity level.
 *
 * THE CONTAINER IS NOT FREE. Every cue is played through a `MediaSource`
 * (`limits.vega_media.url_mode_broken` applies to `AudioPlayer` exactly as it
 * does to `VideoPlayer`), and **an MP3 cannot be appended to a SourceBuffer**.
 * Polly's default output would produce a track of files nothing in this app can
 * play, and the failure would arrive in the player looking like a player bug.
 * So: Polly speaks, ffmpeg repackages to fragmented mp4 with AAC-LC, measured
 * working on the device in R21 and again with real Polly bytes in R23.
 */

// endpoints.polly_synthesize
const polly = new PollyClient({ region: process.env.AWS_REGION });
const VOICE_ID = process.env.POLLY_VOICE_ID ?? 'Joanna';

export const TRACK_VERSION = '1';

/** what a described cue looks like coming out of `changes[C9]` */
export interface DescribedCue {
  window_key: string;
  text: string;
  words: number;
  status: 'ok' | 'failed';
}

/**
 * Polly speaks, ffmpeg repackages. The intermediate MP3 is deleted: leaving it
 * beside the `.m4a` invites someone to reference the wrong one, and the app
 * cannot play it.
 */
export async function synthesizeCue(text: string, outPath: string): Promise<void> {
  const res = await polly.send(
    new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: 'mp3',
      VoiceId: VOICE_ID as never,
      Engine: 'neural',
    }),
  );
  const bytes = await res.AudioStream!.transformToByteArray();

  const tmp = `${outPath}.mp3`;
  writeFileSync(tmp, bytes);
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', tmp,
    '-c:a', 'aac', '-b:a', '96k', '-ar', '44100', '-ac', '2',
    // limits.vega_media.mse_path. Without these the moov atom lands at the end
    // of the file and appendBuffer rejects it.
    '-movflags', '+frag_keyframe+empty_moov+default_base_moof',
    outPath,
  ]);
  rmSync(tmp);
}

export async function buildTrack(args: {
  assetId: string;
  sourceSubtitles: string;
  verbosity: Verbosity;
  modelId: string;
  cues: CueWindow[];
  frames: Map<string, CueFrames>;
  described: DescribedCue[];
  audioDir: string;
  outDir: string;
  /** injected so the suite can run without Polly or ffmpeg */
  synthesize?: (text: string, outPath: string) => Promise<void>;
}): Promise<string> {
  mkdirSync(args.audioDir, { recursive: true });
  const speak = args.synthesize ?? synthesizeCue;

  // Keyed by WINDOW, never by index: indices are per level and renumber, so an
  // index join would pair a cue with a different cue's description at any level
  // where something was dropped — which is every level but `detailed`.
  const byWindow = new Map(args.described.map((d) => [d.window_key, d]));
  const cues: DescriptionCue[] = [];

  for (const window of args.cues) {
    const key = windowKey(window);
    const d = byWindow.get(key);
    if (!d) continue;

    const id = `cue_${key}`;
    const source_frames_ms = args.frames.get(key)?.source_frames_ms ?? [];

    if (d.status === 'failed') {
      // Written, not dropped. 01 §4: a throttled or rejected cue must not break
      // the track — the app skips it and the rest still plays.
      cues.push({
        id,
        start_ms: window.start_ms,
        end_ms: window.end_ms,
        words: 0,
        text: '',
        audio_uri: '',
        source_frames_ms,
        status: 'failed',
      });
      continue;
    }

    const audioName = `${id}.${args.verbosity}.m4a`;
    await speak(d.text, join(args.audioDir, audioName));

    cues.push({
      id,
      start_ms: window.start_ms,
      end_ms: window.end_ms,
      words: d.words,
      text: d.text,
      audio_uri: `audio/${audioName}`,
      source_frames_ms,
      status: 'ok',
    });
  }

  const track: DescriptionTrack = {
    version: TRACK_VERSION,
    asset_id: args.assetId,
    generated_at: new Date().toISOString(),
    source_subtitles: args.sourceSubtitles,
    verbosity: args.verbosity,
    model_id: args.modelId,
    cues,
  };

  // decisions.verbosity_levels LOOKUP RULE
  const outPath = join(args.outDir, trackFileName(args.assetId, args.verbosity));
  mkdirSync(args.outDir, { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(track, null, 2)}\n`);

  const failed = cues.filter((c) => c.status === 'failed').length;
  console.log(
    `INTERSTICE.synthesize.track verbosity=${args.verbosity} cues=${cues.length}` +
      ` failed=${failed} file=${outPath}`,
  );

  return outPath;
}
