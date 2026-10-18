/**
 * `npm run viz` — the two AC19 renders, offline, from C7 data.
 *
 *   tsx tools/viz/cli.ts timeline [--manifest media/tears-of-steel.manifest.json] [--verbosity standard] [--out docs/video]
 *   tsx tools/viz/cli.ts split    [--film <mp4>] [--from 215] [--to 245] [--track <track.json>] [--out docs/video]
 *   tsx tools/viz/cli.ts all
 *
 * Scratch (type.xml, overlay PNGs, the ffmpeg command) goes under generated/viz/.
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildTimelineModel, type AssetManifestLike } from './model.js';
import { findRasterizer } from './raster.js';
import { renderSplitScreen } from './split.js';
import { renderTimeline } from './timeline.js';
import type { Verbosity } from '../../pipeline/types.js';

interface Args {
  cmd: string;
  flags: Record<string, string>;
}

function parse(argv: string[]): Args {
  const [cmd = 'all', ...rest] = argv;
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a.startsWith('--')) {
      const v = rest[i + 1];
      if (v !== undefined && !v.startsWith('--')) {
        flags[a.slice(2)] = v;
        i++;
      } else {
        flags[a.slice(2)] = 'true';
      }
    }
  }
  return { cmd, flags };
}

function loadModel(flags: Record<string, string>) {
  const manifestPath = flags['manifest'] ?? 'media/tears-of-steel.manifest.json';
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as AssetManifestLike & { subtitles_uri: string; media_uri: string };
  const srt = readFileSync(manifest.subtitles_uri, 'utf8');
  const verbosity = (flags['verbosity'] ?? 'standard') as Verbosity;
  return { manifest, model: buildTimelineModel(srt, manifest, verbosity) };
}

function kb(path: string): string {
  return `${Math.round(statSync(path).size / 1024)} KB`;
}

async function main(): Promise<void> {
  const { cmd, flags } = parse(process.argv.slice(2));
  const outDir = flags['out'] ?? 'docs/video';
  const work = resolve(flags['work'] ?? 'generated/viz');
  mkdirSync(outDir, { recursive: true });
  mkdirSync(work, { recursive: true });
  const { manifest, model } = loadModel(flags);
  const f = model.figures;
  console.log(
    `INTERSTICE.viz.model asset=${model.asset_id} subs=${f.subtitle_cues} speech=${f.speech_spans} gaps=${f.gaps}` +
      ` in_content=${f.gaps_in_content} cues=${f.cue_windows} dropped=${f.cue_windows_dropped} rejected=${f.rejected_silences}` +
      ` dialogue_pct=${f.dialogue_pct} silence_pct=${f.silence_pct} silence_in_content_pct=${f.silence_in_content_pct} verbosity=${model.verbosity}`,
  );

  if (cmd === 'timeline' || cmd === 'all') {
    const raster = findRasterizer(work);
    for (const variant of ['video', 'readme'] as const) {
      const svgPath = join(outDir, `gap-timeline-${variant}.svg`);
      const pngPath = join(outDir, `gap-timeline-${variant}.png`);
      writeFileSync(svgPath, renderTimeline(model, { variant }));
      raster.render(svgPath, pngPath);
      console.log(`INTERSTICE.viz.timeline variant=${variant} svg=${svgPath} (${kb(svgPath)}) png=${pngPath} (${kb(pngPath)}) via=${raster.name}`);
    }
  }

  if (cmd === 'split' || cmd === 'all') {
    const film = flags['film'] ?? process.env['INTERSTICE_FILM'] ?? manifest.media_uri;
    const from = Number(flags['from'] ?? 215);
    const to = Number(flags['to'] ?? 245);
    const result = await renderSplitScreen(model, {
      film,
      from_ms: from * 1000,
      to_ms: to * 1000,
      trackPath: flags['track'] ?? null,
      outDir,
      work,
      raster: findRasterizer(work),
      dryRun: flags['dry-run'] === 'true',
    });
    console.log(`INTERSTICE.viz.split out=${result.outPath} cues=${result.cues} placeholder=${result.placeholder} cmd=${result.cmdPath}`);
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
