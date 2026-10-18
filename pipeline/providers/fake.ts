import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { AD } from '../budget.js';
import { emptyUsage, type DescriptionProvider, type VisionRequest } from './types.js';

/**
 * The provider `--dry-run` uses, and the one the C9 suite scripts.
 *
 * Unscripted, it answers from the prompt itself: the cast pass gets a short
 * list, a cue gets a JSON object of about the number of words the prompt asked
 * for. So the whole pipeline — gaps, frames, prompts, validation, rolling
 * context, synthesis, track files — runs offline, and the only thing a real run
 * adds is the two paid calls.
 */
export type FakeAnswer = string | ((req: VisionRequest, n: number) => string);

const WORDS = (
  'a figure crosses the floor toward the window light while another waits ' +
  'by the console hands still and the room holds its breath'
).split(' ');

export function wordsOf(n: number, seed = 0): string {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(WORDS[(seed + i) % WORDS.length]!);
  return out.join(' ');
}

export class FakeProvider implements DescriptionProvider {
  readonly id = 'fake' as const;
  readonly modelId: string;
  readonly usage = emptyUsage();
  /** every request, in order, so a test can read the prompt that was built */
  readonly requests: VisionRequest[] = [];
  private readonly script: FakeAnswer[];

  constructor(script: FakeAnswer[] = [], modelId = 'fake-provider') {
    this.script = [...script];
    this.modelId = modelId;
  }

  async describe(req: VisionRequest): Promise<string> {
    this.usage.calls += 1;
    this.usage.input_tokens += Math.ceil(req.text.length / 4) + req.images.length * 1200;
    this.requests.push(req);
    const n = this.requests.length;

    const scripted = this.script.shift();
    if (scripted !== undefined) {
      const answer = typeof scripted === 'function' ? scripted(req, n) : scripted;
      this.usage.output_tokens += Math.ceil(answer.length / 4);
      return answer;
    }

    const answer = autoAnswer(req, n);
    this.usage.output_tokens += Math.ceil(answer.length / 4);
    return answer;
  }
}

function autoAnswer(req: VisionRequest, n: number): string {
  if (/principal characters/.test(req.text)) {
    return [
      'Thom — tall man, close-cropped hair, dark jacket',
      'Celia — woman with long dark hair, grey coat',
      'Barley — bearded older man, lab coat',
    ].join('\n');
  }
  const m = /Aim for about (\d+) words/.exec(req.text);
  const target = m ? Number(m[1]) : 8;
  return JSON.stringify({ description: `${wordsOf(Math.max(1, target), n)}.` });
}

export function hasFfmpeg(): boolean {
  const r = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  return !r.error && r.status === 0;
}

/**
 * The fake Polly. With ffmpeg on PATH it writes real silence in the container
 * C10 must emit — fragmented mp4, AAC-LC — for as long as the sentence would
 * take at `limits.ad.speaking_rate_wpm`, so a dry-run track is one the app can
 * append and schedule. Without ffmpeg it writes a marker file and says so.
 */
export async function fakeSynthesize(text: string, outPath: string): Promise<void> {
  mkdirSync(dirname(outPath), { recursive: true });
  const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  const seconds = Math.max(0.3, (words / AD.SPEAKING_RATE_WPM) * 60);

  if (hasFfmpeg()) {
    const r = spawnSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
      '-t', seconds.toFixed(2),
      '-c:a', 'aac', '-b:a', '96k',
      '-movflags', '+frag_keyframe+empty_moov+default_base_moof',
      outPath,
    ]);
    if (r.status === 0) return;
  }

  writeFileSync(outPath, `INTERSTICE dry-run placeholder — not audio\n${text}\n`);
}
