# Implementation (2b of 6) — Interstice — the track files the app actually loads

> Complements `01-master-plan.md`. Part A, **Phase 6**: synthesis, the audio container, and the three per-verbosity track files.

- **Date:** 2026-09-25
- **Branch:** `main`
- **Test baseline:** `⟨commands.tests_expect⟩`, per `_facts.yml tests_baseline`. Every `Phase N verification:` below resolves through `_profile.yml`, never through a command invented for this document.

> **The preamble of `02-implementation-and-e2e.md` governs this file too** — language and layout, the `⟨commands.*⟩` notation, the logging convention, the "registry keys are the contract" rule, and the three deferred components (`C11`, `C15`, `C16`) that appear in none of the halves. It is not repeated here.
> Split out of `02b` in R22 per `references/doc-pattern.md` §Splitting an oversized doc, when `02b` passed 600 lines. No technical content differs from a single-file version.

**The set of six:** `02` (preamble, Phases 0–3) · `02b` (Phases 4–5: frames, description) · `02b2` (Phase 6: synthesis and the track files) · `02c` (Phases 7–11: the platform seam and the playback layer) · `02d` (Phases 12–17: screens, shell, the `[MANUAL]` deliverables) · `02e` (Part B test plan, Part C manual E2E, the Definition of Done, and the coverage map against `01` §7).

---

# Part A — Implementation plan (continued)

---

## Phase 6 — `pipeline/synthesize.ts` (`C10`) — Polly, fragmented AAC, and three track files

**Files:** `pipeline/synthesize.ts` (new), `pipeline/run.ts` (new)
**Anchor:** new files, full contents below.
**Maps to:** `_facts.yml changes[C10]`, `contracts.description_track`, `contracts.description_cue`, `decisions.verbosity_levels`, `endpoints.polly_synthesize`, `limits.polly`, `limits.vega_media.url_mode_broken`

**What changes:** each `ok` cue becomes an audio file, and the run emits **one track file per verbosity level**, each declaring its own level, named `<asset_id>.<verbosity>.track.json` per the lookup rule in `decisions.verbosity_levels`. `run.ts` is the entry point that wires Phases 3–6 together.

A `failed` cue is written into the track with empty text and no audio. That is deliberate: `01-master-plan.md` §4 — a throttled or rejected cue must not break the track, the app skips it, and a track missing one cue still plays.

### 6.1 — The container is not free, and MP3 is the wrong answer

> **`R21-F4`: every cue is played through a `MediaSource`, so its container must be one a `SourceBuffer` accepts.** `limits.vega_media.url_mode_broken` applies to `AudioPlayer` exactly as it does to `VideoPlayer` — there is no URI you can hand a player that will make it fetch anything. `02c` Phase 10 therefore fetches the clip's bytes and appends them, and **an MP3 cannot be appended**. Polly's default output would produce a track of files that no part of this app can play, and the failure would arrive in Phase 10 looking like a player bug.

So `C10` emits **fragmented MP4 carrying AAC-LC** — `audio/mp4; codecs="mp4a.40.2"`, measured working on the device in R21 (`defects[D6]`). Polly does not emit that container, so the shape is: **Polly → MP3 → ffmpeg → fragmented `.m4a`**. The ffmpeg flags are the same ones `limits.vega_media.mse_path` records for video, and they are not optional — a plain MP4 has its index at the end and `appendBuffer` rejects it.

Three cue sets, but the cue **windows** nest (Phase 4 §4.1), so a window that appears at two levels still gets **two different sentences** and therefore two different audio files. Audio is per level; frames are not.

**Code:**

`pipeline/synthesize.ts` (new file, full contents):

```ts
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import type { DescriptionCue, DescriptionTrack, Verbosity } from './types.js';
import { trackFileName } from './types.js';
import type { CueWindow } from './gaps.js';
import type { CueFrames } from './frames.js';
import { windowKey } from './frames.js';
import type { DescribedCue } from './describe.js';

// endpoints.polly_synthesize: polly.{AWS_REGION}.amazonaws.com SynthesizeSpeech
const polly = new PollyClient({ region: process.env.AWS_REGION });
const VOICE_ID = process.env.POLLY_VOICE_ID!;

export const TRACK_VERSION = '1';

/**
 * Polly speaks, ffmpeg repackages. The intermediate MP3 is deleted: leaving it
 * beside the .m4a invites someone to reference the wrong one, and the app
 * cannot play it (limits.vega_media.url_mode_broken -> MSE -> fragmented mp4).
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
    // The container discipline of limits.vega_media.mse_path. Without these the
    // moov atom lands at the end of the file and appendBuffer rejects it.
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
}): Promise<string> {
  mkdirSync(args.audioDir, { recursive: true });

  // Keyed by window, never by index: indices are per level and renumber, so an
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
      // Written, not dropped. The app skips it; the track still plays.
      cues.push({
        id, start_ms: window.start_ms, end_ms: window.end_ms,
        words: 0, text: '', audio_uri: '', source_frames_ms, status: 'failed',
      });
      continue;
    }

    const audioName = `${id}.${args.verbosity}.m4a`;
    await synthesizeCue(d.text, join(args.audioDir, audioName));

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
  writeFileSync(outPath, JSON.stringify(track, null, 2));

  const failed = cues.filter((c) => c.status === 'failed').length;
  console.log(
    `INTERSTICE.synthesize.track verbosity=${args.verbosity} cues=${cues.length}` +
      ` failed=${failed} file=${outPath}`,
  );

  return outPath;
}
```

`pipeline/run.ts` (new file, full contents):

```ts
import { readFileSync } from 'node:fs';
import { clipToContent, findGaps, logCues, logGaps, parseWebVtt, splitIntoCues } from './gaps.js';
import { loadManifest } from './manifest.js';
import { framesForTrack, windowKey } from './frames.js';
import { buildDramatisPersonae, describeCue } from './describe.js';
import { buildTrack } from './synthesize.js';
import { VERBOSITY_LEVELS } from './types.js';

const MANIFEST = process.env.DEMO_ASSET_MANIFEST!;
const MODEL_ID = process.env.BEDROCK_MODEL_ID!;

async function main(): Promise<void> {
  const manifest = loadManifest(MANIFEST);
  const subtitles = parseWebVtt(readFileSync(manifest.subtitles_uri, 'utf8'));

  const gaps = clipToContent(
    findGaps(subtitles, manifest.duration_ms),
    manifest.content_windows,
  );
  logGaps(gaps);

  // Extract ONCE, against the widest cue set. The levels nest, so the narrower
  // ones look their frames up by window key. See Phase 4 §4.1.
  const widest = splitIntoCues(gaps, 'detailed');
  logCues(widest, 'detailed');
  const frames = framesForTrack(manifest.media_uri, widest, 'out/frames');

  const cast = await buildDramatisPersonae(
    frames.get(windowKey(widest[0]!))?.paths ?? [],
    subtitles.slice(0, 20).map((s) => s.text),
  );

  for (const verbosity of VERBOSITY_LEVELS) {
    const cues = splitIntoCues(gaps, verbosity);
    logCues(cues, verbosity);

    // Rolling context is PER LEVEL. concise and detailed write different
    // sentences for the same window, and crossing them is the incoherence AC18
    // exists to catch.
    const rolling: string[] = [];
    const described = [];
    for (const cue of cues) {
      const d = await describeCue(cue, frames.get(windowKey(cue))!, verbosity, cast, rolling);
      if (d.status === 'ok') rolling.push(d.text);
      described.push(d);
    }

    await buildTrack({
      assetId: manifest.asset_id,
      sourceSubtitles: manifest.subtitles_uri,
      verbosity,
      modelId: MODEL_ID,
      cues,
      frames,
      described,
      audioDir: 'out/audio',
      outDir: 'out',
    });
  }
}

main().catch((err) => {
  console.error('INTERSTICE.run.fatal', err);
  process.exit(1);
});
```

### 6.2 — [MANUAL] What this run still has to fill in

`worst_case` is measured for everything the pipeline can produce **offline**: 39 gaps, 47 / 55 / 60 cues, 163 Bedrock calls, 451.8 s describable. One field remains `null` and it is not guessable — **`est_cost_usd`**, which is blocked by `defects[D4]` because no call has ever been priced. When `D4` clears, read the figure off the AWS console and write it in as `basis: measured` with the command and date, then `sync`.

`limits.bedrock.invoke_rate_per_account` and `limits.polly.chars_per_request` are `unknown` by design. This run is the occasion to read them off the console and replace `unknown` with a measured value — or to record that the console does not publish them, which is also an answer.

### 6.3 — The `D2` fallback is not needed

This phase used to carry a conditional fourth output: a full-length pre-mixed audio track with the duck and the cues baked in, for the branch where the platform refused concurrent playback. **`defects[D2]` resolved TRUE on 2026-09-25** — a cue played its full duration while the film kept decoding with zero dropped frames — so that branch does not run and nothing here builds it.

`decisions.d2_fallback` stays in the registry rather than being deleted, because concurrency has **not** been retested on physical hardware. If it fails there, this is the phase that changes, and the filtergraph it would need (`amix` plus `volume` over the same cue list) is the same work it always was.

**Contracts implemented:** `changes[C10]`, `contracts.description_track` (every field), `contracts.description_cue` (every field), `decisions.verbosity_levels` (lookup rule + per-level regeneration), `endpoints.polly_synthesize`, `limits.polly`, `limits.vega_media.mse_path`, `env_vars` (`POLLY_VOICE_ID`, `DEMO_ASSET_MANIFEST`), `worst_case`

**Phase 6 verification:** `⟨commands.tests⟩` → a line containing `⟨commands.tests_expect⟩` (Polly and ffmpeg mocked). Then the contract assertion in `02e` §B.2, run against the **real** emitted file: `out/tears-of-steel.standard.track.json` validates field-for-field against `contracts.description_track`. One further check that a mock cannot make: **take one emitted `.m4a` and append it through a `MediaSource` on the device**, exactly as `02c` Phase 10 does. A file that validates as a track and cannot be appended still fails every cue in it.

---

---

## Continues in `02c-app-playback.md`

Phases 7–11: the `MediaAdapter` seam, `C6` TrackLoader, `C3` CueScheduler, `C4` DescriptionAudio, `C5` ADControls.
