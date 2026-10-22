import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { validateTrack } from '../../node_modules/react-native-tv-audio-description/lib/TrackLoader.js';
import { wordCeiling } from '../budget.js';
import { FakeProvider } from '../providers/index.js';
import { DEFAULT_MANIFEST, optionsFromArgv, runPipeline, trackModelId } from '../run.js';
import type { DescriptionTrack } from '../types.js';

/**
 * The whole pipeline, offline, on the real subtitle file: C7 → C8 (stubbed:
 * no ffmpeg, no asset on CI) → C9 (fake provider) → C10 (fake Polly). The
 * numbers it asserts are the ones the registry MEASURED for this asset in R22
 * — 47 / 55 / 60 cues, 163 calls — so a change to the splitter, the budget or
 * the cast pass shows up here as a count, not as a vague "something moved".
 */

const dirs: string[] = [];
const out = () => {
  const d = mkdtempSync(join(tmpdir(), 'interstice-run-'));
  dirs.push(d);
  return d;
};
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

const stubSynth = async (_text: string, outPath: string) => {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(outPath, 'stub');
};

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as DescriptionTrack;

describe('runPipeline --dry-run on media/tears-of-steel.en.srt', () => {
  it('emits the three per-level track files with the measured cue counts and 163 calls', async () => {
    const dir = out();
    const provider = new FakeProvider();
    const r = await runPipeline({
      manifestPath: DEFAULT_MANIFEST, outDir: dir, dryRun: true, frames: 'stub', provider, synthesize: stubSynth,
    });

    expect(r.gaps).toBe(39);
    expect(r.frames).toEqual({ windows: 60, extracted: 0, reused: 0, stubbed: true });
    expect(r.levels.map((l) => [l.verbosity, l.cues, l.ok, l.failed])).toEqual([
      ['concise', 47, 47, 0],
      ['standard', 55, 55, 0],
      ['detailed', 60, 60, 0],
    ]);
    expect(r.usage.calls).toBe(163); // 47 + 55 + 60 + the cast pass
    expect(r.cast.split('\n').length).toBeGreaterThan(0);

    for (const level of r.levels) {
      expect(level.track_path).toBe(join(dir, `tears-of-steel.${level.verbosity}.track.json`));
      expect(existsSync(level.track_path)).toBe(true);
    }
  });

  // Fails if: a generated track does not validate against the package's
  // TrackLoader — the one the app ships. contract-parity.test.ts proves the
  // validator matches the registry; this proves the pipeline's OUTPUT does.
  it('writes tracks the app\'s TrackLoader accepts, every ok cue inside its ceiling (AC4)', async () => {
    const dir = out();
    const r = await runPipeline({
      manifestPath: DEFAULT_MANIFEST, outDir: dir, dryRun: true, frames: 'stub', synthesize: stubSynth,
    });
    for (const level of r.levels) {
      const track = read(level.track_path);
      expect(validateTrack(track)).toMatchObject({ ok: true });
      expect(track.verbosity).toBe(level.verbosity);
      expect(track.asset_id).toBe('tears-of-steel');
      expect(track.model_id).toBe('fake-provider');
      // the manifest's credits sentence joins every level, after the film
      const fixed = track.cues.filter((c) => c.source_frames_ms.length === 0);
      expect(fixed.map((c) => [c.id, c.text])).toEqual([['cue_588000-591000', 'The end credits roll.']]);
      expect(track.cues).toHaveLength(level.cues + level.announced);
      for (const c of track.cues) {
        expect(c.status).toBe('ok');
        expect(existsSync(join(dir, c.audio_uri))).toBe(true);
        if (fixed.includes(c)) continue;
        expect(c.words).toBeLessThanOrEqual(wordCeiling(c.end_ms - c.start_ms));
        expect(c.words).toBeGreaterThan(0);
        expect(c.audio_uri).toBe(`audio/${c.id}.${level.verbosity}.m4a`);
        expect(c.source_frames_ms).toHaveLength(1); // stubbed: the midpoint
        expect(c.source_frames_ms[0]).toBeGreaterThanOrEqual(c.start_ms);
        expect(c.source_frames_ms[0]).toBeLessThan(c.end_ms);
      }
    }
  });

  // Fails if: a re-run re-pays. Descriptions are cached by window key and
  // level, the cast by asset, the audio by sentence — so the second run makes
  // zero provider calls and synthesises nothing.
  it('is idempotent: a second run over the same output makes no provider call', async () => {
    const dir = out();
    const first = new FakeProvider();
    await runPipeline({ manifestPath: DEFAULT_MANIFEST, outDir: dir, dryRun: true, frames: 'stub', provider: first, synthesize: stubSynth });
    expect(first.usage.calls).toBe(163);

    const second = new FakeProvider();
    let synthesised = 0;
    const r = await runPipeline({
      manifestPath: DEFAULT_MANIFEST, outDir: dir, dryRun: true, frames: 'stub', provider: second,
      synthesize: async (t, p) => { synthesised++; await stubSynth(t, p); },
    });
    expect(second.usage.calls).toBe(0);
    expect(synthesised).toBe(0);
    expect(r.levels.map((l) => l.cached)).toEqual([47, 55, 60]);
    expect(readdirSync(join(dir, 'cache')).sort()).toEqual([
      'cast.txt', 'descriptions.concise.json', 'descriptions.detailed.json', 'descriptions.standard.json',
    ]);
  });

  // Fails if: a run that only reuses the cache labels the track with its own
  // provider instead of the models that wrote the cues (R56: a six-model track
  // was labelled with the default model of a run that made no call).
  it('names the models that wrote the cues, not the provider of a cache-only run', async () => {
    const dir = out();
    await runPipeline({ manifestPath: DEFAULT_MANIFEST, outDir: dir, dryRun: true, frames: 'stub', provider: new FakeProvider([], 'writer-model'), synthesize: stubSynth, levels: ['standard'] });
    await runPipeline({ manifestPath: DEFAULT_MANIFEST, outDir: dir, dryRun: true, frames: 'stub', provider: new FakeProvider([], 'idle-model'), synthesize: stubSynth, levels: ['standard'] });
    const track = JSON.parse(readFileSync(join(dir, 'tears-of-steel.standard.track.json'), 'utf8')) as DescriptionTrack;
    expect(track.model_id).toBe('writer-model');
  });

  it('trackModelId: first-appearance order, + lists split, failed cues ignored, legacy cues unrecorded', () => {
    const ok = (model?: string) => ({ window_key: 'k', text: 't', words: 1, status: 'ok' as const, attempts: 1, ...(model ? { model } : {}) });
    const failed = { window_key: 'k', text: '', words: 0, status: 'failed' as const, attempts: 2, model: 'never' };
    expect(trackModelId([ok('b'), ok('a+b'), failed, ok('c')], 'fb')).toBe('b+a+c');
    expect(trackModelId([ok('a'), ok()], 'fb')).toBe('a+unrecorded');
    expect(trackModelId([failed], 'fb')).toBe('fb');
  });

  // Fails if: a failed cue is cached as final. AC14 regenerates bad cues by
  // re-running; a cache that remembers the failure would make that a no-op.
  it('re-attempts a failed cue on the next run, and only that cue', async () => {
    const dir = out();
    // first run: the cast, then the first cue answers garbage twice -> failed
    const flaky = new FakeProvider([
      'Thom — jacket',
      'no json here', 'still no json',
    ]);
    const r1 = await runPipeline({
      manifestPath: DEFAULT_MANIFEST, outDir: dir, dryRun: true, frames: 'stub', provider: flaky,
      synthesize: stubSynth, levels: ['standard'], limit: 5,
    });
    expect(r1.levels[0]).toMatchObject({ cues: 5, ok: 4, failed: 1, calls: 6 });
    const t1 = read(r1.levels[0]!.track_path);
    expect(t1.cues[0]).toMatchObject({ status: 'failed', text: '', audio_uri: '', words: 0 });
    expect(validateTrack(t1)).toMatchObject({ ok: true }); // a failed cue is written, not dropped

    const healthy = new FakeProvider();
    const r2 = await runPipeline({
      manifestPath: DEFAULT_MANIFEST, outDir: dir, dryRun: true, frames: 'stub', provider: healthy,
      synthesize: stubSynth, levels: ['standard'], limit: 5,
    });
    expect(healthy.usage.calls).toBe(1);
    expect(r2.levels[0]).toMatchObject({ cues: 5, ok: 5, failed: 0, cached: 4, calls: 1 });
    expect(read(r2.levels[0]!.track_path).cues[0]!.status).toBe('ok');
  });

  it('refuses a real run without the media file, and names --dry-run', async () => {
    const dir = out();
    const { writeFileSync } = await import('node:fs');
    const manifest = join(dir, 'missing.manifest.json');
    writeFileSync(manifest, JSON.stringify({
      version: '1', asset_id: 'missing', media_uri: join(dir, 'nope.mp4'),
      subtitles_uri: 'media/tears-of-steel.en.srt', duration_ms: 734167, content_windows: [], segments: null,
    }));
    await expect(
      runPipeline({ manifestPath: manifest, outDir: dir, dryRun: false, provider: new FakeProvider(), synthesize: stubSynth }),
    ).rejects.toThrow(/asset not found.*--dry-run/);
  });
});

describe('optionsFromArgv', () => {
  it('reads the flags and derives the output directory from the manifest', () => {
    const o = optionsFromArgv(['--dry-run', '--levels', 'standard,concise', '--limit', '3', '--frames', 'stub'], {});
    expect(o).toMatchObject({
      manifestPath: DEFAULT_MANIFEST, dryRun: true, levels: ['standard', 'concise'], limit: 3, frames: 'stub',
      outDir: join('generated', 'dry-run', 'tears-of-steel'),
    });
    expect(optionsFromArgv([], {}).outDir).toBe(join('generated', 'tears-of-steel'));
    expect(optionsFromArgv(['--out', 'x'], {}).outDir).toBe('x');
    expect(() => optionsFromArgv(['--levels', 'loud'], {})).toThrow(/unknown level/);
  });

  it('honours DEMO_ASSET_MANIFEST (env_vars) when no --manifest is given', () => {
    const o = optionsFromArgv([], { DEMO_ASSET_MANIFEST: 'media/clip.manifest.json' });
    expect(o.manifestPath).toBe('media/clip.manifest.json');
    expect(o.outDir).toBe(join('generated', 'clip'));
  });
});
