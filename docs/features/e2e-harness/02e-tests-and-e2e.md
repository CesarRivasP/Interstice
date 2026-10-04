# Tests + E2E — E2E harness — how each phase is known to work, and the Definition of Done

> Complements `02-implementation.md`, `02b-harness.md`, `02b2-scenarios.md`, `02b3-runner.md` and `02c-report-and-delivery.md`. **Part B** (the harness's own tests), **Part C** (manual steps on the device) and the **Definition of Done**.
> **The preamble of `02-implementation.md` governs this file too** — the `⟨commands.*⟩` notation, the logging convention, the ground rules. It is not repeated here.
> Written by `implement` (stage 2), with the five halves of doc 02.

- **Date:** 2026-10-04
- **Test baseline:** `npm test` exit 0 — jest: Tests 24 passed, 24 total · vitest: Test Files 10 passed (10), Tests 70 passed (70) (`_facts.yml tests_baseline`)

> Shared data comes from `_facts.yml`. Cross-refs to phases carry their file: `` `02` Phase 3 ``, `` `02b` Phase 8 ``, `` `02b2` Phase 12 ``, `` `02b3` Phase 13 ``, `` `02c` Phase 16 ``.
> **This document is executable.** Each bullet names its test file and its exact assertion.

> **A harness is a test, so this is the test of a test.** The risk it guards is one direction only: the harness saying *pass* when the app is wrong. A harness that fails a correct app is noisy and gets fixed the day it happens; one that passes a broken app is trusted. Every row below with a **Fails if:** is aimed at the second kind.

---

## Changelog

### 2026-10-04 — v4: build R6 — the harness is built and both suites ran on the Virtual Device: ten scenarios pass, one is blocked, and two fail on defects in the app (D8, D9); the report is generated into docs/e2e; fixture audio falls back to the host voice when Polly is unreachable

Built. The code blocks in the implementation halves are the files as they stand after the first device runs, not as first written.

### 2026-10-04 — v2: review R2 dispositions and owner confirmation — a launch id on the wire, fixtures addressed by collector state not by URL, a 60 s fixture asset so a stall can happen, the device restored to the Release package after a VARIANT run, published paths made relative; status draft -> reviewed

Written for the first time. `AC15` joined the Definition of Done from `review` R2-F7.

---

# Part B — Test plan

## B.0 — Mock preamble

The harness's tests are vitest, plain Node, beside the pipeline's — `C18` adds `e2e/__tests__/**/*.test.ts` to `vitest.config.ts`. There is nothing to mock: `e2e/trace.ts` and `e2e/selftest.ts` are pure, and the collector is tested against a real socket on an ephemeral port. The opening of every file is the one `pipeline/__tests__/budget.test.ts` uses:

```ts
import { describe, expect, it } from 'vitest';
```

Events are built by hand with one helper, defined at the top of each test file that needs it:

```ts
import type { TraceEvent } from '../trace.js';
import { parseLine } from '../trace.js';

let seq = 0;
/** one event, `t` in device ms; resets with `seq = 0` in a beforeEach */
const ev = (line: string, t: number, boot = 'b1'): TraceEvent => ({
  boot, seq: seq++, t_dev_ms: t, t_host: new Date(t).toISOString(), line, ...parseLine(line),
});
```

No test in Part B launches the app or needs a device. What needs a device is Part C.

## B.1 — Unit tests

**`e2e/__tests__/trace.test.ts`** — `C6`, `02b` Phase 7

- `parseLine('INTERSTICE.audio.duck id=c1 to_pct=25')` → name `audio.duck`, fields `{id: 'c1', to_pct: '25'}`.
- a sentence is one field: `parseLine('INTERSTICE.overlay.shown status=stalled spoken=The video paused while it loads more.')` → `fields.spoken` is the whole sentence, `fields.status` is `stalled`.
- a token before any field lands in `_`: `buffer.appended seg0 bytes=10 held=1` → `fields._ === 'seg0'`.
- `order` requires **later** events: `[A, B]` against a trace holding `B` then `A` is false.
  **Fails if:** `first()` restarts from 0 for each element. Then any trace holding both lines passes in either order, and `S03` would pass on a film that was restored before it was ducked.
- `absent` is **false when its bounds are not both seen**, even though nothing matched.
  **Fails if:** an unbounded absence is allowed to pass. An app that crashed after `controls.toggle to=false` emits no `audio.duck` *and* no `controls.toggle to=true`; passing that is passing a dead app (`S11`).
- `absent` is false when the line sits between its bounds, and true when the same line sits after them.
- `count … exactly: 0` is false when one event matches.
  **Fails if:** `count` compares with `>=`. `S02`'s single-eviction check is then satisfied by the loop it exists to catch.
- `in_window`: a duck at playhead 4200 and a restore at 6100 inside `[4000, 9000]` → true; the same restore at 9400 with tolerance 300 → false.
  **Fails if:** `positionAt` ignores the device time elapsed since the last `player.progress`. Positions then snap back to the previous second and a cue ending up to a second late reads as on time — the exact defect of 2026-09-27, where three of four restores landed after their window.
- `positionAt` returns `null` before the first `player.progress`, and `in_window` is false on it.
- `integrity`: seqs `0,1,2` → null; `0,2` → a reason naming seq 1; `1,2` → a reason naming seq 0.
  **Fails if:** a leading gap is tolerated. The first lines of a launch are the ones emitted at module load, and they are where `app.mode` lives.
- `integrity` counts per launch: boot `a` with `0,1` and boot `b` with `0,1` → null.
  **Fails if:** seqs are pooled across boots. Two launches then look like duplicates, or one launch's gap is filled by the other's number (`review` R2-F1).
- `ordered` sorts by seq within a boot and keeps boots in first-arrival order.

**`e2e/__tests__/collector.test.ts`** — `C5`, `02b` Phase 8. Each test starts a collector on a free port of its own (`8199` upward, one per test), with a temp directory as `fixtureRoot`.

- a `GET /?m=INTERSTICE.x.y%20a=1&b=k&s=0&t=5` is stored as `contracts.trace_event` with exactly those values, and answers 204.
- `waitFor` resolves with the event when it arrives after the call, and with `null` at the timeout.
- `GET /fx/a.json` serves the file; `GET /fx/../secret` is 404; a path that resolves outside the root is 404.
  **Fails if:** the `startsWith(root + sep)` check goes. The server would then read any file the user can (`01-master-plan.md` §5).
- `arm([{path: /a\.json$/, kind: 'missing'}])` → 404 for it and 200 for `b.json`.
- `truncate` → status 200 and a body half the file's length.
- `drop` → the client's `fetch` **rejects**.
  **Fails if:** `drop` is implemented as a status code. The package never checks `response.ok`, so `S16` and `S14` would then feed an error body to `appendBuffer` and assert on whatever the platform does with it (`review` R2-F6).
- `hold` → no response until `release()`, then the whole file; `disarm()` also releases, so a scenario that fails mid-way cannot leave a request hanging into the next.

**`e2e/__tests__/scenarios.test.ts`** — `C7`, `02b2` Phase 12. Binds the code to the registry, the way the app set's `contract-parity.test.ts` does.

- reads `limits.suite.scenarios` out of `docs/features/e2e-harness/_facts.yml` on every run and asserts the ids, suites and `covers` lists in `e2e/scenarios/` are exactly those — none missing, none extra, `S18` excepted while it is `deferred`.
  **Fails if:** a scenario is added in code and not in the registry, or its `covers` is widened in code alone. The coverage matrix would then credit a criterion nobody reviewed.
- `WINDOWS` in `e2e/scenarios/variant.ts` equals `limits.fixture.cue_windows_ms`.
- every non-blocked scenario has at least one positive assertion (the precondition of `canFail`), and every `blocked_by` is non-empty text.
- every id in any `covers` exists in `docs/features/interstice/_facts.yml acceptance[]`.

## B.2 — Integration / contract

**`e2e/__tests__/selftest.test.ts`** — `C10`, `02c` Phase 14, `AC4`

- for every `e2e/__tests__/traces/<id>.jsonl`: the scenario with that id evaluates to all-`ok` on it, and `canFail(scenario, trace)` is true.
  **Fails if:** an assertion is satisfied by a line that is always present. Example to try once by hand: change `S01`'s last assertion to `{ kind: 'seen', expect: { name: 'app.mode' } }`; it still passes on the trace and `canFail` still holds — so also assert that no two positive assertions of one scenario share a decisive `Match`.
- `canFail` is false for a scenario whose assertions are all negative.
- **Until the first green run there are no recorded traces.** `[PROVISIONAL: changes.C10 2026-10-04]` The test then asserts the directory is empty and says so in its name, rather than passing silently over zero files — a loop over nothing is the cheapest false green there is.

**`e2e/__tests__/fixtures.test.ts`** — `C8`, `02c` Phase 15. Skipped with a stated reason when `e2e/out/fixtures/` does not exist (it is ignored by git and needs Polly).

- each of the three track files passes the **package's own** `validateTrack`, imported from `node_modules/react-native-tv-audio-description/lib/TrackLoader.js` by path.
  **Fails if:** the fixture drifts from the app's track contract. `S13` would then pass for the wrong reason — every track would be "malformed", including the ones meant to load.
- concise holds 2 cues, standard 3, detailed 3; every `audio_uri` starts with the host the VARIANT package was built with.
- `asset.json` matches `contracts.fixture_asset` and has a segment starting at or after `limits.fixture.withheld_segment_from_ms` (31000).
- every cue's clip is shorter than its window by at least a second.

**`e2e/__tests__/report.test.ts`** — `C9`, `02c` Phase 16. Builds the report into a temp directory from a hand-written `run.json`.

- the page has one matrix row per entry of `docs/features/interstice/_facts.yml acceptance[]` — the count is read from the registry in the test, never typed (`AC9`).
- a result whose `reason` is `<script>alert(1)</script>` appears escaped and nowhere as markup.
  **Fails if:** any interpolation skips `esc`. Trace text comes off a device and is published (`01-master-plan.md` §5).
- a `blocked` result is rendered with its `blocked_by` text and the class `blocked`, and is never absent from the page (`AC6`).
- a result with `fixture: true` carries the word `FIXTURE` (`AC7`); one with `fixture: false` does not.
- the four "cannot show" items are present (`AC10`).
- a criterion with no class in `limits.coverage.classes` renders `UNCLASSIFIED` — it does not vanish.
  **Fails if:** the matrix is built from `classes` instead of from the app's `acceptance[]`. A criterion added to the app would then be missing from the report with nothing saying so.

**Baseline:** `⟨commands.tests⟩` → exit 0. The count rises from `_facts.yml tests_baseline` by the tests above; re-measure `tests_baseline` and `_profile.yml commands.tests_expect` when they land (`02` Phase 6).

---

# Part C — E2E tests (manual)

All on the **Vega Virtual Device**, SDK 0.24.12112, Release aarch64, unless a step says VARIANT. Nothing here is evidence for a physical Fire TV. Each step records its result on the criterion it verifies, in `_facts.yml acceptance[]` — `status: executed`, `verified_on:`, `evidence:`.

**C.1 — The spike gate (`AC1`)** — `02` Phase 0
Walk `02` Phase 0.1 to 0.6. **Observation:** `_facts.yml defects[D1]`…`[D5]` each read `basis: measured` with `n:`, the three `conditions`, and the decisive line or its absence quoted; `capture_rung` and `input_route` are chosen. Done before any file under `e2e/` exists — check with `git log --diff-filter=A --format=%ad -- e2e | tail -1` against the dates on the five entries.

**C.2 — The trace, by hand (`AC5`)** — `02` Phases 1–3, `02b` Phases 8–10
1. `⟨commands.build⟩`, install, `⟨commands.js_log⟩`, launch.
2. **Observation:** every printed line now carries a launch id and a sequence; the first is `0`; no number is skipped.
3. Select the title and let the clip play out. **Observation:** `INTERSTICE.player.progress pos_ms=…` about once a second, climbing to past 19000; `INTERSTICE.overlay.shown status=loading spoken=Loading title` then `INTERSTICE.overlay.cleared`; `INTERSTICE.ad.state kind=missing`.
4. `⟨commands.force_stop⟩`, launch again. **Observation:** a different launch id, sequence back at `0`.
5. **The half that matters:** stop the beacon server for five seconds mid-playback and restart it. The printed sequence now has a hole. That hole is what `integrity` turns into `trace_incomplete`; if the numbers come back contiguous, the app is buffering lines somewhere and `limits.trace.ordering` needs re-reading.

**C.3 — Two packages from one tree (`AC7`, `AC15`)** — `02` Phases 4–5
1. The `build:e2e` script (`C17`), install, launch. **Observation:** `INTERSTICE.app.mode e2e=true host=http://localhost:8099`, and a second title reading `E2E FIXTURE — not a film`.
2. `⟨commands.build⟩`, install, launch — nothing cleaned in between. **Observation:** `INTERSTICE.app.mode e2e=false host=none`, one title.
3. The Release package holds no fixture file. **Open:** a `.vpkg` is Zstandard-compressed, not a zip, and no listing command has been found yet (`_log.md` R5-F5). Until one is, this rests on the design — fixtures are written to `e2e/out/`, which no build reads — and not on an observation.

**C.4 — Capture (`AC3`)** — `02b2` Phase 11
With `E2E_CAPTURE` unset, run the `e2e:release` script. **Observation:** five verdicts and no file under `shots/` — the suite is complete without a pixel. Then with the rung `02` Phase 0.2 chose: the same five verdicts, **identical**, plus the files. A verdict that changes with the capture rung is a defect in the harness.

**C.5 — The RELEASE suite (`AC2`)** — `02b3` Phase 13
1. From a stopped app: the `e2e:release` script. **Observation:** `PASS` for `S01`–`S05`, exit code 0, a `run.json`.
2. **Then break the app on purpose** — make `exit` a no-op in `src/App.tsx` (`const exit = useCallback(() => {}, [])`), rebuild, re-run. **Observation:** `S04` is `FAIL` and the exit code is 1. Restore the line. A suite never seen red has not been shown to work.
3. Run it with port forwarding stopped (`vega device stop-port-forwarding --port 8099 --forward false`). **Observation:** all five `BLOCKED`, naming the collector — not `FAIL`, and not a hang (`AC6`).

**C.6 — The VARIANT suite (`AC6`, `AC7`, `AC15`)** — `02b3` Phase 13, `02c` Phase 15
1. The `e2e:fixtures` script, then the `e2e:variant` script.
2. **Observation:** `S10`–`S16` each `PASS` or a `FAIL` whose reason names an assertion; `S17` `BLOCKED` naming `D6`.
3. **A `FAIL` here on the first run is expected to be informative, not embarrassing.** `S15` and `S16` have never been walked on a device even by hand; `S10` will show whether the app announces "no track" before loading one (`02b2` Phase 12). Each real failure is a finding for the app set and is logged there.
4. When it ends: launch the app by hand. **Observation:** `INTERSTICE.app.mode e2e=false`, one title — the device is back on the Release package. Do this once after a run that **failed**, too.

**C.7 — The report (`AC8`–`AC13`)** — `02c` Phases 16–17
1. `npm run e2e:publish -- <the two run directories>`, then open `docs/e2e/index.html` from disk.
2. **Observation, read as a judge would:** 22 rows in the matrix; each scenario card has its use case, steps, "what the viewer is told", "decided by", verdict; VARIANT cards say FIXTURE; `S17` is there and says why it is blocked; the cannot-show list is above the cards; cue scenarios have a strip whose blocks sit inside their bands; every card with a frame of the film carries the attribution.
3. Disconnect nothing, stop the Virtual Device, run the `e2e:report` script. **Observation:** the same page (`AC11`).
4. At a 390 px wide window: no horizontal scroll except inside the matrix.
5. After `02c` Phase 17.3: the public URL serves the same page (`AC12`).

**C.8 — The friction log (`AC14`)** — `02c` Phase 18
`git log --format=%ad --date=short -- FRICTION-LOG.md` shows commits on the days `02` Phase 0 and the build ran, not one commit at the end.

---

# Acceptance criteria (Definition of Done)

Verbatim from `_facts.yml acceptance[]`, with where each is closed.

| id | criterion | closed by |
|---|---|---|
| AC1 | the Phase 0 spike answers D1, D2, D3, D4 and D5 on the Virtual Device, and each answer is in this registry as measured before any Phase 1 code is written | `02` Phase 0, §C.1 |
| AC2 | one command runs the RELEASE suite against the Release package from a stopped app and exits non-zero if any scenario fails | `02b3` Phase 13, §C.5 |
| AC3 | every verdict comes from assertions over the trace; no screenshot or clip decides one | `02b2` Phase 11, `02b3` Phase 13, §C.4 |
| AC4 | the selftest shows every scenario can fail: with its decisive line removed from a recorded trace, each one returns fail | `02c` Phase 14, §B.2 |
| AC5 | a trace with a gap in its sequence numbers yields fail with reason trace_incomplete, never pass | `02` Phase 1, `02b` Phase 7, §B.1, §C.2 |
| AC6 | a blocked scenario names what blocks it and is never rendered as a pass or left out of the report | `02b3` Phase 13, `02c` Phase 16, §B.2, §C.5, §C.6 |
| AC7 | every result that used the fixture track is labelled FIXTURE wherever it appears, and no fixture file is inside the Release package | `02` Phase 4, `02c` Phase 15, `02c` Phase 16, §B.2, §C.3 |
| AC8 | the report shows, per scenario: the use case in a sentence, the steps taken, what was captured, what the app spoke, the decisive trace lines, the app criteria covered, the verdict and the run conditions | `02c` Phase 16, §C.7 |
| AC9 | the report carries a coverage matrix with one row per criterion of the app, its text read from the app registry at build time, its class, and the scenarios behind it; no criterion is missing | `02c` Phase 16, §B.2, §C.7 |
| AC10 | the report states what it cannot show — audible ducking, VoiceView, the memory bound on hardware, cue placement against dialogue — on the same page as what it does | `02c` Phase 16, §B.2 |
| AC11 | the report rebuilds from its committed run record with no device attached | `02c` Phase 16, §C.7 |
| AC12 | the published report is within limits.report.max_total_mb, carries limits.report.attribution on every page showing the film, and is linked from README.md | `02c` Phase 16, `02c` Phase 17, §C.7 |
| AC13 | a timeline strip per cue scenario shows windows, cue starts and ends, and the duck and restore instants, drawn from the trace | `02c` Phase 16, §C.7 |
| AC15 | when a VARIANT suite ends, pass or fail, the device holds the Release package again, and the next launch emits INTERSTICE.app.mode e2e=false | `02b` Phase 9, `02b3` Phase 13, §C.3, §C.6 |
| AC14 | FRICTION-LOG.md gains a dated entry for each platform obstacle met while building this, written the day it is met | `02c` Phase 18, §C.8 |

---

# Coverage map — `01-master-plan.md` §7 checklist

| `01` §7 checklist item | covered by |
|---|---|
| `D1`: the emulator gRPC interface returns a current frame after a key press | `02` Phase 0.2 |
| `D2`: `inputd-cli` reaches the app on today's image | `02` Phase 0.1 |
| `D3`: a recorded clip carries audio | `02` Phase 0.3 |
| `D4`: the build flag is visible to the bundle | `02` Phase 0.4, §C.3 |
| `D5`: host-served track, cue audio and segments play through MediaSource | `02` Phase 0.5 |
| each answer recorded as measured, with the capture rung and the input route chosen (`AC1`) | `02` Phase 0.6, §C.1 |
| every line carries a sequence number and a device clock (`C12`, `C16`); a gap fails the run (`AC5`, `D7`) | `02` Phase 1, `02` Phase 2, `02b` Phase 7, §B.1, §C.2 |
| the playhead and each overlay's spoken text are emitted (`C15`) | `02` Phase 3, §C.2 |
| verdicts come from the trace alone (`AC3`) | `02b3` Phase 13, §C.4 |
| `S01`–`S05` run from one command against the Release package and exit non-zero on a fail (`AC2`) | `02b2` Phase 12, `02b3` Phase 13, §C.5 |
| the selftest shows each scenario can fail (`AC4`, `C10`) | `02c` Phase 14, §B.2 |
| the fixture is built, served from the host, and absent from the Release package (`AC7`, `C8`, `C13`, `C14`) | `02` Phase 4, `02` Phase 5, `02c` Phase 15, §C.3 |
| `S10`–`S16` run; `S17` is rendered blocked by `D6` (`AC6`) | `02b2` Phase 12, §C.6 |
| the device holds the Release package again when a VARIANT suite ends (`AC15`) | `02b3` Phase 13, §C.6 |
| `S18` if time allows | not written — `deferred` in `limits.suite`, reopens when Phases 0 to 3 close before 2026-10-12 |
| per scenario: use case, steps, captures, spoken transcript, decisive lines, criteria covered, verdict, conditions (`AC8`) | `02c` Phase 16, §C.7 |
| the coverage matrix, criterion text read from the app registry, none missing (`AC9`) | `02c` Phase 16, §B.2 |
| what it cannot show, on the same page (`AC10`) | `02c` Phase 16, §B.2 |
| the timeline strip per cue scenario (`AC13`) | `02c` Phase 16, §C.7 |
| rebuilds with no device (`AC11`) | `02c` Phase 16, §C.7 |
| published within its size bound, attributed, linked from `README.md` (`AC12`, `C11`, `C20`, `C22`) | `02c` Phase 17, §C.7 |
| the app set registers `src/e2e.ts` and notes the three files changed here (§3.3) | `02` Phase 4 |
| `D6` reported to the owner as an app finding | `_log.md` R1-F1; `03-stakeholder-requirements.md` §7 |
| `FRICTION-LOG.md` entries written on the day each obstacle is met (`AC14`, `C21`) | `02c` Phase 18, §C.8 |
