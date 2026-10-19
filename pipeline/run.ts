import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDramatisPersonae, describeCue, type DescribedCueResult } from './describe.js';
import { framesForCue, windowKey, type CueFrames } from './frames.js';
import { clipToContent, findGaps, logCues, logGaps, parseWebVtt, splitIntoCues } from './gaps.js';
import { loadManifest } from './manifest.js';
import { fakeSynthesize, selectProvider } from './providers/index.js';
import type { DescriptionProvider, ProviderUsage } from './providers/types.js';
import { buildTrack, synthesizeCue } from './synthesize.js';
import { VERBOSITY_LEVELS, type Verbosity } from './types.js';

/**
 * The orchestrator: subtitles → gaps and cues (C7) → frames (C8) → descriptions
 * (C9) → synthesis and one track file per verbosity level (C10), under
 * `generated/<asset_id>/`.
 *
 * Every stage is idempotent, because the two paid stages are the ones most
 * likely to be interrupted: frames already on disk are reused, descriptions are
 * cached by window key and level, and a clip whose sentence has not changed is
 * not re-synthesised. A re-run therefore pays only for what is missing or was
 * `failed` — which is also how `AC14` regenerates the worst cues.
 *
 * `--dry-run` runs the same code with a fake provider and a fake Polly, so the
 * whole flow is exercisable with no account and no network.
 */

export const DEFAULT_MANIFEST = 'media/tears-of-steel.manifest.json';
export const DEFAULT_OUT_ROOT = 'generated';

export interface RunOptions {
  manifestPath: string;
  outDir: string;
  dryRun: boolean;
  levels?: Verbosity[];
  /** cap cues per level — a cheap smoke run against a real provider */
  limit?: number;
  /** `stub` writes no JPEGs and sends no images; `auto` stubs only in a dry run with no asset */
  frames?: 'auto' | 'stub';
  provider?: DescriptionProvider;
  synthesize?: (text: string, outPath: string) => Promise<void>;
  env?: NodeJS.ProcessEnv;
}

export interface LevelResult {
  verbosity: Verbosity;
  track_path: string;
  cues: number;
  ok: number;
  failed: number;
  cached: number;
  calls: number;
}

export interface RunResult {
  asset_id: string;
  out_dir: string;
  gaps: number;
  frames: { windows: number; extracted: number; reused: number; stubbed: boolean };
  cast: string;
  levels: LevelResult[];
  usage: ProviderUsage;
  model_id: string;
}

type DescriptionCache = Record<string, DescribedCueResult>;

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Frames for the widest cue set, reused across runs. The index is what makes
 * the stage idempotent: without it a re-run cannot know which timestamps the
 * last run chose without running scene detection again.
 */
function frameStage(
  assetPath: string,
  cues: ReturnType<typeof splitIntoCues>,
  framesDir: string,
  mode: 'extract' | 'stub',
): { frames: Map<string, CueFrames>; extracted: number; reused: number } {
  const indexPath = join(framesDir, 'index.json');
  const index = readJson<Record<string, CueFrames>>(indexPath, {});
  const frames = new Map<string, CueFrames>();
  let extracted = 0;
  let reused = 0;

  for (const cue of cues) {
    const key = windowKey(cue);
    const cached = index[key];
    if (cached && cached.paths.every((p) => existsSync(p))) {
      frames.set(key, cached);
      reused++;
      continue;
    }
    if (mode === 'stub') {
      const midpoint = cue.start_ms + Math.floor(cue.duration_ms / 2);
      frames.set(key, { window_key: key, source_frames_ms: [midpoint], paths: [] });
      continue;
    }
    const f = framesForCue(assetPath, cue, framesDir);
    frames.set(key, f);
    index[key] = f;
    extracted++;
    writeJson(indexPath, index); // after every cue, so an interrupted run keeps its work
  }

  console.log(
    `INTERSTICE.run.frames windows=${frames.size} extracted=${extracted} reused=${reused}` +
      ` mode=${mode}`,
  );
  return { frames, extracted, reused };
}

/**
 * Synthesis that skips a clip whose sentence has not changed. The sidecar holds
 * the text the clip was made from: a regenerated cue (its cache entry deleted,
 * a new sentence written) gets new audio, an unchanged one does not.
 */
function idempotent(
  speak: (text: string, outPath: string) => Promise<void>,
): (text: string, outPath: string) => Promise<void> {
  return async (text, outPath) => {
    const sidecar = `${outPath}.txt`;
    if (existsSync(outPath) && existsSync(sidecar) && readFileSync(sidecar, 'utf8') === text) {
      console.log(`INTERSTICE.synthesize.reused file=${outPath}`);
      return;
    }
    await speak(text, outPath);
    writeFileSync(sidecar, text);
  };
}

export async function runPipeline(o: RunOptions): Promise<RunResult> {
  const env = o.env ?? process.env;
  const levels = o.levels ?? [...VERBOSITY_LEVELS];
  const out = o.outDir;
  mkdirSync(out, { recursive: true });

  console.log(
    `INTERSTICE.run.start manifest=${o.manifestPath} out=${out} dry_run=${o.dryRun}` +
      ` levels=${levels.join(',')}${o.limit ? ` limit=${o.limit}` : ''}`,
  );

  // C7 — gaps and cues from the subtitles, clipped to the asset's content windows.
  const manifest = loadManifest(o.manifestPath);
  const subtitles = parseWebVtt(readFileSync(manifest.subtitles_uri, 'utf8'));
  const gaps = clipToContent(findGaps(subtitles, manifest.duration_ms), manifest.content_windows);
  logGaps(gaps);

  // C8 — extract ONCE, against the widest cue set; the levels nest (02b §4.1).
  const widest = splitIntoCues(gaps, 'detailed');
  logCues(widest, 'detailed');
  const assetPresent = existsSync(manifest.media_uri);
  let frameMode: 'extract' | 'stub' = 'extract';
  if (o.frames === 'stub') frameMode = 'stub';
  else if (!assetPresent) {
    if (!o.dryRun) {
      throw new Error(
        `INTERSTICE.run.fatal asset not found: ${manifest.media_uri} — a real run needs the ` +
          'media file (README §Setup); --dry-run runs without it',
      );
    }
    console.log(`INTERSTICE.frames.stubbed reason=asset_missing path=${manifest.media_uri}`);
    frameMode = 'stub';
  }
  const fr = frameStage(manifest.media_uri, widest, join(out, 'frames'), frameMode);

  // C9 — the provider, the cast pass (cached), then one bounded description per cue.
  const provider = o.provider ?? selectProvider(env, { dryRun: o.dryRun });
  console.log(`INTERSTICE.run.provider id=${provider.id} model=${provider.modelId}`);

  const cacheDir = join(out, 'cache');
  const castPath = join(cacheDir, 'cast.txt');
  let cast: string;
  if (existsSync(castPath)) {
    cast = readFileSync(castPath, 'utf8');
    console.log(`INTERSTICE.describe.cast reused lines=${cast === '' ? 0 : cast.split('\n').length}`);
  } else {
    const first = widest[0];
    const openingFrames = first
      ? (fr.frames.get(windowKey(first))?.paths ?? []).map((p) => readFileSync(p))
      : [];
    cast = await buildDramatisPersonae(
      provider,
      openingFrames,
      subtitles.slice(0, 20).map((s) => s.text),
    );
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(castPath, cast);
  }

  const speak = idempotent(o.synthesize ?? (o.dryRun ? fakeSynthesize : synthesizeCue));
  const results: LevelResult[] = [];

  for (const verbosity of levels) {
    const all = splitIntoCues(gaps, verbosity);
    const cues = o.limit ? all.slice(0, o.limit) : all;
    logCues(cues, verbosity);

    const cachePath = join(cacheDir, `descriptions.${verbosity}.json`);
    const cache = readJson<DescriptionCache>(cachePath, {});

    // Rolling context is PER LEVEL: concise and detailed write different
    // sentences for the same window, and crossing them is what AC18 catches.
    const rolling: string[] = [];
    const described: DescribedCueResult[] = [];
    let cached = 0;
    let calls = 0;

    for (const [i, cue] of cues.entries()) {
      const key = windowKey(cue);
      const frames = fr.frames.get(key);
      if (!frames) throw new Error(`INTERSTICE.run.fatal no frames for window ${key}`);

      let d = cache[key];
      if (d && d.status === 'ok') {
        cached++;
      } else {
        // A `failed` entry is retried on the next run; only `ok` is final.
        d = await describeCue(provider, cue, frames, verbosity, cast, rolling);
        calls += d.attempts;
        cache[key] = d;
        writeJson(cachePath, cache);
      }
      if (d.status === 'ok') rolling.push(d.text);
      described.push(d);

      console.log(
        `INTERSTICE.run.progress level=${verbosity} cue=${i + 1}/${cues.length}` +
          ` cached=${cached} calls=${calls} failed=${described.filter((x) => x.status === 'failed').length}`,
      );
    }

    // C10 — Polly (or its fake), then the track file for this level.
    const track_path = await buildTrack({
      assetId: manifest.asset_id,
      sourceSubtitles: manifest.subtitles_uri,
      verbosity,
      modelId: provider.modelId,
      cues,
      frames: fr.frames,
      described,
      audioDir: join(out, 'audio'),
      outDir: out,
      synthesize: speak,
    });

    results.push({
      verbosity,
      track_path,
      cues: described.length,
      ok: described.filter((d) => d.status === 'ok').length,
      failed: described.filter((d) => d.status === 'failed').length,
      cached,
      calls,
    });
  }

  const u = provider.usage;
  console.log(
    `INTERSTICE.run.done asset=${manifest.asset_id} levels=${results.length}` +
      ` cues=${results.map((r) => `${r.verbosity}:${r.ok}/${r.cues}`).join(',')}` +
      ` provider=${provider.id} calls=${u.calls} input_tokens=${u.input_tokens}` +
      ` output_tokens=${u.output_tokens} out=${out}`,
  );

  return {
    asset_id: manifest.asset_id,
    out_dir: out,
    gaps: gaps.length,
    frames: {
      windows: fr.frames.size,
      extracted: fr.extracted,
      reused: fr.reused,
      stubbed: frameMode === 'stub',
    },
    cast,
    levels: results,
    usage: { ...u },
    model_id: provider.modelId,
  };
}

// ---------------------------------------------------------------- CLI

export function optionsFromArgv(argv: string[], env: NodeJS.ProcessEnv): RunOptions {
  const has = (n: string) => argv.includes(`--${n}`);
  const val = (n: string) => {
    const i = argv.indexOf(`--${n}`);
    return i < 0 ? undefined : argv[i + 1];
  };
  const dryRun = has('dry-run');
  const manifestPath = val('manifest') ?? env.DEMO_ASSET_MANIFEST ?? DEFAULT_MANIFEST;
  const assetId = JSON.parse(readFileSync(manifestPath, 'utf8')).asset_id as string;
  const levelsArg = val('levels');
  const levels = levelsArg
    ? (levelsArg.split(',') as Verbosity[]).map((l) => {
        if (!VERBOSITY_LEVELS.includes(l)) throw new Error(`--levels: unknown level ${l}`);
        return l;
      })
    : undefined;
  const limit = val('limit') ? Number(val('limit')) : undefined;

  return {
    manifestPath,
    outDir: val('out') ?? join(DEFAULT_OUT_ROOT, dryRun ? 'dry-run' : '', assetId),
    dryRun,
    ...(levels ? { levels } : {}),
    ...(limit ? { limit } : {}),
    ...(val('frames') === 'stub' ? { frames: 'stub' as const } : {}),
    env,
  };
}

if (process.argv[1] && /run\.ts$/.test(process.argv[1])) {
  runPipeline(optionsFromArgv(process.argv.slice(2), process.env)).catch((err) => {
    console.error('INTERSTICE.run.fatal', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
