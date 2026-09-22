# Implementation + E2E tests — Interstice — AI audio description in the gaps between dialogue, on Fire TV

> Complements `01-master-plan.md`. File-by-file build steps + the end-to-end test plan.
> Written by `implement` (stage 2) — after `review` ran (R5), its findings were dispositioned (R6), and the owner confirmed with the flip to `status: reviewed` (R7). `new` does not write this document.

- **Date:** 2026-09-19
- **Branch:** `main`
- **Test baseline:** `aborted_no_conditions` — the repo holds no application code yet. `_profile.yml commands.tests` / `tests_expect` / `lint` / `build` / `device_log` / `force_stop` are all `null`, and **Phase 1 is the phase that fills them from a real run.** Until it does, no verification line in this set can name a test command, and none pretends to.

> Shared data comes from `_facts.yml`; commands come from `_profile.yml`. Cross-refs to `01-master-plan.md §N` resolve to real sections.
> **This document is executable, not descriptive.** Its reader is whoever builds it — possibly a smaller model with no context on how it was written.

> **Doc 02 is five files, and this is the first.** It carries the preamble that governs all five, plus **Part A, Phases 0–3**: the spike gate, the repo scaffold, the contracts rendered in code, and gap detection (`C7`). This is a greenfield build — every phase carries a full-file code block — so the implementation document is split on top-level phase boundaries per `references/doc-pattern.md` §Splitting an oversized doc. No technical content differs from a single-file version.
>
**The set of five:** `02` (preamble, Phases 0–3: spike gate, scaffold, contracts in code, gap detection) · `02b` (Phases 4–6: frames, description, synthesis) · `02c` (Phases 7–11: the platform seam and the playback layer) · `02d` (Phases 12–17: screens, shell, the `[MANUAL]` deliverables) · `02e` (Part B test plan, Part C manual E2E, the Definition of Done, and the coverage map against `01-master-plan.md` §7).

---

## Changelog

Same tag + date spine as `01-master-plan.md` (`_facts.yml dates.revisions[]`), showing only what changes the build.

### 2026-09-22 — v8: `detailed` verbosity made reachable for real

`execute` round R9, while running Phase 1. R8's clamp was the right diagnosis and the wrong fix: 100 ms at 160 wpm is 0.27 words, so it never crosses a floor boundary and `standard === detailed` at every gap size. `limits.ad.hard_ceiling_words` is removed. `limits.ad.verbosity_scales` are now **targets under one physical ceiling** — ×0.6 / ×0.85 / ×1.0 — and Phase 2 exports `wordTarget` (what the prompt asks for) and `wordCeiling` (what validation rejects against) instead of a budget and a clamp.

### 2026-09-21 — v7: doc 02 written

`implement` round R8. The five files of doc 02, plus doc 03.

### 2026-09-19 — v6: owner confirmed — `status: draft -> reviewed`

Docs 02 and 03 come into scope. Nothing about the build changed.

### 2026-09-19 — v5: review R5 dispositions — contracts corrected, TypeSafe deferred

Two contract corrections that this document implements directly: `contracts.description_cue.source_frames_ms` is an array (Phase 2, Phase 6) and `contracts.description_track.verbosity` is a field with a stated file-naming rule (Phase 6). `C15`/`C16` are `kind: deferred`, so **no phase in this document calls TypeSafe** and `TYPESAFE_API_KEY` is read by nothing.

### 2026-09-19 — v4: TypeSafe judgment layer

Superseded by v5 for build purposes. Recorded because `endpoints.typesafe_systemone` and `TYPESAFE_API_KEY` still exist in the registry.

### 2026-09-19 — v3: verbosity levels, dramatis personae, gap visualization

Three additions this document implements: the per-level regeneration and file-naming rule (Phase 6), the dramatis personae pass as `C9`'s first Bedrock call (Phase 5), and `C7` emitting gap data consumable by the visualization render (Phase 3, consumed in `02d` Phase 16).

### 2026-09-19 — v2: multi-frame input, rolling context, dialogue-bearing asset

`C8` moves from one midpoint frame to up to `limits.ad.frames_per_gap_max` with scene detection (Phase 4); `C9` carries the last `limits.ad.rolling_context_cues` descriptions forward (Phase 5).

### 2026-09-19 — v1: initial decision draft

The shape this document builds.

---

## Preamble — ground rules (governs `02` and `02b`)

**Language and layout.** TypeScript everywhere, ES modules, strict mode. Two roots that never import each other:

```
pipeline/     # Node. Runs on the developer machine. Holds AWS credentials.
src/          # React Native on Vega OS. Runs on the device. Holds NO credentials.
src/platform/ # the only directory that touches a Vega API (see Phase 7 in `02b`)
```

`pipeline/` and `src/` share exactly one thing — the shape of the track file — and they share it by **both** being checked against `_facts.yml contracts.*`, not by importing each other. `src/ad/TrackLoader.ts` re-validates at runtime (`02c` Phase 8) precisely because it does not trust that the producer was this pipeline.

**Notation for commands.** `⟨commands.tests⟩` means *the current value of `_profile.yml commands.tests`*. Every such key is `null` today. Phase 1 fills them by running the real thing and copying the literal output; every later `Phase N verification:` then resolves. A command typed straight into a verification line — `npm test`, guessed — is exactly the failure `_profile.yml` exists to prevent: it gets carried into every doc and the executor runs it.

**Logging convention.** Every diagnostic line starts with the profile's `log_tag`, `INTERSTICE`, then a dotted emitter name, then `key=value` pairs. The emitter name is mandatory and must be unique per call site — two call sites printing the same varying field are indistinguishable in a log and the run answers nothing:

```
INTERSTICE.gaps.found n=41 min_ms=1500 shortest_ms=1512 longest_ms=9840
INTERSTICE.frames.extracted gap=17 frames=3 at_ms=[104200,105900,107100]
INTERSTICE.describe.cue gap=17 words=12 budget=14 attempt=1 status=ok
INTERSTICE.describe.cue gap=18 words=0 budget=9 attempt=5 status=failed
```

`frame` and `duck` lines are reserved: they are the two lines that settle `D1` and `D2` (`_facts.yml defects[].log_line`) and they appear in Phase 0 only.

**Registry keys are the contract.** Every phase lists the `_facts.yml` keys it implements. If a phase's code drops one, that is visible by comparing the two lists — which is the only self-check an executor with no context can run.

**Three deferred components are not in this document.** `C11` (`src/ad/LiveCapture.ts`), `C15` (`pipeline/normalize_cast.ts`), `C16` (`pipeline/subtitle_guard.ts`) are `kind: deferred` in `_facts.yml changes[]`. No phase below creates them, and no phase below leaves a hook for them. They reopen through their `reopens_when:` and through a new `implement` round, not by being half-built here.

---

# Part A — Implementation plan

Phases run in dependency order. `[MANUAL]` marks a phase an autonomous executor must stop at: it needs a dashboard, a device, a person, or a judgment call.

---

## Phase 0 — [MANUAL] Spike gate: `D3`, `D2`, `D1`, and the two clocks that are not ours

**File:** `spikes/` (new directory) + `docs/features/_profile.yml` (existing, 34 lines)
**Anchor:** new directory. The profile edit anchors at `docs/features/_profile.yml:14` — `commands:`
**Maps to:** `01-master-plan.md` §3.2 Phase 0, `01-master-plan.md` §3.3

**What changes:** nothing in the product. This phase exists to resolve three hypotheses that are `basis: asserted` in `_facts.yml defects[]`, and two of them can change the plan entirely. **Run `D3` before anything else in this repository** — it is the only one whose failure invalidates the platform choice rather than a feature (`01-master-plan.md` §3.3).

**Order, and the observation that settles each:**

**0.1 — `D3`: the Vega OS simulator installs, runs, and plays the demo asset.**
Install the Vega SDK and simulator per Amazon's current developer documentation, create the stock starter app, run it, then load a local video file. Three distinct observations, recorded separately:
- the simulator starts and the starter app renders → `D3` half-confirmed
- the simulator plays the demo asset end to end → `D3` confirmed
- either fails → `D3.outcome` is written false, `alternatives A4` (Fire OS Android build) reopens **immediately and becomes the plan**, and every `src/` phase in `02b` is re-targeted at React Native for Android TV. The pipeline phases in this document are unaffected — they are platform-independent by construction.

**0.2 — `D2`: a second audio stream plays while the video volume ducks.**
In the starter app, start the asset, then start a short audio file on a second player and lower the video player's volume to `limits.ad.duck_target_pct` (25) over `limits.ad.duck_ramp_ms` (200 ms).

```
[TEMPORARY INSTRUMENTATION — removed in `02d` Phase 17]
// emits _facts.yml defects[D2].log_line
console.log(`INTERSTICE.duck from=${previousVolume} to=${targetVolume}`);
```

- both audible, the level actually changes → `D2` confirmed, `C4` is built as specified in `02c` Phase 10.
- the platform stops one stream, or the duck call returns without changing the audible level → `D2` false, and `decisions.d2_fallback` applies: the pipeline pre-mixes a second full-length audio track (ducking and cues baked in) and the app toggles description by **audio-track switching**. That changes Phase 6 of this document (it gains a pre-mix output) and `02c` Phase 10 (it becomes a track switch). Pausing the asset per cue is the last resort, not the plan.
- **The `duck` line printing without the audible level changing is the trap**, and it is why the observation above is *audible*, not *logged*. A log line proving the call returned is not evidence the platform honoured it.

**0.3 — `D1`: the currently rendered frame is reachable from JavaScript.**
Ask the Vega media API surface for the current frame on a playing asset.

```
[TEMPORARY INSTRUMENTATION — removed in `02d` Phase 17]
// emits _facts.yml defects[D1].log_line
console.log(`INTERSTICE.frame w=${frame.width} h=${frame.height} bytes=${frame.byteLength}`);
```

- a decodable buffer with non-zero dimensions and a plausible byte length → `D1` confirmed, `C11` reopens through a new `implement` round. **It does not get built in this one.**
- no frame accessor, or an empty or black buffer → `D1` false, `C11` stays deferred, and nothing else moves. This is the entire point of `decisions.hybrid_ad_path`.

**0.4 — [MANUAL] Request the AWS promotional credits.** `limits.hackathon.aws_credits_usd` is **$150** and the request deadline is **2026-10-21 12:00 PT**. Requested on day 1 of Phase 0, not when the bill appears.

**0.5 — [MANUAL] Open recruitment for the `AC20` participant.** `owners.external` names a blind or low-vision validation participant who is not on this team and runs on their own clock (`tracking.blocked_by`). The session itself is five weeks away in Phase 5; recruiting is not a three-day task. **Confirmed by 10-16 or `AC20` is dropped** per `decisions.user_validation`, and the submission says so rather than slipping.

**0.6 — [MANUAL] Choose the demo asset and record its license.** Per `decisions.demo_asset_licensing`: an openly licensed asset (Blender Foundation open movie, CC-BY) that carries **substantial dialogue**. Candidates: *Tears of Steel*, *Elephants Dream*. Reject *Big Buck Bunny* and *Sintel* — a near-dialogue-free film collapses the gap structure into one continuous gap and there is no mechanism left to demo. Download the published WebVTT subtitles and confirm by eye that they carry real dialogue timing, not a single caption block. Record the license and the source URL in `README.md`.

**0.7 — [MANUAL] Start `FRICTION-LOG.md` now, not in Phase 5.** `decisions.friction_log_shape`. Phase 0 is where the Vega SDK install, the simulator, and the credits request produce the most friction in the whole build, and a log reconstructed later reads as fabricated and scores zero. See `02d` Phase 15 for the shape.

**Contracts implemented:** `_facts.yml defects[D3]`, `defects[D2]`, `defects[D1]`, `limits.hackathon.aws_credits_usd`, `limits.hackathon.aws_credits_request_deadline`, `decisions.d2_fallback`, `decisions.hybrid_ad_path`, `decisions.demo_asset_licensing`, `decisions.user_validation`, `decisions.friction_log_shape`, `tracking.blocked_by`

**Phase 0 verification:** `[MANUAL]`. The phase closes when each of `D3`, `D2`, `D1` has `status: resolved` and a non-null `outcome:` written into `_facts.yml defects[]` with the observation that produced it — and, for any that came back false, the consequence above applied **in the registry first**, then propagated. A hypothesis left `open` after Phase 0 is not a Phase 0 that finished; it is a Phase 1 built on sand.

---

## Phase 1 — Repository scaffold, and filling `_profile.yml` from a real run

**File:** `package.json`, `tsconfig.json`, `vitest.config.ts` (all new) + `docs/features/_profile.yml:14` (existing)
**Anchor:** new files. The profile edit anchors at `docs/features/_profile.yml:14` — `commands:`
**Maps to:** `_facts.yml tests_baseline`, `01-master-plan.md` §3.2 Phase 1

**What changes:** the repository gains a TypeScript toolchain and a test runner, and — the actual deliverable — `_profile.yml commands.*` stops being `null`. Every verification line in the rest of this set depends on this phase and on nothing else in it.

**Code:**

`package.json` (new file, full contents):

```json
{
  "name": "interstice",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "lint": "tsc --noEmit",
    "pipeline": "tsx pipeline/run.ts"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.6.0",
    "vitest": "^5.0.1"
  },
  "dependencies": {
    "@aws-sdk/client-bedrock-runtime": "^3.0.0",
    "@aws-sdk/client-polly": "^3.0.0"
  }
}
```

`tsconfig.json` (new file, full contents):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["pipeline", "src"]
}
```

`vitest.config.ts` (new file, full contents):

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['pipeline/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
  },
});
```

**1.1 — Fill the profile from output, not from memory.** Run `npm install`, then `npm audit`. Then `npm test`.

> **Two things this phase got wrong on paper and the first real run corrected. Both are recorded so the next executor does not rediscover them.**
> **`vitest ^2.0.0` was pinned from the author's knowledge and is not installable in good conscience** — it carries a path-traversal advisory through `@vitest/mocker` and an `esbuild` dev-server advisory, and `npm audit` reports 5 vulnerabilities including one critical. The repository must be **public** (`limits.hackathon.repo_must_be`) and the judges clone and run it. `^5.0.1` installs clean: `found 0 vulnerabilities`. Run `npm audit` as part of this phase, not as a courtesy — a submission that ships a critical advisory is a submission whose setup instructions a judge stops following.
> **`vitest run` with no test files exits 1**, printing `No test files found, exiting with code 1`. There is no pass line to copy, so `tests_expect` cannot be measured from an empty repository. **Phase 2's first test is therefore a precondition of finishing Phase 1**, not a later step: write `pipeline/types.ts`, `pipeline/budget.ts` and `pipeline/__tests__/budget.test.ts`, run the suite, and measure the baseline against a run that actually asserts something. A `--passWithNoTests` flag would produce a green line that proves nothing, which is a worse oracle than none.

Copy the **literal** summary line vitest prints into the profile. Then write:

```yaml
# docs/features/_profile.yml — replacing the `null`s at :14
commands:
  tests:        "npm test"
  tests_expect: "<the literal substring vitest prints on a passing run — copy it, do not type it>"
  lint:         "npm run lint"
  build:        null    # filled in `02d` Phase 13, once the Vega build command is known from Phase 0.1
  device_log:   null    # filled in `02d` Phase 13, from whatever Phase 0.1 showed reads simulator output
                        # vitest has no count-free pass-only substring — a partial
                        # failure still prints "passed" — so the authoritative pass
                        # signal is EXIT 0 and tests_expect is the literal full-pass
                        # line at the current count, re-measured when the count moves.
  force_stop:   null
  file_tracked: "git ls-files --error-unmatch {path}"
  file_ignored: "git check-ignore -v {path}"
```

`build` and `device_log` stay `null` here **on purpose**: Phase 0.1 is what reveals the Vega CLI's real commands, and a guessed one is worse than none — `evidence.cmd` carries it into every document and the executor runs it.

**1.2 — Re-measure `tests_baseline`.** `_facts.yml tests_baseline` currently reads `outcome: aborted_no_conditions` with `aborted_because: 'the repo holds no application code yet'`. That condition no longer holds. Re-run and replace the whole block with a `basis: measured` entry carrying `how: shell`, `cmd: npm test`, the date, and the literal `value:` from the run. **The value must contain `commands.tests_expect` as a substring** — audit check 15 compares them.

**Contracts implemented:** `_facts.yml tests_baseline`, `_profile.yml commands.tests`, `commands.tests_expect`, `commands.lint`

**Phase 1 verification:** `⟨commands.tests⟩` → exit 0 and a line containing `⟨commands.tests_expect⟩`; `⟨commands.lint⟩` → exit 0 with no output; `npm audit` → `found 0 vulnerabilities`. Both profile keys are non-`null` by the end of this phase, which is the phase's real assertion: `rg -n 'tests:\s+null' docs/features/_profile.yml` returns nothing.

---

## Phase 2 — `pipeline/types.ts` and `pipeline/budget.ts` — the registry, in code

**File:** `pipeline/types.ts` (new), `pipeline/budget.ts` (new)
**Anchor:** new files, full contents below.
**Maps to:** `_facts.yml contracts.description_track`, `contracts.description_cue`, `limits.ad`, `limits.clip_cache`

**What changes:** the two contracts and every numeric limit get exactly one representation in code. Nothing downstream re-declares a field name or a number; a phase that needs `1500` imports it. These files are the only place in the repository allowed to restate a `_facts.yml` value, and each restated value carries the registry key it came from in a comment, so a `sync` round can find it.

**Code:**

`pipeline/types.ts` (new file, full contents):

```ts
// Mirrors _facts.yml contracts.* field for field. Changing a field here without
// changing the registry is the drift this whole spec set exists to prevent.

/** _facts.yml contracts.description_track.verbosity */
export type Verbosity = 'concise' | 'standard' | 'detailed';

/** _facts.yml contracts.description_cue.status */
export type CueStatus = 'ok' | 'failed';

/** _facts.yml contracts.description_cue */
export interface DescriptionCue {
  id: string;
  start_ms: number;
  end_ms: number;
  words: number;
  text: string;
  audio_uri: string;
  source_frames_ms: number[];
  status: CueStatus;
}

/** _facts.yml contracts.description_track */
export interface DescriptionTrack {
  version: string;
  asset_id: string;
  generated_at: string;
  source_subtitles: string;
  verbosity: Verbosity;
  model_id: string;
  cues: DescriptionCue[];
}

export const VERBOSITY_LEVELS: readonly Verbosity[] = ['concise', 'standard', 'detailed'];

/**
 * decisions.verbosity_levels LOOKUP RULE: one track file per level, named
 * `<asset_id>.<verbosity>.track.json` beside the asset. The app resolves a level
 * switch by this name and falls back to `standard`.
 */
export function trackFileName(assetId: string, verbosity: Verbosity): string {
  return `${assetId}.${verbosity}.track.json`;
}
```

`pipeline/budget.ts` (new file, full contents):

```ts
import type { Verbosity } from './types.js';

/** _facts.yml limits.ad */
export const AD = {
  MIN_GAP_MS: 1500,            // limits.ad.min_gap_ms
  SPEAKING_RATE_WPM: 160,      // limits.ad.speaking_rate_wpm
  DUCK_TARGET_PCT: 25,         // limits.ad.duck_target_pct
  DUCK_RAMP_MS: 200,           // limits.ad.duck_ramp_ms
  FRAMES_PER_GAP_MAX: 3,       // limits.ad.frames_per_gap_max
  ROLLING_CONTEXT_CUES: 10,    // limits.ad.rolling_context_cues
  BUDGET_MARGIN_MS: 300,       // the `- 300` in limits.ad.max_words_per_cue
} as const;

/**
 * _facts.yml limits.ad.verbosity_scales — TARGETS as a fraction of the physical
 * ceiling, never multipliers of it. Every value is <= 1.0 by construction.
 */
export const VERBOSITY_SCALES: Record<Verbosity, number> = {
  concise: 0.6,
  standard: 0.85,
  detailed: 1.0,
};

/** _facts.yml limits.clip_cache.max_clips_in_memory */
export const MAX_CLIPS_IN_MEMORY = 8;

/** _facts.yml limits.bedrock.on_throttle — "exponential backoff, max 5 attempts" */
export const MAX_ATTEMPTS = 5;

function wordsIn(ms: number): number {
  return Math.floor((ms / 1000) * AD.SPEAKING_RATE_WPM / 60);
}

/**
 * _facts.yml limits.ad.max_words_per_cue:
 *   floor((gap_ms - 300) / 1000 * 160 / 60)
 * This is the STANDARD-level budget. The 300 ms subtrahend is the duck ramp
 * (200 ms) plus a 100 ms margin.
 */
export function baseWordBudget(gapMs: number): number {
  return Math.max(0, wordsIn(gapMs - AD.BUDGET_MARGIN_MS));
}

/**
 * The number of words the C9 prompt ASKS FOR at this level. Always <= the
 * ceiling, so no clamp is needed and none exists.
 */
export function wordTarget(gapMs: number, verbosity: Verbosity): number {
  return Math.floor(baseWordBudget(gapMs) * VERBOSITY_SCALES[verbosity]);
}

/**
 * The number of words a cue may not exceed, at any level. This is what C9's
 * shape validation rejects against and what AC4 is scored on. It does not vary
 * by verbosity: the gap is the gap.
 */
export function wordCeiling(gapMs: number): number {
  return baseWordBudget(gapMs);
}
```

> **Why every scale is ≤ 1.0, and why there is no clamp.** `max_words_per_cue` is a *physical* ceiling — the gap is the time available, and `AC4` is scored on never exceeding it. A verbosity level above 1.0 is therefore unreachable by construction, which is the trap this set fell into twice. R3 set the scales to ×0.6 / ×1.0 / ×1.35. R8 noticed `detailed` was unreachable and added a separate clamp that subtracted only the duck ramp. R9 **ran the arithmetic** and found the clamp changes nothing: 100 ms at 160 wpm is 0.27 words, so it never crosses a floor boundary and `standard === detailed` at every gap size from 1500 ms to 12000 ms. The fix is to stop treating the scales as multipliers of the ceiling and treat them as *targets under* it — `wordTarget` is what the prompt asks for, `wordCeiling` is what validation rejects against, and the three levels are then strictly distinct at every gap size ≥ `limits.ad.min_gap_ms`. Both wrong attempts stay recorded in `limits.ad.note` so a fourth round does not re-derive them.

**Contracts implemented:** `contracts.description_track`, `contracts.description_cue`, `limits.ad.*` (all keys), `limits.clip_cache.max_clips_in_memory`, `limits.bedrock.on_throttle`, `decisions.verbosity_levels` (lookup rule + the target-under-one-ceiling rule)

**Phase 2 verification:** `⟨commands.lint⟩` → exit 0. Then `⟨commands.tests⟩ pipeline/__tests__/budget.test.ts` → a line containing `⟨commands.tests_expect⟩`; the assertions are in `02e` §B.1.

---

## Phase 3 — `pipeline/gaps.ts` (`C7`) — every dialogue gap ≥ 1500 ms

**File:** `pipeline/gaps.ts` (new)
**Anchor:** new file, full contents below.
**Maps to:** `_facts.yml changes[C7]`, `limits.ad.min_gap_ms`, `AC4`, `AC19`

**What changes:** the WebVTT file becomes a list of gaps. This is the whole timing foundation — the hard problem is solved by data that ships with the asset rather than by inference (`01-master-plan.md` §2) — and it is also the data source the gap-timeline visualization renders from (`decisions.gap_visualization`, `AC19`, consumed in `02d` Phase 16).

Three things the naive version gets wrong, all handled below: subtitles that **overlap** (two speakers) must be merged before differencing or they manufacture negative gaps; the span **before the first** subtitle and **after the last** are real gaps and are usually the longest in the film; and a gap is bounded by the asset duration, not by the last caption.

**Code:**

`pipeline/gaps.ts` (new file, full contents):

```ts
import { AD } from './budget.js';

export interface Subtitle {
  start_ms: number;
  end_ms: number;
  text: string;
}

export interface Gap {
  index: number;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  /** the subtitle immediately before this gap, or null if the gap opens the asset */
  before: Subtitle | null;
  /** the subtitle immediately after this gap, or null if the gap closes the asset */
  after: Subtitle | null;
}

const TIMING = /^(\d{1,3}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{1,3}:\d{2}:\d{2}[.,]\d{3})/;

export function parseTimestamp(ts: string): number {
  const m = /^(\d{1,3}):(\d{2}):(\d{2})[.,](\d{3})$/.exec(ts.trim());
  if (!m) throw new Error(`INTERSTICE.gaps.badTimestamp ts=${ts}`);
  const [, h, min, s, ms] = m as unknown as [string, string, string, string, string];
  return ((Number(h) * 60 + Number(min)) * 60 + Number(s)) * 1000 + Number(ms);
}

export function parseWebVtt(source: string): Subtitle[] {
  const subs: Subtitle[] = [];
  const blocks = source.replace(/\r\n/g, '\n').split(/\n{2,}/);

  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    const timingLine = lines.find((l) => TIMING.test(l));
    if (!timingLine) continue; // WEBVTT header, NOTE blocks, cue identifiers alone

    const m = TIMING.exec(timingLine)!;
    const start_ms = parseTimestamp(m[1]!);
    const end_ms = parseTimestamp(m[2]!);
    const text = lines
      .slice(lines.indexOf(timingLine) + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '') // strip WebVTT inline tags (<v Speaker>, <i>)
      .trim();

    if (end_ms > start_ms) subs.push({ start_ms, end_ms, text });
  }

  return subs.sort((a, b) => a.start_ms - b.start_ms);
}

/**
 * Overlapping or touching subtitles are one span of speech. Differencing without
 * this step manufactures negative gaps wherever two speakers overlap.
 */
export function mergeSpeech(subs: Subtitle[]): Subtitle[] {
  const merged: Subtitle[] = [];
  for (const s of subs) {
    const last = merged[merged.length - 1];
    if (last && s.start_ms <= last.end_ms) {
      last.end_ms = Math.max(last.end_ms, s.end_ms);
      last.text = `${last.text} ${s.text}`.trim();
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}

/** _facts.yml changes[C7]: every dialogue gap >= limits.ad.min_gap_ms. */
export function findGaps(subs: Subtitle[], assetDurationMs: number): Gap[] {
  const speech = mergeSpeech(subs);
  const gaps: Gap[] = [];
  let cursor = 0;
  let before: Subtitle | null = null;

  const push = (start: number, end: number, after: Subtitle | null) => {
    const duration = end - start;
    if (duration >= AD.MIN_GAP_MS) {
      gaps.push({
        index: gaps.length,
        start_ms: start,
        end_ms: end,
        duration_ms: duration,
        before,
        after,
      });
    }
  };

  for (const s of speech) {
    push(cursor, s.start_ms, s);       // the span before this line of dialogue
    cursor = s.end_ms;
    before = s;
  }
  push(cursor, assetDurationMs, null); // the span after the last line

  return gaps;
}

export function logGaps(gaps: Gap[]): void {
  const durations = gaps.map((g) => g.duration_ms);
  console.log(
    `INTERSTICE.gaps.found n=${gaps.length} min_ms=${AD.MIN_GAP_MS}` +
      ` shortest_ms=${durations.length ? Math.min(...durations) : 0}` +
      ` longest_ms=${durations.length ? Math.max(...durations) : 0}`,
  );
}
```

> **The gap that opens the asset and the gap that closes it are usually the longest.** They are also the two most valuable description slots in a film — the establishing shot and the last image. `findGaps` emits both, and `before`/`after` are `null` there, which Phase 5 must handle rather than assume a neighbouring subtitle exists.

**Contracts implemented:** `changes[C7]`, `limits.ad.min_gap_ms`

**Phase 3 verification:** `⟨commands.tests⟩ pipeline/__tests__/gaps.test.ts` → a line containing `⟨commands.tests_expect⟩`. Assertions in `02e` §B.1, including the overlap case, both boundary gaps, and the sub-threshold rejection.

---

---

## Continues in `02b-pipeline-model.md`

Nothing was truncated. This file ends after `C7`, where the pipeline stops being pure data handling and starts calling models.

- **`02b-pipeline-model.md`** — Phases 4–6: `C8` frame extraction, `C9` description, `C10` synthesis and the three track files.
- **`02c-app-playback.md`** — Phases 7–11: the `MediaAdapter` seam, `C6` loader, `C3` scheduler, `C4` audio, `C5` controls.
- **`02d-screens-and-delivery.md`** — Phases 12–17: `C2` screen, `C1` shell, the `[MANUAL]` deliverables `C12`/`C13`/`C14`, and the instrumentation removal.
- **`02e-tests-and-done.md`** — Part B (test plan, including the `02e` §B.0 mock preamble every phase refers to), Part C (manual E2E), the Definition of Done against all twenty `acceptance[]` criteria, and the coverage map against `01-master-plan.md` §7.
