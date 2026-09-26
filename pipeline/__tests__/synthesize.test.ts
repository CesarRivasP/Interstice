import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { buildTrack, type DescribedCue } from '../synthesize.js';
import type { CueFrames } from '../frames.js';
import type { CueWindow } from '../gaps.js';

const out = () => mkdtempSync(join(tmpdir(), 'interstice-track-'));

const window = (start_ms: number, end_ms: number, index = 0): CueWindow => ({
  index,
  gap_index: index,
  start_ms,
  end_ms,
  duration_ms: end_ms - start_ms,
  word_target: 10,
  word_ceiling: 15,
  part_index: 1,
  part_count: 1,
  before: null,
  after: null,
});

const described = (key: string, over: Partial<DescribedCue> = {}): DescribedCue => ({
  window_key: key,
  text: 'A man steps between the machines.',
  words: 6,
  status: 'ok',
  ...over,
});

const frames = (key: string, ms: number[]): Map<string, CueFrames> =>
  new Map([[key, { window_key: key, source_frames_ms: ms, paths: [] }]]);

const run = async (args: Partial<Parameters<typeof buildTrack>[0]> = {}) => {
  const dir = out();
  const spoken: string[] = [];
  const path = await buildTrack({
    assetId: 'clip',
    sourceSubtitles: 'media/tears-of-steel.en.srt',
    verbosity: 'standard',
    modelId: 'amazon.nova-lite-v1:0',
    cues: [window(1_000, 3_000)],
    frames: frames('1000-3000', [2_000]),
    described: [described('1000-3000')],
    audioDir: join(dir, 'audio'),
    outDir: dir,
    synthesize: async (text, outPath) => {
      spoken.push(`${text} -> ${outPath}`);
    },
    ...args,
  });
  return { path, spoken, track: JSON.parse(readFileSync(path, 'utf8')) };
};

describe('buildTrack — contracts.description_track', () => {
  it('names the file by the lookup rule in decisions.verbosity_levels', async () => {
    const { path } = await run();
    expect(path.endsWith('clip.standard.track.json')).toBe(true);
  });

  it('writes a track that declares its own verbosity', async () => {
    const { track } = await run({ verbosity: 'concise' });
    expect(track.verbosity).toBe('concise');
  });

  it('carries the frames each cue was built from', async () => {
    const { track } = await run();
    expect(track.cues[0].source_frames_ms).toEqual([2_000]);
  });

  // Fails if: a `failed` cue is dropped from the track. 01 §4 — a throttled or
  // rejected description must not break the track. The app skips a failed cue;
  // it cannot skip one that is not there, and the gap would instead read as a
  // silence nobody planned.
  it('WRITES a failed cue rather than dropping it, with no audio', async () => {
    const { track, spoken } = await run({
      described: [described('1000-3000', { status: 'failed', text: '', words: 0 })],
    });
    expect(track.cues).toHaveLength(1);
    expect(track.cues[0]).toMatchObject({ status: 'failed', audio_uri: '', words: 0 });
    expect(spoken).toEqual([]); // nothing synthesised for a failed cue
  });

  // Fails if: descriptions are joined to windows by INDEX. Indices renumber per
  // verbosity level, because limits.ad.min_useful_words drops more windows at
  // concise — so an index join silently pairs a cue with a different cue's
  // sentence at every level but `detailed`, and nothing downstream could detect
  // it because the counts still match.
  it('joins descriptions to windows by WINDOW KEY, not by index', async () => {
    const { track } = await run({
      cues: [window(1_000, 3_000, 0), window(9_000, 12_000, 1)],
      frames: frames('9000-12000', [10_000]),
      described: [described('9000-12000', { text: 'Only the second window.' })],
    });

    expect(track.cues).toHaveLength(1);
    expect(track.cues[0].start_ms).toBe(9_000);
    expect(track.cues[0].text).toBe('Only the second window.');
  });

  it('emits every contracts.description_cue field', async () => {
    const { track } = await run();
    expect(Object.keys(track.cues[0]).sort()).toEqual(
      ['audio_uri', 'end_ms', 'id', 'source_frames_ms', 'start_ms', 'status', 'text', 'words'].sort(),
    );
  });

  // Fails if: the audio file stops being a fragmented mp4. An MP3 cannot be
  // appended to a SourceBuffer, and every cue is played through one
  // (limits.vega_media.url_mode_broken). The failure would arrive in the player
  // looking like a player bug, three phases from its cause.
  it('names cue audio .m4a, which is the only container the device can append', async () => {
    const { track, spoken } = await run();
    expect(track.cues[0].audio_uri.endsWith('.m4a')).toBe(true);
    expect(spoken[0]?.endsWith('.m4a')).toBe(true);
  });
});
