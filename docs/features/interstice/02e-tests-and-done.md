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

## B.0 — The harness, as it exists

> **Rewritten in R38 against the repository.** The version this replaced opened by saying *"the repository holds no application code"* and *"no test has ever run here"*, and described a fake adapter whose `setVolumePct` took a `rampMs` the interface no longer has. Both were true when written and had been false for fifteen rounds. **A test plan behind its suite is worse than none**: it reads as the contract, and a builder following it writes against a harness that is not there.

**Two runners, on purpose** (`_facts.yml tests_baseline`). `npm test` runs both and fails if either does.

| runner | scope | why it is separate |
|---|---|---|
| **vitest** | `pipeline/__tests__/**` | the offline pipeline is plain Node — ffmpeg, the filesystem, the AWS SDKs |
| **jest** | `test/**` | the app needs the platform's own jest preset, which the pipeline must not load |

### The four fakes, and what each one refuses to pretend

**`test/mocks/w3cmedia.tsx`** — the platform package reaches a native TurboModule that exists only on a Vega device, so importing it under jest throws before any assertion. Wired through `jest.config.json moduleNameMapper`, where it is visible, rather than a `jest.mock` buried in a setup file.

It mirrors **only the measured surface** in `limits.vega_media`. **A mock richer than the real API is a trap**: it lets a test pass against a method the device does not have, and this set already carries two findings that are exactly that failure in another costume.

**`test/fakes/adapter.tsx`** — implements `MediaAdapter`, not Vega. That distinction is the point of the seam: a fake written against the real platform drifts towards whatever the platform happens to do, while a fake written against the interface can only drift if the interface changes, and the compiler catches that. `test/PlayerScreen.spec.tsx` loads **no platform module at all**, which is the behavioural half of `pipeline/__tests__/seam.test.ts`.

**`test/setup.ts`** — fills in `BackHandler`, which is **real on Vega** (`BackHandler.kepler.js` wires the standard interface to `UserInputManager`) and simply absent from the jest preset's shim. Filling the gap rather than mocking the module keeps that honest: a hole in the test environment is not a missing platform capability. Note the mechanism — the kepler module exposes its exports as **getters**, so a plain assignment is a silent no-op and `Object.defineProperty` is what replaces it.

**ffmpeg, in `frames.test.ts` and `prepare.test.ts`** — mocked at `node:child_process`, and it keeps **stdout and stderr separate**, because ffmpeg does. `R25-F1`: `detectCuts` read `execFileSync`'s return value, which is stdout, while `showinfo` writes to stderr. Every real call returned `null` and threw; **all twelve tests passed**, because a mock returning one undifferentiated buffer lets a function read the wrong stream and still pass. The test was asserting the shape of the mock, not the shape of ffmpeg.

> **The rule this yields, and it is the most expensive one in this file:** a fake written alongside its subject encodes the subject's assumptions. Where a fake cannot avoid that, something else has to check it against the world — which is what `contract-parity.test.ts` and the `[MANUAL]` device runs in Part C are for.

## B.1 — Unit tests, as they exist

**133 tests across 15 files.** Every entry names its file and the assertions that carry weight. A **`Fails if:`** line marks a parity or negative assertion — the shape that false-greens most easily — and states the concrete mutation that must turn it red.

### The pipeline (vitest, 70)

**`budget.test.ts`** (6) — `changes[C24]`, `02` Phase 2
- `baseWordBudget(1500)` → `3`; `(1000)` → `1`; `(200)` → `0`, never negative.
- **the three levels are strictly distinct at every gap size, not just a convenient one**, looped over ten real gap sizes.
  **Fails if:** any scale is raised above `1.0`, or a clamp is reintroduced on top of the scales. Both collapse `standard` onto `detailed` and make `AC17` undemonstrable — two of the three tracks come out as the same file. **Got wrong twice** (R3, R8); the loop exists because a single spot-check is what hid it both times.
- `wordTarget(g, v) <= wordCeiling(g)` everywhere — `AC4`'s bound holds at the top level too.

**`gaps.test.ts`** (16) — `changes[C7]`, `02` Phase 3
- parsing accepts `,` and `.` as the millisecond separator; overlapping speech merges before differencing, or two speakers manufacture a negative gap.
- **`clipToContent` yields one gap PER WINDOW**, so the trailing gap straddling the credits becomes the film's tail *plus* the post-credits scene.
  **Fails if:** the trailing gap is dropped wholesale. That is the rule this spec originally proposed, and on the demo asset it deletes a real 21-second post-credits scene — content a sighted viewer keeps and a blind viewer would silently lose.
- **`splitIntoCues` tiles each gap exactly**, carries `before`/`after` only on the windows that touch them, and **yields fewer cues at `concise` than at `detailed`**.
  **Fails if:** the cue count is assumed constant across levels. It is not — which is why `C10` writes one track per level rather than one track with a shared cue list.
- **the cue sets NEST** (`concise ⊆ standard ⊆ detailed`).
  **Fails if:** window boundaries ever start depending on verbosity. `C8` extracts frames once against the widest set and the others reuse them; if nesting breaks, a cue silently gets another cue's frames and the frame count still looks right.
- **`part_index`/`part_count` distinguish a middle window from a film boundary.** Both present as `before === null && after === null`, and the prompts they need are opposite.
  **Fails if:** they are removed. `C9` is then told *"this silence opens the film"* for every middle window of every split gap: nothing throws, every cue returns, and the descriptions are subtly about the wrong thing.

**`manifest.test.ts`** (8) — `changes[C25]`
- rejects overlapping windows, which would double-describe the overlap with nothing downstream able to tell it was a manifest error.
- **rejects a MISSING `content_windows` key while accepting an empty one.**
  **Fails if:** absent and empty are conflated. `[]` is an author declaring the whole asset describable; absent is an author who forgot, and only the second is worth stopping for.

**`frames.test.ts`** (12) — `changes[C8]`
- cut timestamps are offset by the window start, not by zero — ffmpeg is given `-ss`, so its `pts_time` is relative to the segment.
- **a single-shot window gets ONE frame and is not padded to the ceiling.**
  **Fails if:** the bound becomes a target. Sampling a static 12-second shot three times spends two Bedrock image slots on identical pixels.
- **`framesForTrack` indexes by window key, not by index.**
  **Fails if:** an index join is used. Indices renumber per level, so a cue gets another cue's frames while the count still looks right.

**`segment.test.ts`** (10) — `changes[C26]`
- durations are read from the emitted playlist, never derived from the requested length. The fixture is the **real uneven playlist** ffmpeg produced (9.94 s, 4.17 s, 5.29 s, 0.65 s), not a tidy one.
  **Fails if:** lengths are computed as `index * segment_s`. ffmpeg cuts on keyframes and a scheduler on that assumption drifts further from the picture with every segment.
- **the window is measured in TIME, not in segment count.**
  **Fails if:** it becomes a count. On these segments "keep five" means anything between 3 and 50 seconds of media — not a memory bound, and a memory bound is the entire point of `limits.mse_buffer`.
- **eviction never reaches the segment under the playhead.**
  **Fails if:** the cutoff is off by one segment. Removing the media being decoded is how a buffer manager stalls the thing it exists to keep smooth.

**`synthesize.test.ts`** (7) — `changes[C10]`
- **a `failed` cue is WRITTEN, not dropped**, with no audio.
  **Fails if:** it is dropped. The app skips a failed cue; it cannot skip one that is absent, and the gap reads as a silence nobody planned.
- **descriptions join to windows by window key, never by index** — same trap as `C8`, same reason.
- cue audio is `.m4a`. **Fails if:** it becomes MP3, which cannot be appended to a `SourceBuffer` — and the failure surfaces in the player looking like a player bug, three phases from its cause.

**`prepare.test.ts`** (5) — `changes[C27]`
- segment URIs are **relative**. **Fails if:** build-machine absolutes reach the manifest, which ships inside the package and then names a path that exists on exactly one computer.
- **warns when the segments do not reach the declared duration.** **Fails if:** it passes silently — the player reaches the end of the media and sits in `waiting` forever, with no error and nothing said to the viewer.

**`contract-parity.test.ts`** (2), **`seam.test.ts`** (2), **`scope.test.ts`** (2) — the three checks that bind the registry to the code rather than to prose. They are described in §B.2.

### The app (jest, 63)

**`TrackLoader.spec.ts`** (13) — `changes[C6]`
- **a `failed` cue must be ACCEPTED by the validator** — the pipeline writes them on purpose, and a validator that refuses them turns one throttled description into none at all.
- **a missing level falls back to `standard`; a malformed one does NOT.** **Fails if:** they are conflated — silently loading a different file hides a producer bug.
- `ClipCache` does not double-count a re-put uri. **Fails if:** it does — it then evicts live entries while holding duplicates against a 32-bit heap.

**`CueScheduler.spec.ts`** (13) — `changes[C3]`
- **a cue whose window closed is DROPPED, never played late.** **Fails if:** late cues fire. A late cue plays over the dialogue the window was measured to avoid, which is the one thing worse than no description.
- a forward seek fires **no backlog**; a seek back into a window **re-arms** it; `end_ms` is exclusive.
- `coalesce` acts **once on the settled value**. **Fails if:** every key event is acted on — a held direction is then a resync storm.

**`ADControls.spec.tsx`** (14) — `changes[C5]`
- every assertion goes through `announceForAccessibility`, not rendered text, because the rendered half is the half these users do not receive.
- **both failure sentences say playback continues.** **Fails if:** they stop. *"No description track was found"* alone reads as *this title is broken*, and a blind viewer cannot check the picture is fine.
- **an unchanged state does not re-announce.** **Fails if:** the guard goes — a re-render then talks over the film on the one channel these users have.
- the level selector announces itself **disabled** when description is off; pressing it otherwise gives no feedback at all.

**`PlayerScreen.spec.tsx`** (20) — `changes[C2]`
- the screen renders the surface the **adapter** supplies and loads no platform module.
- **a stall is announced, and is a state playback can LEAVE.** **Fails if:** `stalled` is terminal. MSE emits `waiting` during *normal* startup — measured 2 ms after `play()` resolved — so a latching screen speaks "Buffering" over a film that is playing fine.
- **the main track returns to full after a cue, and after a cue that FAILS.** `AC5`.
- **a cue in flight does not keep working after unmount.** **Fails if:** the generation guard goes — its `finally` then ramps the volume of a destroyed player.
- a missing track produces the spoken `AC8` state while the film keeps playing. **This is the app's real state until `D4` clears**, so it is not a corner case.

**`App.spec.tsx`** (3) — `changes[C1]`
- **BACK returns to the list rather than trapping the viewer.** **Fails if:** BACK has no stated destination. On a TV the remote's BACK is the only way out of a screen, which is why `AC2` names it separately from every other key.

## B.2 — The checks that bind the registry to the code

`audit.py` compares `_facts.yml` against the **documents**. For fifteen rounds nothing compared it against the **code**, and three separate drifts grew in that gap. These three tests close it, and each one was written after the drift it now prevents.

**`contract-parity.test.ts`** (2) — reads `contracts.description_cue` and `contracts.description_track` **out of `_facts.yml` on every run** and asserts `TrackLoader`'s validator checks exactly those fields.
> **Fails if:** a field is added to the registry and not to the validator. The app would then accept a track missing it, and the first symptom would be an undefined read somewhere in the player. Mutation-checked in R26: adding `mutation_probe` to `contracts.description_cue` turns it red.

**`seam.test.ts`** (2) — walks `src/` and fails if any file outside `src/platform/` names a platform package, or if anything but `App.tsx` chooses a platform.
> `02c` Phase 7 stated this as a command to run by hand. **A check that lives only in a document runs when somebody remembers it**, and this one decays silently: the first import outside the seam costs nothing and breaks nothing, and by the time `changes[C12]` is packaged the seam is a comment.

**`scope.test.ts`** (2) — walks the tree and fails if any source file has no `changes[]` entry.
> **Ten components reached the device without one** (`R36-F1`). `changes[]` is what `review` sweeps and what `implement` writes phases against, so a file the registry has never heard of is outside both — the gap sweep could not have found a hazard in `SegmentBuffer` for fifteen rounds. Generated files under `src/assets/` are excluded: they are output, not scope. Mutation-checked.

### The contract test that needs `D4`

**`pipeline/__tests__/contract.track.test.ts`** — against the **real emitted file**, not a fixture. It cannot be written green today: a track needs cue text from `changes[C9]`, `defects[D4]` blocks it, and `AC7` forbids hand-writing any.

- the track's key set is exactly `contracts.description_track`, and every cue's is exactly `contracts.description_cue`
- every `ok` cue satisfies `words <= wordCeiling(end_ms - start_ms)` — `AC4`, on real generated data rather than on a mock
- every `ok` cue's `audio_uri` exists on disk, and is a **fragmented** mp4 (`ftyp`/`moov`/`moof`), not merely an `.m4a` by name
- `source_frames_ms.length >= 1` and `<= limits.ad.frames_per_gap_max`
- no two cues' `[start_ms, end_ms)` windows overlap
- **the three levels have DIFFERENT cue counts** — 47 / 55 / 60 on the demo asset, measured in R22.
  > **Fails if:** the counts are asserted equal. An earlier version of this section said they match and only the word totals differ; that is false, and it contradicted `worst_case.cues_by_verbosity` in the registry it is supposed to be derived from. `limits.ad.min_useful_words` drops more windows at `concise`, which is the whole reason `C10` writes one file per level.

One further check a mock cannot make: **take one emitted `.m4a` and append it through a `MediaSource` on the device**, exactly as `02c2` Phase 10 does. A file that validates as a track and cannot be appended still fails every cue in it.

**Baseline:** `⟨commands.tests⟩` → a line containing `⟨commands.tests_expect⟩`, from `_facts.yml tests_baseline`. Both resolve from `_profile.yml` and are never typed by hand.

---

# Part C — E2E tests (manual)

Every one is `[MANUAL]`: they are the criteria no unit test can close.

> **Three of these cannot run on the simulator at all, and that is measured rather than feared.** `C.2` needs audio nobody can capture off the Virtual Device; `C.7` needs VoiceView, which **cannot be switched on there by any route a developer has** (`limits.vega_media.voiceview_not_enablable` — the config key reads back `DISABLED` and `vdcm set` returns *No permission for operation* from both shell entry points); `C.9` needs a feature-length asset. They close on a physical Fire TV, and they were named on day 7 of 34 rather than discovered in Phase 16.

**C.1 — Happy path (`AC1`, `AC3`, `AC4`, `AC7`)**
Launch, select the title, let it play from the start. Description is on by default and the first cue lands in the opening gap. Watch three consecutive cues and confirm each one starts **and finishes** inside its silence. Toggle description off from the remote mid-playback: the film does not pause, does not seek, does not stutter. Toggle back on: the next cue fires, the missed one does not.

**C.2 — Ducking, audibly (`AC5`, `D2`)**
**HARDWARE ONLY.** During a cue, the film's audio is **audibly** quieter and comes back to full afterwards. Not "the log printed a duck line": R21 measured that both streams run concurrently and that `volume = 0.25` was applied, and that is *not* evidence a listener heard the film get quieter. There is no audio capture path off the Virtual Device. Then force the failure: point one cue's `audio_uri` at a missing file and confirm the film returns to **full volume** anyway. A film left at 25% is the failure that survives a green test suite.

**C.3 — Focus and BACK, in every state (`AC2`)**
With the D-pad alone, and **never touching a mouse or a keyboard**: from the title list into loading, into playing, into the track-missing state (rename the track file), and into the error state (point at a missing asset). In each, something is focused and the D-pad still moves. Press BACK in each: it returns to the title list and playback stops. A dead D-pad here means force-stopping the app, which is what `mobile-tv` gap sweep `F2` predicts and the only way to see it is to walk it.

**C.4 — Seek and key repeat (`AC6`)**
Hold right for five seconds, release. One resync, not thirty — confirm with `⟨commands.device_log⟩` filtered to `INTERSTICE`, where `INTERSTICE.scheduler.coalesced` appears **once** with the settled position. No cue backlog fires after the seek settles. Then seek **backwards** over a region already played and confirm its cues fire again.

**C.5 — Verbosity (`AC17`)**
Switch concise → standard → detailed during playback. The film keeps playing across all three. The next cue is audibly shorter on concise and longer on detailed — **if the three sound the same, `limits.ad.verbosity_scales` has collapsed again and §B.1's ten-gap loop should already have caught it.** That collapse has happened twice (R3, R8), both times from a single spot-check at one gap size. Switch to a level whose file was deleted and confirm it falls back to standard rather than turning description off.

**C.6 — Missing and malformed track (`AC8`)**
Rename the track file: the app states it, visibly and out loud, and the film still plays. Truncate the JSON mid-object: a **different** stated message, also spoken. Neither ends in silence, and neither stops the film.

**C.7 — VoiceView (`AC15`) — HARDWARE ONLY**
VoiceView cannot be enabled on the Virtual Device (`limits.vega_media.voiceview_not_enablable`), so this closes on a physical Fire TV or not at all. `changes[C5]` still ships its full accessibility surface and §B.1 tests what it **announces**; what cannot be checked here is that VoiceView consumes it. That is a verification gap, not a build one.

With VoiceView on, reach every control with the D-pad. Each announces what it is and its current state. The toggle announces on/off; each verbosity level announces selected/not selected and announces itself as disabled when description is off.

**C.9 — The memory bound, on a feature-length asset (`AC23`) — HARDWARE ONLY**
Play the full asset end to end on the worst device in the matrix. `INTERSTICE.buffer.evicted` appears repeatedly and `held=` stays bounded; no `QuotaExceededError`; the process does not die. **This is the half of `limits.mse_buffer` that has no device run**: a 20-second clip with a 30-second window never evicts anything, so `evict()` has unit tests and nothing more. The three numbers in `limits.mse_buffer` are `basis: decided`, and this is what makes them measured.

**C.10 — A stall, and what the viewer is told (`AC24`)**
Interrupt byte delivery mid-playback — the simplest way is a segment the manifest names and the package does not contain. The picture freezes and **no `error` event fires**, because a stall raises none. Confirm the app enters its stalled state, announces it, and leaves it when playback resumes. `INTERSTICE.player.resumed from=stalled` is the line to watch, and it exists because a state change nobody can observe is a state change nobody can verify.

**C.8 — Clip cache under load (`limits.clip_cache`)**
Play through 20+ consecutive cues without seeking and confirm `INTERSTICE.cache.evict` appears and `size=8` holds. This is verified on the simulator only, and `01-master-plan.md` §8 records that as an accepted risk: `limits.clip_cache` stays `basis: asserted` for real hardware and the spec says so rather than implying coverage it does not have.

---

# Acceptance criteria (Definition of Done)

Verbatim from `_facts.yml acceptance[]`, all twenty-two, with where each is closed.

| id | criterion | closed by |
|---|---|---|
| AC1 | the app runs on the Vega simulator and plays the demo asset end to end | `02d` Phase 13, §C.1 |
| AC2 | every screen state — loading, playing, error, empty — has a focusable element, and BACK during playback has a stated destination | `02d` Phase 12, §C.3 |
| AC3 | description can be toggled on and off from the remote without interrupting playback | `02c2` Phase 11, §B.1, §C.1 |
| AC4 | description cues play inside real dialogue gaps and never overlap dialogue | `02b` Phase 5 (budget), `02c` Phase 9 (scheduler), §B.2, §C.1 |
| AC5 | the main track ducks to `limits.ad.duck_target_pct` during a cue and returns to full afterwards | `02c2` Phase 10, §C.2 |
| AC6 | seeking and held-direction key repeat resync the scheduler without firing a cue per key event | `02c` Phase 9, §B.1, §C.4 |
| AC7 | the description track is produced end to end by the pipeline from asset plus subtitles — no cue text is hand-written | `02` Phases 3–6, §C.1 |
| AC8 | a failed or missing track produces a stated visible and spoken state, not silence | `02c` Phase 8, `02c2` Phase 11, §C.6 |
| AC9 | the live capture layer, if it ships, is off by default and names where the frame goes before the first send | **not in scope** — `C11` is `kind: deferred`; vacuously true while it does not ship, and it reopens through a new `implement` round, never by being half-built here |
| AC10 | `react-native-tv-audio-description` is public, licensed, documented, and has a runnable example, with commits inside the submission window | `02d` Phase 14 |
| AC11 | `FRICTION-LOG.md` holds dated entries written during the build, not reconstructed at the end | `02` Phase 0.7, `02d` Phase 15 |
| AC12 | the demo video is under 3 minutes, in English, and shows the app running on the target platform | `02d` Phase 16.6 |
| AC13 | every Devpost field is submitted before 2026-10-23 12:00 PT, with the primary track and both mini challenges declared | `02d` Phase 16.8 |
| AC14 | the author watches the demo asset end to end with the description track and rates every cue 1–5 against the picture; track mean and % failed are recorded and the worst cues are regenerated before the demo video is recorded | `02d` Phase 16.2 |
| AC15 | the control surface is exercised under VoiceView: every control is reachable and announces its state, and the demo video shows it | `02c2` Phase 11, `02d` Phase 16.3, §C.7 |
| AC16 | the submission package cites at least one sourced figure on audio-description coverage; the figure and its source enter the registry before the prose | `02d` Phase 16.5 |
| AC17 | three verbosity levels (concise/standard/detailed) are selectable from the remote, rescale `max_words_per_cue` per `limits.ad.verbosity_scales`, and are demonstrated in the demo | `02` Phase 2 + `02b2` Phase 6, `02c2` Phase 11, `02d` Phase 12, §C.5 |
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
| `D3` resolved: the Vega simulator installs, runs, and plays the demo asset | `02` Phase 0.1 — **closed 2026-09-25**, both halves |
| `D2` resolved: a second audio stream plays while the main track ducks | `02` Phase 0.2, `02c2` Phase 10 — **TRUE, measured 2026-09-25**, so `02b2` §6.3's fallback branch does not run |
| `D5` resolved: the Virtual Device decodes video, or the demo moves to hardware | **FALSE, 2026-09-25** — it decodes; the fault was `limits.vega_media.url_mode_broken` |
| `D6` resolved: an `AudioPlayer` accepts an audio-only `SourceBuffer` | **TRUE, 2026-09-25** — `02c2` Phase 10, and the product has an output path |
| the asset's describable content bounded so the credits are never described | `02` Phase 3 §3.1, `worst_case.content_windows` |
| `D1` resolved: frame capture either works (`C11` reopens) or does not (`C11` stays deferred) | `02` Phase 0.3 |
| AWS promotional credits requested — before **2026-10-21 12:00 PT** | `02` Phase 0.4 |
| demo asset chosen and its license recorded | `02` Phase 0.6 |
| the chosen asset carries substantial dialogue and usable published WebVTT subtitles (`decisions.demo_asset_licensing`) | `02` Phase 0.6 |
| recruitment opened for the `AC20` validation participant — confirmed by **10-16** or `AC20` is dropped (`tracking.blocked_by`) | `02` Phase 0.5, `02d` Phase 16.4 |
| `C7` emits every gap >= `limits.ad.min_gap_ms` from the asset subtitles (also the gap-timeline source for the video, `AC19`) | `02` Phase 3, `02d` Phase 16.1 |
| `C8` extracts up to `limits.ad.frames_per_gap_max` frames per gap — midpoint, plus per-shot frames when the gap spans a cut | `02b` Phase 4 |
| `C9` dramatis personae pass then per gap returns a description within `limits.ad.max_words_per_cue` per verbosity scale (`decisions.verbosity_levels`, `limits.ad.verbosity_scales`), using subtitle context + dramatis personae + the last `limits.ad.rolling_context_cues` descriptions as naming context (`AC18`); subtitle text delimited, malformed responses rejected | `02b` Phase 5 |
| `C10` synthesises each cue and emits one track per verbosity level, each declaring its own `verbosity` and recording `source_frames_ms` per cue (`contracts.description_track`) | `02b2` Phase 6 |
| `AC7`: no cue text is hand-written | `02b` Phase 5 (note), §C.1 |
| `AC14`: the generated track is watched end to end against the picture, every cue rated 1–5, track mean and % failed recorded, the worst regenerated before the video is recorded (`limits.ad.quality_gate`, `AC18` coherence check) | `02d` Phase 16.2 |
| `C1`, `C2`: the app plays the demo asset on the simulator (`AC1`) | `02d` Phase 12, `02d` Phase 13 |
| `C2`, `C5`: every state has a focus host and BACK has a stated destination (`AC2`) | `02d` Phase 12, §C.3 |
| `C5`: description toggles from the remote without interrupting playback (`AC3`) and verbosity switches between three levels without restart (`AC17`); selector is VoiceView-announced | `02c2` Phase 11, `02d` Phase 12, §C.5, §C.7 |
| `C3`: cues land inside real gaps and never overlap dialogue (`AC4`) | `02c` Phase 9, §B.2, §C.1 |
| `C4`: the main track ducks to `limits.ad.duck_target_pct` and returns (`AC5`) | `02c2` Phase 10, §C.2 |
| `C3`: seek and held-direction key repeat resync without firing a cue per key event (`AC6`) | `02c` Phase 9, §C.4 |
| `AC23`: the full asset plays without exceeding memory — `limits.mse_buffer` holds, `remove()` runs behind the playhead, no `QuotaExceededError` | `02d` Phase 12, `changes[C20]`, **§C.9 — hardware only** |
| `AC24`: a stall produces a stated visible and spoken state, and a seek outside the window resolves or says why it cannot | `02d` Phase 12, §B.1 (`PlayerScreen.spec.tsx`), §C.10 |
| `C6`, `C5`: a failed or missing track produces a visible and spoken state (`AC8`) | `02c` Phase 8, `02c2` Phase 11, §C.6 |
| `AC15`: every control is reachable and announces its state under VoiceView, and the demo video shows it | `02c2` Phase 11, `02d` Phase 16.3, §C.7 |
| `C11` if it ships: off by default, names the destination before the first send (`AC9`) | out of scope — `C11` is `kind: deferred`; see the `AC9` row above |
| `C12` public, licensed, documented, with a runnable example verifiable in one command and commits inside the window (`AC10`) | `02d` Phase 14 |
| `C13` holds dated entries per `decisions.friction_log_shape` — `tool \| expected \| happened \| workaround \| time_lost`, 5–8 entries written during the build (`AC11`) | `02` Phase 0.7, `02d` Phase 15 |
| `C14`: demo video under 3 minutes, in English, showing the app on the target platform with gap visualization (`AC12`, `AC19` — timeline strip + split-screen before/after) | `02d` Phase 16.1, `02d` Phase 16.6 |
| `AC20`: at least one blind/low-vision validation session before Phase 5, consent on file, anonymized quote retained for video/SUBMISSION.md | `02` Phase 0.5, `02d` Phase 16.4 |
| product feedback written for every Amazon tool and API used | `02d` Phase 16.7 |
| every Devpost field submitted before **2026-10-23 12:00 PT**, primary track and both mini challenges declared (`AC13`) | `02d` Phase 16.8 |
| `AC16`: the submission cites at least one sourced figure on audio-description coverage | `02d` Phase 16.5 |