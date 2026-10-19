# Implementation (2 of 6) — Interstice — the model half of the pipeline

> Complements `01-master-plan.md`. Part A, **Phases 4–5**: frame extraction and description. Phase 6 lives in `02b2-track-output.md`.

- **Date:** 2026-09-19
- **Branch:** `main`
- **Test baseline:** `aborted_no_conditions` until `02` Phase 1 measures it. Every `Phase N verification:` below resolves through `_profile.yml`, never through a command invented for this document.

> **The preamble of `02-implementation-and-e2e.md` governs this file too** — language and layout, the `⟨commands.*⟩` notation, the logging convention, the "registry keys are the contract" rule, and the three deferred components (`C11`, `C15`, `C16`) that appear in none of the five halves. It is not repeated here.
> Split per `references/doc-pattern.md` §Splitting an oversized doc. No technical content differs from a single-file version.

**The set of seven:** `02` (preamble, Phases 0–3: spike gate, scaffold, contracts in code, gap detection) · `02b` (Phases 4–5: frames, description) · `02b2` (Phase 6: synthesis and the track files) · `02c` (Phases 7–9: the platform seam, the loader, the scheduler) · `02c2` (Phases 10–11: description audio, the control surface) · `02d` (Phases 12–17: screens, shell, the `[MANUAL]` deliverables) · `02e` (Part B test plan, Part C manual E2E, the Definition of Done, and the coverage map against `01-master-plan.md` §7).

---

# Part A — Implementation plan (continued)

---

## Phase 4 — `pipeline/frames.ts` (`C8`) — up to 3 frames per CUE, midpoint plus cuts

**File:** `pipeline/frames.ts` (new)
**Anchor:** new file, full contents below.
**Maps to:** `_facts.yml changes[C8]`, `limits.ad.frames_per_gap_max`, `contracts.description_cue.source_frames_ms`

**What changes:** each **cue window** from `02` Phase 3 becomes up to `limits.ad.frames_per_gap_max` (**3**) JPEG frames on disk. The midpoint always; plus one frame per detected shot when the window spans a cut, because a single midpoint frame misdescribes a window that crosses one (review R2-F3). Still **one** Bedrock call per cue — the frames go into that one call together.

> **Per CUE, not per gap, and the rename is the phase.** This module was written 1:1 against `Gap` and R13 re-scoped it. Three frames for a 167-second gap is three frames for a minute and a half of film; three frames for a 12-second window is a sample. `limits.ad.frames_per_gap_max` keeps its name for registry continuity and means *per cue* — the `limits.ad.note` says so.

**Prerequisite:** `ffmpeg` and `ffprobe` on PATH. `[MANUAL]` once: `ffmpeg -version` must print a version. If it does not, install it and **write the friction entry** (`decisions.friction_log_shape`).

### 4.1 — Extract once, for three tracks

`C10` emits one track per verbosity level and the levels do not share a cue list — 47 / 55 / 60 cues on the demo asset. Extracting frames per level would run ffmpeg three times over the same film.

It does not have to, because of a property `02e` §B.1 pins with a test: **cue windows nest.** Boundaries depend only on duration, never on verbosity; verbosity decides only which windows fall under `limits.ad.min_useful_words`, and that threshold is monotonic in the scale. So `concise ⊆ standard ⊆ detailed`, verified on the demo asset (47 ⊆ 55 ⊆ 60).

**So: extract against the `detailed` cue set, once, and let the other two levels look their frames up by window.** Keyed by `start_ms`–`end_ms`, never by index — indices are per-level and renumber, and a pairing bug there would hand a cue another cue's frames, which nothing downstream could detect because the frame count would still look right.

**Code:**

`pipeline/frames.ts` (new file, full contents):

```ts
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { AD } from './budget.js';
import type { CueWindow } from './gaps.js';

export interface CueFrames {
  /** `${start_ms}-${end_ms}` — stable across verbosity levels, unlike the index */
  window_key: string;
  /** contracts.description_cue.source_frames_ms — every frame this cue was built from */
  source_frames_ms: number[];
  paths: string[];
}

export function windowKey(cue: Pick<CueWindow, 'start_ms' | 'end_ms'>): string {
  return `${cue.start_ms}-${cue.end_ms}`;
}

export function assetDurationMs(assetPath: string): number {
  const out = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    assetPath,
  ]).toString().trim();
  return Math.round(Number(out) * 1000);
}

/**
 * Shot boundaries inside [startMs, endMs), via ffmpeg scene detection.
 * Returns their timestamps in ms. One ffmpeg pass per cue, on a short segment.
 *
 * READS STDERR, NOT STDOUT. `showinfo` writes its `pts_time:` lines to stderr
 * along with the rest of ffmpeg's diagnostics; stdout carries the discarded
 * null-muxer output. See the note below — this was wrong in the first draft and
 * the unit tests could not have caught it.
 */
export function detectCuts(assetPath: string, startMs: number, endMs: number): number[] {
  const result = spawnSync('ffmpeg', [
    '-hide_banner',
    '-ss', String(startMs / 1000),
    '-t', String((endMs - startMs) / 1000),
    '-i', assetPath,
    '-vf', "select='gt(scene,0.4)',showinfo",
    '-f', 'null', '-',
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  const out = result.stderr ?? '';

  const cuts: number[] = [];
  for (const m of out.matchAll(/pts_time:([0-9.]+)/g)) {
    cuts.push(startMs + Math.round(Number(m[1]) * 1000));
  }
  return cuts;
}

export function extractFrame(assetPath: string, atMs: number, outPath: string): void {
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', String(atMs / 1000),
    '-i', assetPath,
    '-frames:v', '1',
    '-q:v', '3',
    outPath,
  ]);
}

/** _facts.yml changes[C8]. */
export function framesForCue(assetPath: string, cue: CueWindow, outDir: string): CueFrames {
  mkdirSync(outDir, { recursive: true });

  const midpoint = cue.start_ms + Math.floor(cue.duration_ms / 2);
  const cuts = detectCuts(assetPath, cue.start_ms, cue.end_ms);

  // Midpoint first — it is the frame that is always meaningful. Then one frame
  // just after each detected cut, in time order, until the bound is reached.
  const wanted = [midpoint, ...cuts.map((c) => c + 80)]
    .filter((t, i, all) => all.indexOf(t) === i)
    .filter((t) => t >= cue.start_ms && t < cue.end_ms)
    .slice(0, AD.FRAMES_PER_GAP_MAX)
    .sort((a, b) => a - b);

  const key = windowKey(cue);
  const paths = wanted.map((t) => {
    const p = join(outDir, `cue_${key}_${t}.jpg`);
    extractFrame(assetPath, t, p);
    return p;
  });

  console.log(
    `INTERSTICE.frames.extracted window=${key} frames=${paths.length}` +
      ` at_ms=[${wanted.join(',')}]`,
  );

  return { window_key: key, source_frames_ms: wanted, paths };
}

/**
 * Extract for the widest cue set (detailed) and index by window key, so the
 * narrower levels reuse the same JPEGs. See 4.1 for why this is sound.
 */
export function framesForTrack(
  assetPath: string,
  cues: CueWindow[],
  outDir: string,
): Map<string, CueFrames> {
  const byWindow = new Map<string, CueFrames>();
  for (const cue of cues) {
    byWindow.set(windowKey(cue), framesForCue(assetPath, cue, outDir));
  }
  console.log(`INTERSTICE.frames.track cues=${cues.length} windows=${byWindow.size}`);
  return byWindow;
}
```

> **R25-F1, and it is the reason this phase's `[MANUAL]` step is not a formality.** The first draft of `detectCuts` read `execFileSync`'s **return value**, which is stdout, with `stdio: ['ignore', 'ignore', 'pipe']`. ffmpeg writes `showinfo` to **stderr**, so every real call returned `null` and threw on `.toString()`. **Every unit test passed**, because a mock that hands back one buffer cannot distinguish the two streams — the test was asserting against the shape of the mock, not the shape of ffmpeg. The fix is `spawnSync` and `result.stderr`; the test mock now keeps the streams separate so it can fail the same way the real binary does.

> **`+ 80` on a cut timestamp** puts the frame just inside the new shot rather than on the boundary, where ffmpeg can hand back the last frame of the outgoing shot or a blend. It is a frame-grab offset, not a limit — it has no registry entry because it appears in exactly one place.

> **A window with no cut gets one frame, and that is correct.** `frames_per_gap_max` is a ceiling, not a target. Padding to three by sampling a static 12-second shot three times spends two Bedrock image slots on identical pixels.

**Contracts implemented:** `changes[C8]`, `limits.ad.frames_per_gap_max`, `contracts.description_cue.source_frames_ms` (produced here, written in Phase 6)

**Phase 4 verification:** `⟨commands.tests⟩` → a line containing `⟨commands.tests_expect⟩` (ffmpeg mocked, per `02e` §B.0). Then once, `[MANUAL]`, against the real asset: run `framesForCue` on the longest window and **open the JPEGs**. A test proves the bound holds and the reuse keys line up; only an eye proves the frames are of the film and not of black.

**Done 2026-09-25 (R25).** The longest content window (`119000-131000`) yielded two frames — `119955` from a detected cut and `125000` at the midpoint — and they are **two different shots of the same scene**, which is what the cut detection exists to produce. A window from the post-credits scene (`709500-719917`) yielded one frame, correctly, because it contains no cut. All three are film, none is black, and none is credits. The `[MANUAL]` step also found `R25-F1` above, which no test could have.

---

## Phase 5 — `pipeline/describe.ts` (`C9`) — dramatis personae, then one bounded description per CUE

**File:** `pipeline/describe.ts` (new)
**Anchor:** new file, full contents below.
**Maps to:** `_facts.yml changes[C9]`, `decisions.dramatis_personae`, `limits.ad.rolling_context_cues`, `limits.ad.max_words_per_cue`, `limits.bedrock.on_throttle`, `endpoints.bedrock_invoke`, `AC7`, `AC18`, gap sweep `S2`

> **BUILT 2026-10-18 (R47-W2), still not RUN against a real model.** `pipeline/describe.ts` exists, with 26 unit tests and a dry run that exercises it end to end on the demo subtitles (`changes[C29]`, `pipeline/run.ts`). What `defects[D4]` still blocks is the paid call: Bedrock refused again on 2026-10-18, *after* the use-case form was submitted, and the AWS documentation now scopes that form to Anthropic models. `alternatives[A5]` is therefore built rather than planned — the module is one function behind one call, and the call sits behind a `DescriptionProvider` seam (`changes[C30]`, `pipeline/providers/`) with a Bedrock implementation, an Anthropic implementation and a fake. Which one answers is `DESCRIPTION_PROVIDER=bedrock|anthropic`, default bedrock, chosen by the operator; when Bedrock returns `Error 002` the run stops on its first call with a message naming the other, and never switches on its own.

**What changes:** frames become sentences. Two distinct Bedrock call shapes live here:

1. **The dramatis personae pass** — one call, once per asset, over the opening-scene frames plus the subtitle speaker cues, producing a short cast map (`decisions.dramatis_personae`). Rolling context alone drifts names ("the woman" → "she" → a name); a generated anchor re-fed into every later prompt is one extra call and it is what `AC18` checks.
2. **One call per cue** — up to 3 frames + the surrounding subtitle context + the cast map + the last `limits.ad.rolling_context_cues` (**10**) descriptions, returning a description bounded to the cue's own `word_ceiling`.

**Measured cost of this phase (R22, on the demo asset):** 47 + 55 + 60 = **162 cue calls across the three verbosity levels, plus 1 dramatis personae pass = 163**. Not 181, which was the last figure derived by multiplying instead of running the splitter.

**Three things this phase must not get wrong, all of them from the gap sweep:**

- **Subtitle text is untrusted input to a model** (`S2`). Every subtitle line enters the prompt **inside a delimiter**, under an instruction that says content inside it is data and never an instruction. The `C16` pre-screen that would have filtered them is `kind: deferred`, so this is the whole input-side defence — acceptable only because the subtitle file is one the author chooses and controls (`decisions.demo_asset_licensing`).
- **The response is validated, not trusted.** The model must return one JSON object with one `description` string. Anything else — prose around the JSON, extra keys, a refusal, an over-budget sentence — is rejected, and the cue is emitted with `status: failed`.
- **A throttle is not an outage** (`limits.bedrock.on_throttle`). Exponential backoff, at most `MAX_ATTEMPTS` (**5**), then the cue is written `status: failed` and the track still emits. The pipeline is offline and batched, so a throttle costs wall-clock time, never a broken demo.

**And one that is new since R13 made gaps one-to-many:**

- **A middle window is not a film boundary, and both look identical.** A cue window split out of the middle of a long gap has `before === null` and `after === null` — exactly like the gap that opens the film and the gap that closes it. Given the same prompt, `C9` is told *"this gap opens the film"* for every middle window of every split gap. `CueWindow.part_index` / `part_count` exist to separate the two cases, and the prompt below branches on them. This is the kind of error the one-to-many rescope introduces silently: nothing throws, every cue comes back, and the descriptions are subtly about the wrong thing.

**Code — as built.** The spec's first draft of this phase was one file holding the Bedrock client, the prompt and the validation together. It was built as two components so that `D4` costs a provider, not the phase:

`pipeline/providers/` (`changes[C30]`) — the seam, and its three implementations:

```ts
export interface VisionRequest { images: Buffer[]; text: string; maxTokens: number }
export interface DescriptionProvider {
  readonly id: 'bedrock' | 'anthropic' | 'fake';
  readonly modelId: string;            // what contracts.description_track.model_id records
  readonly usage: ProviderUsage;       // calls, input_tokens, output_tokens — what a run cost
  describe(req: VisionRequest): Promise<string>;
}
```

- `bedrock.ts` — `BedrockConverseProvider`: the **Converse** API (`endpoints.bedrock_invoke`), one `image` block per frame then the text, `BEDROCK_MODEL_ID`, `inferenceConfig.maxTokens`. `ThrottlingException` / `TooManyRequestsException` / `ServiceUnavailableException` are `retryable` and go through `withBackoff` — `limits.bedrock.on_throttle`, `MAX_ATTEMPTS` (**5**), waits of 1 / 2 / 4 / 8 s. A `ValidationException` whose message carries `Error 002` is **not** a throttle: it is thrown once as a fatal `ProviderError` whose message names `DESCRIPTION_PROVIDER=anthropic` and `ANTHROPIC_API_KEY`.
- `anthropic.ts` — `AnthropicProvider`: `@anthropic-ai/sdk` Messages API, base64 `image` blocks then the text, `ANTHROPIC_API_KEY` read by the SDK, `ANTHROPIC_MODEL_ID` defaulting to `claude-sonnet-5-5` (the latest Sonnet the installed SDK's `Model` type names). The SDK's own retries are off (`maxRetries: 0`) so attempts are counted in one place; `RateLimitError`, `InternalServerError`, `APIConnectionError` and 529 are retryable. A `stop_reason: "refusal"` returns an empty string, so validation fails the cue — never a hand-written one.
- `fake.ts` — `FakeProvider`: scripted answers for the suite, or answers derived from the prompt (the cast prompt gets three lines, a cue prompt gets `{"description": …}` of about the words it asked for). `fakeSynthesize` is the fake Polly: with ffmpeg on PATH it writes real silence in the `C10` container — fragmented mp4, AAC-LC — for as long as the sentence would take at `limits.ad.speaking_rate_wpm`, so a dry-run track is one the app can append and schedule.
- `index.ts` — `selectProvider(env, { dryRun })`: fake on a dry run; else `DESCRIPTION_PROVIDER`, default `bedrock`; `anthropic` refuses to start without `ANTHROPIC_API_KEY` (or `ANTHROPIC_AUTH_TOKEN`), naming it.

`pipeline/describe.ts` (`changes[C9]`) — pure functions first, so every rule below is a unit test and not a hope:

| export | what it is |
|---|---|
| `asData(lines)` | the `S2` fence: `<subtitles>…</subtitles>`, any closing tag *inside* a subtitle rewritten to `[tag]`, case-insensitive |
| `buildCastPrompt(openingSubtitles)` | the dramatis personae prompt — at most six lines, names only where dialogue supplies them, the fence and the data notice |
| `parseCast(raw)` | trims the answer to ≤ 6 non-empty lines, list markers stripped; empty on a refusal |
| `buildCuePrompt({cue, frameCount, verbosity, cast, rollingContext, retryAfter?})` | the per-cue prompt: the cast, the last `limits.ad.rolling_context_cues` (**10**) descriptions and no more, both neighbouring lines *fenced*, the `part_index`/`part_count` branches below, `Aim for about ${word_target}` and `MUST NOT exceed ${word_ceiling}`; with `retryAfter` set, a closing paragraph that names the rejection and restates the ceiling |
| `validateDescription(raw, budget)` | `{ok, text, words}` or `{ok: false, reason}` with reason ∈ `no_json` · `bad_json` · `shape` (not an object, a second key, a non-string) · `empty` · `over_budget` (`AC4`). Prose around the one JSON object is tolerated; nothing inside it is |
| `describeCue(provider, cue, frames, verbosity, cast, rolling)` | one call; if rejected, **one** retry with `retryAfter`; then `status: failed` with the reason. A retryable `ProviderError` that outlived its attempts is one failed cue (`01` §4 — the track still emits). Any other error — `Error 002`, a bad key — is **rethrown**, because it would fail every cue the same way and must stop the run with its message intact |
| `buildDramatisPersonae(provider, openingFrames, openingSubtitles)` | the one call per asset, `maxTokens` 400 |

Both prompts open by stating that the fenced content is **data** and may contain text that looks like instructions. The target and the ceiling are read off the `CueWindow` — `C7` computed them against this window's own duration, and recomputing them here would be a second site for the same number to drift. `maxTokens` for a cue is `max(64, word_ceiling × 4)`.

**The boundary branches, which are the R13 hazard.** A null neighbour means one of two opposite things, and `part_count > 1` tells them apart:

| `before` | `after` | `part_index` / `part_count` | the prompt says |
|---|---|---|---|
| line | line | 1 / 1 | both lines, fenced |
| null | line | 1 / 1 | *"This silence opens the film."* |
| line | null | 1 / 1 | *"This silence closes the film."* |
| null | null | 2 / 4 | *"Silence continues from the previous description; do not re-establish the scene."* · *"The silence continues after this window; do not summarise or conclude."* · *"part 2 of 4"* |
| null | line | 3 / 3 | *"Silence continues from the previous description…"* then the next line, fenced |

**Idempotence and the paid calls** live in `pipeline/run.ts` (`changes[C29]`, described in `02b2` Phase 6): the cast is cached once per asset, descriptions are cached per window key *and level*, and only an `ok` entry is final — a `failed` one is retried on the next run, which is how `AC14` regenerates the worst cues without re-paying for the rest.

**Measured, 2026-10-18, dry run on the demo asset:** 39 gaps → 47 / 55 / 60 cues → **163 calls** (162 cues + the cast pass), the R22 figure reproduced by running rather than multiplying. With the real asset present, `C8` extracted 120 JPEGs for the 60 windows (21 windows with one frame, 19 with two, 20 with three) in 28 s; a second run reused all 60 and made 0 calls.

> **`AC7` lives here.** No cue text is hand-written. If a cue comes back unusable, the correct move is to regenerate it (`AC14`), never to type a better sentence into the track file. A hand-written cue that reaches the demo makes `AC7` false and the claim in the submission untrue.

**Contracts implemented:** `changes[C9]`, `changes[C30]`, `decisions.dramatis_personae`, `limits.ad.max_words_per_cue`, `limits.ad.verbosity_scales`, `limits.ad.rolling_context_cues`, `limits.ad.frames_per_gap_max`, `limits.bedrock.on_throttle`, `endpoints.bedrock_invoke`, `env_vars` (`AWS_REGION`, `BEDROCK_MODEL_ID`, `DESCRIPTION_PROVIDER`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL_ID`), `contracts.description_cue.status`, `alternatives[A5]`

> **Rolling context is per level, not shared.** `concise` and `detailed` produce different sentences for the same window, so feeding one level's history into another's prompt is what `AC18` would catch as incoherence. Run the three levels as three passes, each with its own `rollingContext`; the **cast map is the one thing shared**, because it is a property of the film rather than of the track.

**Phase 5 verification:** `⟨commands.tests⟩` → a line containing `⟨commands.tests_expect⟩` (no network: the suites are `pipeline/__tests__/describe.test.ts`, `providers.test.ts`, `run.test.ts`). The injection and over-budget rejection cases each carry a `Fails if:` line — a shape validator that accepts everything passes a happy-path test by construction. Then `npm run pipeline -- --dry-run` → `INTERSTICE.run.done … cues=concise:47/47,standard:55/55,detailed:60/60 provider=fake calls=163`. **The paid end-to-end run is still blocked by `D4`** (re-measured 2026-10-18) **and by the absence of an `ANTHROPIC_API_KEY`**; `pipeline/__tests__/contract.track.test.ts` runs against the real emitted files under `generated/tears-of-steel/` and is skipped, visibly, until a real run has left them there. `acceptance[AC7]` records the attempt.

**Done 2026-10-18 (R47-W2) — built, not run.** The split that was described in prose above — swap the provider, touch nothing in `C7`, `C8`, `C10` or `src/` — is now a type, and both the Bedrock and the Anthropic implementations compile against it. Which one first produces a real cue is the owner's call and a key.

---

---

---

## Continues in `02b2-track-output.md`

**Phase 6 moved there in R22**, when this file passed the 600-line split threshold. It holds synthesis (`C10`): Polly, the fragmented-AAC container that `limits.vega_media.url_mode_broken` forces, and the three per-verbosity track files. Nothing was summarised — the cut is on the phase boundary.
