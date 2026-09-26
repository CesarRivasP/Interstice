# Implementation (5 of 5) + E2E tests — Interstice — the test plan and the Definition of Done

> Complements `01-master-plan.md`. **Part B** (unit and contract tests), **Part C** (manual E2E), the **Definition of Done**, and the **coverage map** against `01-master-plan.md` §7.

- **Date:** 2026-09-19
- **Branch:** `main`
- **Test baseline:** `aborted_no_conditions` until `02` Phase 1 measures it. Every verification below resolves through `_profile.yml`, never through a command invented for this document.

> **The preamble of `02-implementation-and-e2e.md` governs this file too** — language and layout, the `⟨commands.*⟩` notation, the logging convention, the "registry keys are the contract" rule, and the three deferred components (`C11`, `C15`, `C16`) that appear in none of the five halves. It is not repeated here.
> Split per `references/doc-pattern.md` §Splitting an oversized doc. No technical content differs from a single-file version.

**The set of seven:** `02` (preamble, Phases 0–3: spike gate, scaffold, contracts in code, gap detection) · `02b` (Phases 4–5: frames, description) · `02b2` (Phase 6: synthesis and the track files) · `02c` (Phases 7–9: the platform seam, the loader, the scheduler) · `02c2` (Phases 10–11: description audio, the control surface) · `02d` (Phases 12–17: screens, shell, the `[MANUAL]` deliverables) · `02e` (Part B test plan, Part C manual E2E, the Definition of Done, and the coverage map against `01-master-plan.md` §7).

---

## Changelog

Same tag + date spine as `01-master-plan.md` and `02`.

### 2026-09-21 — v7: doc 02 written, split in five

`implement` round R8. Every `Phase N verification:` line in `02`, `02b`, `02c` and `02d` points at a section of this file; it is the half that says how anything is known to work.

### 2026-09-19 — v5: review R5 dispositions

`AC23`/`AC24` left `acceptance[]` with `C15`/`C16`, so the Definition of Done below carries twenty criteria, not twenty-two. The corrected contracts (`source_frames_ms` as an array, `verbosity` as a field) are what §B.2 asserts against.

---

# Part B — Test plan

## B.0 — Mock preamble

> **Stated deviation, because the rule here cannot be followed as written.** `references/implementable.md` says to copy this stack's mock preamble **verbatim from a real test in this repository** and name the file it came from. There is no such file: the repository holds no application code (`_facts.yml tests_baseline.evidence.outcome: aborted_no_conditions`) and no test has ever run here. The preamble below is therefore **established** by this document rather than copied, and `02` Phase 1 is where it first executes. The first test written against it either runs or does not — and if it does not, this block is corrected here before any other test is written, not worked around per-file.

`pipeline/__tests__/setup.ts` (new file, full contents) — AWS is never reached from a test:

```ts
import { vi } from 'vitest';

export const bedrockSend = vi.fn();
export const pollySend = vi.fn();

vi.mock('@aws-sdk/client-bedrock-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aws-sdk/client-bedrock-runtime')>();
  return {
    ...actual,
    BedrockRuntimeClient: vi.fn(() => ({ send: bedrockSend })),
  };
});

vi.mock('@aws-sdk/client-polly', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aws-sdk/client-polly')>();
  return {
    ...actual,
    PollyClient: vi.fn(() => ({ send: pollySend })),
  };
});

/** Bedrock returns the Nova envelope pipeline/describe.ts unwraps. */
export function novaReply(text: string) {
  return {
    body: new TextEncoder().encode(
      JSON.stringify({ output: { message: { content: [{ text }] } } }),
    ),
  };
}

export function throttle() {
  const err = new Error('rate exceeded');
  err.name = 'ThrottlingException';
  return err;
}
```

`src/__tests__/fakeAdapter.ts` (new file, full contents) — the device is never reached from a test:

```ts
import type { MediaAdapter, Unsubscribe } from '../platform/MediaAdapter.js';

export function fakeAdapter() {
  const calls: { volume: Array<{ pct: number; rampMs: number }>; played: string[] } = {
    volume: [], played: [],
  };
  let position = 0;
  const positionCbs: Array<(ms: number) => void> = [];
  const seekCbs: Array<(ms: number) => void> = [];
  const backgroundCbs: Array<() => void> = [];
  const sub = (list: unknown[], cb: unknown): Unsubscribe => {
    list.push(cb);
    return () => { list.splice(list.indexOf(cb), 1); };
  };

  const adapter: MediaAdapter = {
    video: {
      positionMs: () => position,
      durationMs: () => 600_000,
      isPlaying: () => true,
      setVolumePct: async (pct, rampMs) => { calls.volume.push({ pct, rampMs }); },
      onPosition: (cb) => sub(positionCbs, cb),
      onSeek: (cb) => sub(seekCbs, cb),
      onEnded: (cb) => sub([], cb),
      onError: (cb) => sub([], cb),
    },
    clips: {
      play: async (uri) => { calls.played.push(uri); },
      stop: () => {},
    },
    lifecycle: { onBackground: (cb) => sub(backgroundCbs, cb) },
  };

  return {
    adapter,
    calls,
    advanceTo(ms: number) { position = ms; positionCbs.forEach((cb) => cb(ms)); },
    seekTo(ms: number) { position = ms; seekCbs.forEach((cb) => cb(ms)); },
    background() { backgroundCbs.forEach((cb) => cb()); },
  };
}
```

## B.1 — Unit tests

Every bullet names its target file and its assertion. A bullet with a **`Fails if:`** line is a parity or negative assertion — the shape that false-greens most easily — and the line states the concrete mutation that must turn the test red.

**`pipeline/__tests__/budget.test.ts`** — `02` Phase 2
- `baseWordBudget(1500)` → `3`; `baseWordBudget(1000)` → `1`; `baseWordBudget(200)` → `0` (never negative)
- **the three levels are strictly distinct at every gap size, not just at a convenient one.** For every `g` in `[1500, 1600, 1800, 2000, 2500, 3000, 4000, 5000, 8000, 12000]`: `wordTarget(g,'concise') < wordTarget(g,'standard') < wordTarget(g,'detailed')`.
  **Fails if:** any scale is raised above `1.0`, or a clamp is reintroduced on top of the scales. Both mutations collapse `standard` and `detailed` onto the same integer and make `AC17` undemonstrable — two of the three tracks come out as the same file. This has now been got wrong twice (R3, R8); the loop over ten gap sizes is there because a single spot-check at one gap is what hid it both times.
- `wordTarget(g, v) <= wordCeiling(g)` for every `g` above and every `v` — `AC4`'s bound holds at the top level too
- `wordCeiling` does not vary by verbosity: it takes no `Verbosity` argument at all, which is the type-level statement that the gap is the gap

**`pipeline/__tests__/gaps.test.ts`** — `02` Phase 3
- `parseWebVtt` handles both `.` and `,` in timestamps, strips `<v Speaker>` tags, and skips the `WEBVTT` header and `NOTE` blocks
- overlapping subtitles (`0–3000` and `2000–4000`) merge into one span → `findGaps` returns **no** gap between them.
  **Fails if:** `mergeSpeech` is removed. Without it the pair produces a `-1000 ms` gap, which either crashes or silently disappears under the `>= MIN_GAP_MS` filter — and the second is worse, because the bug is invisible.
- a gap of exactly `1500` ms is **included**; `1499` is **excluded**
- the span before the first subtitle and the span after the last are both emitted, with `before: null` / `after: null` respectively

**`pipeline/__tests__/frames.test.ts`** — `02b` Phase 4 (ffmpeg mocked via `vi.mock('node:child_process')`)
- a gap with no detected cut → exactly one frame, at the midpoint
- a gap with four detected cuts → exactly `AD.FRAMES_PER_GAP_MAX` (3) frames, midpoint included, in ascending time order.
  **Fails if:** the `.slice(0, FRAMES_PER_GAP_MAX)` bound is dropped. The prompt then carries five images per gap, silently raising cost and latency on every call.
- `source_frames_ms` has the same length as `paths` — the array written to `contracts.description_cue.source_frames_ms` matches what was actually extracted

**`pipeline/__tests__/describe.test.ts`** — `02b` Phase 5
- a well-formed `{"description":"…"}` under budget → `status: 'ok'` with the right `words`
- a reply over budget → `status: 'failed'`.
  **Fails if:** the `countWords(trimmed) > budget` check is removed. An over-budget cue plays over the next line of dialogue — the failure `AC4` forbids and the reason the whole word budget exists.
- a reply with prose around the JSON, an extra key, or a non-string `description` → `status: 'failed'` in each case
- a subtitle line containing `</subtitles>` is neutralised: assert the string sent to `bedrockSend` contains exactly one `</subtitles>`.
  **Fails if:** `asData` stops replacing the tag. A crafted subtitle file then closes the fence and everything after it is read as instructions — gap sweep `S2`, which the deferral of `C16` left this as the sole defence against.
- `bedrockSend` rejecting with `throttle()` four times then succeeding → `status: 'ok'`; five times → `status: 'failed'`, and `bedrockSend` was called exactly `MAX_ATTEMPTS` (5) times
- a non-throttle error is **not** retried — `bedrockSend` called once.
  **Fails if:** the error-name check is removed and everything retries. A malformed request is then retried five times with the same body, five times slower, and still fails.
- `describeGap` on a gap with `before: null` does not throw — the opening gap of the film is a real gap

**`pipeline/__tests__/synthesize.test.ts`** — `02b` Phase 6
- a `failed` cue is **written into the track** with `text: ''`, `audio_uri: ''`, `status: 'failed'`, and `pollySend` is **not** called for it.
  **Fails if:** failed cues are filtered out of `cues`. The track then silently has fewer cues than gaps and nothing records which gap produced nothing — `01-master-plan.md` §4 says the cue is emitted, not dropped.
- the emitted object has exactly the seven keys of `contracts.description_track`, and each cue exactly the eight of `contracts.description_cue`
- the file name is `demo.concise.track.json` / `demo.standard.track.json` / `demo.detailed.track.json`, and each file's `verbosity` field equals the level in its own name.
  **Fails if:** `verbosity` is hardcoded rather than taken from `args`. All three files then claim to be the same level and `C6` loads the wrong one with no way to tell.

> **Test files live in `test/`, and that is jest's rule here rather than a preference.** `jest.config.json` sets `testRegex: "/test/.*\\.(test|spec)\\.(ts|tsx|js)$"`, so a suite under `src/**/__tests__/` is **never discovered** — it does not fail, it simply does not run, which is the worse of the two outcomes. The paths below were written as `src/ad/__tests__/*.test.ts` until R26 built the first two and found they executed nothing. The pipeline half is the other convention — `pipeline/__tests__/*.test.ts`, discovered by vitest — and the two runners are separate on purpose (`_facts.yml tests_baseline`).

**`test/TrackLoader.spec.ts`** — `02c` Phase 8
- `validateTrack` rejects, one case each: a missing key, `verbosity: 'verbose'`, `source_frames_ms: 42` (not an array), `status: 'pending'`
- a **missing** `detailed` file falls back to `standard` and reports `loaded_verbosity: 'standard'`
- a **malformed** `detailed` file returns `{ ok: false, reason: 'malformed' }` and does **not** fall back.
  **Fails if:** the fallback runs on both branches. A corrupt track is then hidden behind a working one and nothing ever surfaces that the pipeline emitted garbage.
- `ClipCache` holds at most `MAX_CLIPS_IN_MEMORY` (8): put 12, assert `size === 8` and that the first four were evicted in insertion order.
  **Fails if:** the eviction loop is removed. The cache is then unbounded, which on a 32-bit Fire TV Stick heap (`limits.clip_cache`) ends as an OOM in the middle of the demo.

**`test/CueScheduler.spec.ts`** — `02c` Phase 9
- a cue fires exactly once when position enters its window
- position jumping past a cue's `end_ms` **drops** it — `onFire` is never called for it.
  **Fails if:** the `while` advance is removed. Every skipped cue then fires late, on top of dialogue — `AC4`.
- after `resync(300_000)` on a 40-cue track, ticking forward fires only cues at or after that position — no backlog
- `coalesce` given 12 rapid values within `quietMs` calls the wrapped function **once**, with the **last** value.
  **Fails if:** the `clearTimeout` is removed. A held D-pad direction then produces 12 resyncs — `AC6`.

**`test/DescriptionAudio.spec.ts`** — `02c` Phase 10 (uses `fakeAdapter`)
- `speak` records `setVolumePct(25, 200)` then `play(uri)` then `setVolumePct(100, 200)`, in that order
- `clips.play` rejecting still ends with `setVolumePct(100, 200)`.
  **Fails if:** the restore moves out of `finally`. One failed clip then leaves the film at 25% volume for the rest of the runtime — the worst failure this component can produce, and invisible in a happy-path test.
- `background()` during a cue calls `stop()` and restores the volume
- `speak` called again while one is active is a no-op — the first cue is never cut off mid-sentence

**`test/ADControls.spec.ts`** — `02c` Phase 11
- `state.kind: 'missing'` renders the `alert` role and announces exactly `stateMessage(state)` — asserted through the exported function, not a copy of the string
- `state.kind: 'malformed'` announces its own distinct sentence
- toggling calls `onToggle(!enabled)` and nothing else — no player method is touched (`AC3`).
  **Fails if:** the toggle pauses or reloads the video. `AC3` says "without interrupting playback"; a test that only checks `onToggle` fired would pass through that regression, so assert the fake adapter's video methods were **not** called.
- each of the three verbosity controls exposes `accessibilityState.selected` correctly and is `disabled` when description is off
- the announcement fires **once** per state change, not on every re-render

**`test/PlayerScreen.spec.tsx`** — `02d` Phase 12
- the loading state renders a focusable element (`AC2`)
- a failed load still reaches the `playing` screen with the film running and `ad.kind` set — description absent, playback not (`AC8`)
- changing verbosity re-runs the loader and reloads the scheduler **without** touching the video (`AC17`)
- `hardwareBackPress` calls `onExit` and stops the audio, from each of the three states (`AC2`)

## B.2 — Contract / integration tests

**`pipeline/__tests__/contract.track.test.ts`** — run against the **real** emitted file, not a fixture:

- `out/demo.standard.track.json` parses, and its key set is exactly `contracts.description_track`: `version`, `asset_id`, `generated_at`, `source_subtitles`, `verbosity`, `model_id`, `cues`
- every cue's key set is exactly `contracts.description_cue`: `id`, `start_ms`, `end_ms`, `words`, `text`, `audio_uri`, `source_frames_ms`, `status`
- every `ok` cue satisfies `words <= wordCeiling(end_ms - start_ms)` — `AC4`, asserted on real generated data rather than on a mock
- every `ok` cue's `audio_uri` exists on disk
- `source_frames_ms.length >= 1` and `<= limits.ad.frames_per_gap_max` for every cue
- no two cues' `[start_ms, end_ms)` windows overlap
- the same assertions pass for `demo.concise.track.json` and `demo.detailed.track.json`, and the three files' cue **counts** match while their `words` totals differ — the levels are real, not three copies

**Baseline:** `⟨commands.tests⟩` → a line containing `⟨commands.tests_expect⟩`, with the count from `_facts.yml tests_baseline`. Both the command and the expected substring are `null` until `02` Phase 1 fills them from a real run; this line resolves from the profile and is never typed by hand.

---

# Part C — E2E tests (manual)

Run on the Vega simulator (or on Fire OS if `D3` died and `alternatives[A4]` reopened). Every one is `[MANUAL]`: they are the criteria no unit test can close.

**C.1 — Happy path (`AC1`, `AC3`, `AC4`, `AC7`)**
Launch, select the title, let it play from the start. Description is on by default and the first cue lands in the opening gap. Watch three consecutive cues and confirm each one starts **and finishes** inside its silence. Toggle description off from the remote mid-playback: the film does not pause, does not seek, does not stutter. Toggle back on: the next cue fires, the missed one does not.

**C.2 — Ducking, audibly (`AC5`, `D2`)**
During a cue, the film's audio is **audibly** quieter and comes back to full afterwards. Not "the log printed a duck line" — `02` Phase 0.2 already recorded that the call returning is not evidence the platform honoured it. Then force the failure: point one cue's `audio_uri` at a missing file and confirm the film returns to **full volume** anyway. A film left at 25% is the failure that survives a green test suite.

**C.3 — Focus and BACK, in every state (`AC2`)**
With the D-pad alone, and **never touching a mouse or a keyboard**: from the title list into loading, into playing, into the track-missing state (rename the track file), and into the error state (point at a missing asset). In each, something is focused and the D-pad still moves. Press BACK in each: it returns to the title list and playback stops. A dead D-pad here means force-stopping the app, which is what `mobile-tv` gap sweep `F2` predicts and the only way to see it is to walk it.

**C.4 — Seek and key repeat (`AC6`)**
Hold right for five seconds, release. One resync, not thirty — confirm with `⟨commands.device_log⟩` filtered to `INTERSTICE`, where `INTERSTICE.scheduler.coalesced` appears **once** with the settled position. No cue backlog fires after the seek settles. Then seek **backwards** over a region already played and confirm its cues fire again.

**C.5 — Verbosity (`AC17`)**
Switch concise → standard → detailed during playback. The film keeps playing across all three. The next cue is audibly shorter on concise and longer on detailed — **if the three sound the same, the `hardCeilingWords` clamp is wrong and §B.1 has a failing assertion that was skipped.** Switch to a level whose file was deleted and confirm it falls back to standard rather than turning description off.

**C.6 — Missing and malformed track (`AC8`)**
Rename the track file: the app states it, visibly and out loud, and the film still plays. Truncate the JSON mid-object: a **different** stated message, also spoken. Neither ends in silence, and neither stops the film.

**C.7 — VoiceView (`AC15`)**
With VoiceView on, reach every control with the D-pad. Each announces what it is and its current state. The toggle announces on/off; each verbosity level announces selected/not selected and announces itself as disabled when description is off.

**C.8 — Clip cache under load (`limits.clip_cache`)**
Play through 20+ consecutive cues without seeking and confirm `INTERSTICE.cache.evict` appears and `size=8` holds. This is verified on the simulator only, and `01-master-plan.md` §8 records that as an accepted risk: `limits.clip_cache` stays `basis: asserted` for real hardware and the spec says so rather than implying coverage it does not have.

---

# Acceptance criteria (Definition of Done)

Verbatim from `_facts.yml acceptance[]`, all twenty-two, with where each is closed.

| id | criterion | closed by |
|---|---|---|
| AC1 | the app runs on the Vega simulator and plays the demo asset end to end | `02d` Phase 13, §C.1 |
| AC2 | every screen state — loading, playing, error, empty — has a focusable element, and BACK during playback has a stated destination | `02d` Phase 12, §C.3 |
| AC3 | description can be toggled on and off from the remote without interrupting playback | `02c` Phase 11, §B.1, §C.1 |
| AC4 | description cues play inside real dialogue gaps and never overlap dialogue | `02b` Phase 5 (budget), `02c` Phase 9 (scheduler), §B.2, §C.1 |
| AC5 | the main track ducks to `limits.ad.duck_target_pct` during a cue and returns to full afterwards | `02c` Phase 10, §C.2 |
| AC6 | seeking and held-direction key repeat resync the scheduler without firing a cue per key event | `02c` Phase 9, §B.1, §C.4 |
| AC7 | the description track is produced end to end by the pipeline from asset plus subtitles — no cue text is hand-written | `02` Phases 3–6, §C.1 |
| AC8 | a failed or missing track produces a stated visible and spoken state, not silence | `02c` Phase 8, `02c` Phase 11, §C.6 |
| AC9 | the live capture layer, if it ships, is off by default and names where the frame goes before the first send | **not in scope** — `C11` is `kind: deferred`; vacuously true while it does not ship, and it reopens through a new `implement` round, never by being half-built here |
| AC10 | `react-native-tv-audio-description` is public, licensed, documented, and has a runnable example, with commits inside the submission window | `02d` Phase 14 |
| AC11 | `FRICTION-LOG.md` holds dated entries written during the build, not reconstructed at the end | `02` Phase 0.7, `02d` Phase 15 |
| AC12 | the demo video is under 3 minutes, in English, and shows the app running on the target platform | `02d` Phase 16.6 |
| AC13 | every Devpost field is submitted before 2026-10-23 12:00 PT, with the primary track and both mini challenges declared | `02d` Phase 16.8 |
| AC14 | the author watches the demo asset end to end with the description track and rates every cue 1–5 against the picture; track mean and % failed are recorded and the worst cues are regenerated before the demo video is recorded | `02d` Phase 16.2 |
| AC15 | the control surface is exercised under VoiceView: every control is reachable and announces its state, and the demo video shows it | `02c` Phase 11, `02d` Phase 16.3, §C.7 |
| AC16 | the submission package cites at least one sourced figure on audio-description coverage; the figure and its source enter the registry before the prose | `02d` Phase 16.5 |
| AC17 | three verbosity levels (concise/standard/detailed) are selectable from the remote, rescale `max_words_per_cue` per `limits.ad.verbosity_scales`, and are demonstrated in the demo | `02` Phase 2 + `02b` Phase 6, `02c` Phase 11, `02d` Phase 12, §C.5 |
| AC18 | a dramatis personae pass precedes per-gap description and is fed into every C9 prompt alongside rolling context; cue coherence is checked during the AC14 watch | `02b` Phase 5, `02d` Phase 16.2 |
| AC19 | the submission video visualizes the gap structure (timeline strip with dialogue vs gaps + split-screen before/after with ducking) using data from C7 | `02` Phase 3 (data), `02d` Phase 16.1 |
| AC20 | at least one blind/low-vision viewer validates the track before Phase 5 (20–30 min, with/without comparison, consent on file); anonymized quote retained for SUBMISSION.md/video | `02` Phase 0.5 (recruit), `02d` Phase 16.4 |
| AC23 | the app plays the full-length demo asset without exceeding memory on the worst device in the matrix: `limits.mse_buffer` holds, `SourceBuffer.remove()` runs behind the playhead, and no `QuotaExceededError` is raised across an end-to-end watch | `02d` Phase 12, §C.8 |
| AC24 | a stall — bytes running short mid-playback — produces a stated visible and spoken state rather than a frozen picture, and a seek outside the buffered window either resolves or says why it cannot | `02d` Phase 12, §B.1, §C.8 |

> **`AC21` and `AC22` are reserved, not free.** They were written in R3 and retired on 2026-09-19 (review R5) together with `C15`/`C16` — a criterion whose component is deferred is a criterion nothing can satisfy — and `decisions.typesafe_judgment_layer` says they return **verbatim** if that decision reopens. R21's two new criteria were first written as `AC21`/`AC22` and renumbered to `AC23`/`AC24` in R22 on finding the collision. Retired ids are not recycled here, because a reopened criterion that silently means something else is worse than a gap in the numbering.

> **`AC23` and `AC24` come from `review` R21, not from the original set.** They exist because `limits.vega_media.url_mode_broken` moved byte delivery into the app: the first is the memory bound on a buffer the app now owns, the second is the state a viewer gets when that buffer runs dry. Both are on the worst device in the matrix and neither can close on the simulator.

---

# Coverage map — `01-master-plan.md` §7 checklist

Every item of the master checklist against the phase or section that covers it. This is the list the last `audit` printed under *pending downstream coverage*; an uncovered row here is a `DRIFT`.

| `01` §7 checklist item | covered by |
|---|---|
| `D3` resolved: the Vega simulator installs, runs, and plays the demo asset | `02` Phase 0.1 |
| `D2` resolved: a second audio stream plays while the main track ducks, or `decisions.d2_fallback` (pre-mix track) is confirmed in writing | `02` Phase 0.2, `02c` Phase 10, `02b` Phase 6.3 |
| `D1` resolved: frame capture either works (`C11` reopens) or does not (`C11` stays deferred) | `02` Phase 0.3 |
| AWS promotional credits requested — before **2026-10-21 12:00 PT** | `02` Phase 0.4 |
| demo asset chosen and its license recorded | `02` Phase 0.6 |
| the chosen asset carries substantial dialogue and usable published WebVTT subtitles (`decisions.demo_asset_licensing`) | `02` Phase 0.6 |
| recruitment opened for the `AC20` validation participant — confirmed by **10-16** or `AC20` is dropped (`tracking.blocked_by`) | `02` Phase 0.5, `02d` Phase 16.4 |
| `C7` emits every gap >= `limits.ad.min_gap_ms` from the asset subtitles (also the gap-timeline source for the video, `AC19`) | `02` Phase 3, `02d` Phase 16.1 |
| `C8` extracts up to `limits.ad.frames_per_gap_max` frames per gap — midpoint, plus per-shot frames when the gap spans a cut | `02b` Phase 4 |
| `C9` dramatis personae pass then per gap returns a description within `limits.ad.max_words_per_cue` per verbosity scale (`decisions.verbosity_levels`, `limits.ad.verbosity_scales`), using subtitle context + dramatis personae + the last `limits.ad.rolling_context_cues` descriptions as naming context (`AC18`); subtitle text delimited, malformed responses rejected | `02b` Phase 5 |
| `C10` synthesises each cue and emits one track per verbosity level, each declaring its own `verbosity` and recording `source_frames_ms` per cue (`contracts.description_track`) | `02b` Phase 6 |
| `AC7`: no cue text is hand-written | `02b` Phase 5 (note), §C.1 |
| `AC14`: the generated track is watched end to end against the picture, every cue rated 1–5, track mean and % failed recorded, the worst regenerated before the video is recorded (`limits.ad.quality_gate`, `AC18` coherence check) | `02d` Phase 16.2 |
| `C1`, `C2`: the app plays the demo asset on the simulator (`AC1`) | `02d` Phase 12, `02d` Phase 13 |
| `C2`, `C5`: every state has a focus host and BACK has a stated destination (`AC2`) | `02d` Phase 12, §C.3 |
| `C5`: description toggles from the remote without interrupting playback (`AC3`) and verbosity switches between three levels without restart (`AC17`); selector is VoiceView-announced | `02c` Phase 11, `02d` Phase 12, §C.5, §C.7 |
| `C3`: cues land inside real gaps and never overlap dialogue (`AC4`) | `02c` Phase 9, §B.2, §C.1 |
| `C4`: the main track ducks to `limits.ad.duck_target_pct` and returns (`AC5`) | `02c` Phase 10, §C.2 |
| `C3`: seek and held-direction key repeat resync without firing a cue per key event (`AC6`) | `02c` Phase 9, §C.4 |
| `C6`, `C5`: a failed or missing track produces a visible and spoken state (`AC8`) | `02c` Phase 8, `02c` Phase 11, §C.6 |
| `AC15`: every control is reachable and announces its state under VoiceView, and the demo video shows it | `02c` Phase 11, `02d` Phase 16.3, §C.7 |
| `C11` if it ships: off by default, names the destination before the first send (`AC9`) | out of scope — `C11` is `kind: deferred`; see the `AC9` row above |
| `C12` public, licensed, documented, with a runnable example verifiable in one command and commits inside the window (`AC10`) | `02d` Phase 14 |
| `C13` holds dated entries per `decisions.friction_log_shape` — `tool \| expected \| happened \| workaround \| time_lost`, 5–8 entries written during the build (`AC11`) | `02` Phase 0.7, `02d` Phase 15 |
| `C14`: demo video under 3 minutes, in English, showing the app on the target platform with gap visualization (`AC12`, `AC19` — timeline strip + split-screen before/after) | `02d` Phase 16.1, `02d` Phase 16.6 |
| `AC20`: at least one blind/low-vision validation session before Phase 5, consent on file, anonymized quote retained for video/SUBMISSION.md | `02` Phase 0.5, `02d` Phase 16.4 |
| product feedback written for every Amazon tool and API used | `02d` Phase 16.7 |
| every Devpost field submitted before **2026-10-23 12:00 PT**, primary track and both mini challenges declared (`AC13`) | `02d` Phase 16.8 |
| `AC16`: the submission cites at least one sourced figure on audio-description coverage | `02d` Phase 16.5 |