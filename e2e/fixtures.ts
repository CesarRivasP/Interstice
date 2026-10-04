import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { segmentAsset } from '../pipeline/segment.js';
import { synthesizeCue } from '../pipeline/synthesize.js';

// limits.fixture — the registry's values, verbatim
const ASSET_ID = 'e2e-fixture';
const DURATION_S = 60;
const WINDOWS: [number, number][] = [[4000, 9000], [14000, 20000], [24000, 28000]];

const OUT = 'e2e/out/fixtures';
const SOURCE = 'media/tears-of-steel.mp4';
// the device reaches the collector here; must equal the INTERSTICE_E2E the
// VARIANT package was built with (package.json build:e2e)
const HOST = process.env.INTERSTICE_E2E ?? 'http://localhost:8099';

// "Fixture cue N" — never a description of the picture. AC7 of the app set
// forbids hand-written cue text in the PRODUCT track; this is not that track,
// and its text says so out loud.
const TEXT = ['Fixture cue one.', 'Fixture cue two.', 'Fixture cue three.'];
const LEVELS = { concise: [0, 1], standard: [0, 1, 2], detailed: [0, 1, 2] } as const;

const durationMs = (file: string): number =>
  Math.round(
    Number(
      execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {
        encoding: 'utf8',
      }),
    ) * 1000,
  );

/**
 * The fixture's voice. Polly when the credentials are there; otherwise the
 * host's own `say`, into the SAME container the device was measured to accept
 * (fragmented mp4, AAC — the MSE path the app set measured). The words
 * are "Fixture cue N" either way, so nothing a scenario asserts depends on
 * which one spoke — and a reader with no AWS account can still run the suite.
 */
async function speak(text: string, file: string): Promise<'polly' | 'say'> {
  try {
    await synthesizeCue(text, file);
    return 'polly';
  } catch (err) {
    console.log(`Polly unavailable (${(err as Error).message.split('\n')[0]}) — using the host voice`);
    const aiff = `${file}.aiff`;
    execFileSync('say', ['-o', aiff, text]);
    execFileSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', aiff,
      '-c:a', 'aac', '-b:a', '96k', '-ar', '44100', '-ac', '2',
      '-movflags', '+frag_keyframe+empty_moov+default_base_moof', file,
    ]);
    rmSync(aiff);
    return 'say';
  }
}

async function main(): Promise<void> {
  mkdirSync(join(OUT, 'cues'), { recursive: true });

  // 1. the media: the first minute, stream-copied, then cut into segments
  const head = join(OUT, 'head.mp4');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', SOURCE, '-t', String(DURATION_S), '-c', 'copy', head]);
  const cut = segmentAsset(head, join(OUT, 'seg'));

  /** contracts.fixture_asset */
  const asset = {
    init: `seg/${basename(cut.init_uri)}`,
    segments: cut.segments.map((s) => ({
      index: s.index,
      start_ms: s.start_ms,
      end_ms: s.end_ms,
      uri: `seg/${basename(s.uri)}`,
    })),
  };
  // S15 needs a segment that is NOT fetched before playback begins
  if (!asset.segments.some((s) => s.start_ms >= 31_000)) {
    throw new Error('no segment starts after 31 s: S15 cannot stall on this cut');
  }
  writeFileSync(join(OUT, 'asset.json'), JSON.stringify(asset, null, 2) + '\n');

  // 2. the cue audio, and a check that each fits its window with room to spare
  for (const [i, text] of TEXT.entries()) {
    const file = join(OUT, 'cues', `c${i + 1}.m4a`);
    const voice = await speak(text, file);
    console.log(`cue c${i + 1}: ${voice}, ${durationMs(file)} ms`);
    const [start, end] = WINDOWS[i]!;
    const room = end - start - durationMs(file);
    if (room < 1000) throw new Error(`cue c${i + 1} leaves ${room} ms in its window; S10 would fail on the fixture, not on the app`);
  }

  // 3. one track per level — the key set of the app set's description_track contract
  for (const [verbosity, indexes] of Object.entries(LEVELS)) {
    const track = {
      version: '1',
      asset_id: ASSET_ID,
      generated_at: new Date().toISOString(),
      source_subtitles: 'none — e2e fixture, windows declared',
      verbosity,
      model_id: 'none — e2e fixture',
      cues: indexes.map((i) => ({
        id: `c${i + 1}`,
        start_ms: WINDOWS[i]![0],
        end_ms: WINDOWS[i]![1],
        words: TEXT[i]!.split(' ').length,
        text: TEXT[i]!,
        audio_uri: `${HOST}/fx/cues/c${i + 1}.m4a`,
        source_frames_ms: [],
        status: 'ok',
      })),
    };
    writeFileSync(join(OUT, `${ASSET_ID}.${verbosity}.track.json`), JSON.stringify(track, null, 2) + '\n');
  }

  console.log(`fixtures written to ${OUT}: ${asset.segments.length} segments, ${TEXT.length} cues, 3 tracks`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
