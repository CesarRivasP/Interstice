# Master Plan — E2E harness — scripted device runs of Interstice that end in an evidence report a judge can read

> **Objective:** one command drives the Interstice app on the Vega Virtual Device through its use cases, decides each one from the app's own trace, captures what was on screen and what was spoken, and builds a static report that maps every acceptance criterion of the app to the evidence behind it — or says plainly why there is none.

- **Status:** implementing
- **Date:** 2026-10-04
- **Technical owner:** César Rivas (CesarRivasP)
- **External owner:** nobody with an ask. The reader outside the build is the hackathon judging panel, who receive the published report and owe nothing in return
- **Related documents:**
  - `02-implementation.md` — preamble (governs every half) + Phases 0–6: the spike gate and the app-side changes
  - `02b-harness.md` — Phases 7–11: trace, collector, device, input, capture
  - `02b2-scenarios.md` — Phase 12: the scenarios
  - `02b3-runner.md` — Phase 13: the runner
  - `02c-report-and-delivery.md` — Phases 14–18: selftest, fixtures, report, publication, friction log
  - `02e-tests-and-e2e.md` — test plan, manual E2E and Definition of Done
  - `03-stakeholder-requirements.md` — what the judging panel receives

> Every shared datum in this document comes from `_facts.yml`; every command from `_profile.yml`. Do not hand-edit numbers, names or commands here — change them in the registry (or the profile) and run `sync`.

> **This set tests another set.** The app is specified in `docs/features/interstice/`. Its entries are cited qualified — `` `docs/features/interstice/_facts.yml` acceptance.AC5 `` — and never copied. A bare `AC5`, `C4` or `D1` in this document is this set's own.

---

## Changelog

### 2026-10-04 — v3: verify R5 — Phase 0 ran on the Virtual Device: D1, D2, D3 and D5 hold; D4 is dead as written and fixed by keying the Metro cache on the flag (changes C24); the capture rung is grpc, the input route inputd-cli; status reviewed -> implementing

The spike gate ran the same day and answered all five hypotheses on the device. Keys injected with `inputd-cli` reach the app (`D2`), the emulator gRPC interface returns current 1920x1080 frames (`D1`) and records clips **with the device's audio** (`D3`), and bytes served from the host play through `MediaSource` (`D5`). `D4` failed in exactly the direction that mattered: with the build flag compiled in by Babel alone, a Release build made after a flagged one **kept the test host** — four alternating builds, four launches reporting `e2e=true` — because the transform cache does not key on the environment. `C24` puts the flag into Metro's cache version; five alternating builds then came out right. Without the both-directions check in `02` Phase 0.4, the package submitted to the hackathon could have carried a test switch nobody put there on purpose.

### 2026-10-04 — v2: review R2 dispositions and owner confirmation — a launch id on the wire, fixtures addressed by collector state not by URL, a 60 s fixture asset so a stall can happen, the device restored to the Release package after a VARIANT run, published paths made relative; status draft -> reviewed

`review` read the package source the scenarios lean on and found six ways the v1 plan would not have run as written. The two that changed the design: the fixture path cannot carry a scenario id, because one VARIANT package knows one path — the scenario is state the runner arms on the collector; and the 20 s clip **cannot stall**, because every segment of it sits inside the buffer window and is fetched before playback starts — so the fixture brings its own 60 s of media (`limits.fixture`). One finding was about the submission rather than the harness: a VARIANT run leaves the test build on the device, and the demo video is recorded from that device (`AC15`). The owner confirmed `decisions.fixture_track` and `decisions.timebox`.

### 2026-10-04 — v1: initial decision draft — scope, capture ladder, two suites, fixture track, published report

First version. Four intake answers from the owner are recorded as decisions; a fifth (`decisions.fixture_track`) and the schedule (`decisions.timebox`) are the authoring agent's recommendation and are confirmed or overturned with the `reviewed` flip.

---

## 1. Problem

The app's end-to-end checks are ten manual procedures (`docs/features/interstice/02e-tests-and-done.md` Part C). Each one is a person pressing keys and reading a log. That has three costs, and the third is the one that matters for the submission.

**It does not get re-run.** Six playback defects reached the device on 2026-09-27 through suites that were green. They were found because somebody happened to watch a run to its end. A procedure that costs a person ten minutes is run when something already looks wrong.

**The owner cannot see the product's use cases side by side.** There is no screenshot command on this platform (`limits.capture.cli_has_no_screenshot`: 25 device subcommands, none of them a screenshot, a screen record or a key press), so today a use case exists as a memory of having watched it.

**A judge sees none of it.** The repository's claims — a cue stays in its gap, the film comes back to full volume after a failed cue, a missing track is spoken rather than silent — are backed by log lines in a handoff log. They are true and they are not legible to someone with fifteen minutes. Technical implementation and design are two of the five equally weighted criteria; both are scored on what the panel can check.

Two findings came out of writing this plan, before any code:

- **`D6` — the app has no seek.** Nothing in the app or its package changes the playhead from a key. `docs/features/interstice/_facts.yml` acceptance.AC6 and manual step C.4 ("hold right for five seconds") cannot be shown on a device as written. Measured, and owned by the app set.
- **Nothing emits the playhead** (`limits.trace.no_position_line`). "The film kept playing while description was toggled" cannot be asserted today: the absence of a stall line is not evidence of playback.

## 2. Chosen solution

A host-side harness in `e2e/` that treats the device the way the manual procedure does — launch, press keys, read the trace — and adds the two things a person cannot do: decide mechanically, and keep the evidence.

**The trace decides; pixels illustrate** (`decisions.trace_is_the_oracle`). The app already emits an `INTERSTICE.*` line at every state change. A scenario is a list of steps and a list of assertions over those lines. Screenshots and clips are attached for the reader and never consulted for the verdict — focus can be visually right and natively wrong, and the one documented screenshot route is reported to return a stale frame on every other call (`limits.capture.appium_stale_frames`).

**Capture is a ladder, not a dependency** (`decisions.capture_ladder`). Rung 1 is the emulator gRPC interface under the Virtual Device (`limits.capture.emulator_grpc` — third-party observation, undocumented by Amazon, hypothesis `D1`); rung 2 is Appium with the Vega driver; rung 3 is no pixels, with the report built from traces and rendered timelines. The harness is complete on rung 3. Phase 0 finds out which rung this machine reaches.

**Two suites, never mixed** (`decisions.two_suites`). RELEASE runs against the unmodified Release package — the binary that is submitted. VARIANT runs against a build made with a build-time flag that lets the harness serve content from the host, and therefore break it on purpose: a truncated track, a cue with no audio, a segment withheld mid-film. Every result says which suite produced it.

**A labelled fixture stands in for the track that does not exist yet** (`decisions.fixture_track`, confirmed by the owner on 2026-10-04). `docs/features/interstice/_facts.yml` defects.D4 still blocks the real description track. The scheduler, the toggle, the verbosity switch and the failure states are testable today against a fixture that is never packaged, never in the demo, and marked FIXTURE wherever its results appear. It brings its own media as well — the first 60 seconds of the film, served from the host (`limits.fixture`) — because the packaged clip is shorter than the buffer window and can never run dry. What it cannot show is stated with it: a fixture cue staying inside a declared window says nothing about dialogue.

**Four verdicts** (`decisions.verdict_vocabulary`): pass, fail, blocked, skipped. A blocked scenario names its blocker and is drawn as prominently as a failure. A trace with a gap in its sequence numbers is a failure whatever its assertions said.

**The report is a committed static site** (`decisions.report_static_pages`), generated into `docs/e2e`, served by GitHub Pages, rebuilt from its run record with no device.

Why not the alternatives: Appium alone (`A1`) needs four moving parts and a second Node install (`limits.capture.host_node`) for screenshots reported unreliable on this SDK. A trace-only report (`A2`) is the floor, not the goal — the owner asked to see the use cases. A runtime test switch in the Release build (`A3`) would leave the submitted binary asking localhost where to load its track from. Host screen recording (`A4`) captures a window, needs a permission, and was already measured not to work unattended. More component tests (`A5`) are what was green on 2026-09-27.

### What the panel sees

```
Interstice — verification report            run 2026-10-08 · Vega Virtual Device · Release aarch64
────────────────────────────────────────────────────────────────────────────────────────────────
 22 criteria   4 automated · 4 fixture · 1 blocked · 2 hardware · 2 manual · 9 out of scope

 ┌ S03 · A description cue speaks over the film and the film comes back to full ─── PASS ┐
 │ [frame: before] [frame: during cue] [frame: after]            covers AC5 · RELEASE   │
 │ spoken:   (cue audio, 2.0 s)                                                         │
 │ timeline: film ████████▁▁▁▁▁▁████████   cue ·······▇▇▇▇▇·······                     │
 │ trace:    cue.fire → audio.duck to_pct=25 → cue.audio state=ended → audio.restored   │
 │ cannot show: that a listener heard it get quieter (hardware only)                    │
 └──────────────────────────────────────────────────────────────────────────────────────┘
 ┌ S17 · The viewer holds a direction to seek ─────────────────────────────── BLOCKED ┐
 │ blocked by D6: the app has no seek control                                           │
 └──────────────────────────────────────────────────────────────────────────────────────┘
```

Each of the five judging criteria gets something it can check:

| criterion | what the report gives it |
|---|---|
| technical implementation | every criterion of the app mapped to a scenario, a trace and a verdict; one command to re-run; a harness that proves it can fail (`AC4`) |
| design | the states a blind viewer meets — loading, missing track, stall, error — each shown *and* transcribed as spoken |
| potential impact | the spoken transcript is the product from its user's side, readable by someone who has never used a screen reader |
| quality of the idea | the timeline strip makes a gap visible, which is otherwise silence |
| friction log bonus | building this meets the platform's automation gaps; each is a dated entry (`AC14`) |

## 3. Architecture

```
 host                                                   Vega Virtual Device
 ┌───────────────────────────────────────────┐          ┌──────────────────────────┐
 │ run.ts ── scenarios/*                     │  keys    │                          │
 │   │  device.ts ── vega CLI ───────────────┼─────────▶│  Interstice              │
 │   │  input.ts ─── inputd-cli | gRPC ──────┼─────────▶│   Release  or  VARIANT   │
 │   │  capture.ts ─ gRPC | Appium | none ◀──┼──frames──│                          │
 │   │  collector.ts ◀── beacon lines ───────┼──────────│  diagnostics.ts (seq, t) │
 │   │        └──── fixtures + faults ───────┼─────────▶│  e2e.ts (VARIANT only)   │
 │   ▼                                       │          └──────────────────────────┘
 │ trace.ts ── assertions ── run record      │
 │ report/ ── docs/e2e (static, committed)   │
 └───────────────────────────────────────────┘
```

### 3.1 Components that change

| id | file | change |
|---|---|---|
| `C1` | `e2e/run.ts` | the runner and its CLI: a canary launch that proves the round trip to the collector, per scenario clean start → steps → collect → verdict; exits non-zero on any fail; reinstalls the Release package when a VARIANT suite ends |
| `C2` | `e2e/device.ts` | the Vega CLI behind one module; every command from `_profile.yml` |
| `C3` | `e2e/input.ts` | remote keys by name, with a hold (`limits.input`) |
| `C4` | `e2e/capture.ts` | the capture seam: screenshot, clip, and a null implementation |
| `C5` | `e2e/collector.ts` | receives beacon lines, serves fixtures for the scenario the runner last armed, with its scripted faults, detects sequence gaps per launch |
| `C6` | `e2e/trace.ts` | line parser and the assertion vocabulary; `absent` refuses to run without naming its emitter, `in_window` places an event on the playhead |
| `C7` | `e2e/scenarios` | one file per scenario of `limits.suite` |
| `C8` | `e2e/fixtures.ts` | builds the fixture track and cue audio at three verbosity levels |
| `C9` | `e2e/report` | run record → static HTML |
| `C10` | `e2e/selftest.ts` | the harness proving each scenario can fail, against recorded traces committed from the first green run |
| `C11` | `docs/e2e` | the published report — generated, never edited by hand; pages plus the run record, its traces and its captures |
| `C12` | `src/diagnostics.ts` | each line gains a launch id, a sequence number and a device clock reading |
| `C13` | `src/e2e.ts` | new: the build-time flag resolved to a config or null |
| `C14` | `src/App.tsx` | under the flag only: the fixture title, and content resolved to the host; in both builds, one line saying which build this is |
| `C15` | `src/screens/PlayerScreen.tsx` | three emitters (`limits.trace` `new_lines`): a throttled playhead line, one line per overlay carrying what is spoken, and the description state in full |
| `C16` | `tools/beacon-server.mjs` | prints the two new fields; stays the zero-dependency reader |
| `C17` | `package.json` | the `e2e*` scripts and `build:e2e` |
| `C18` | `vitest.config.ts` | includes `e2e/__tests__` |
| `C19` | `.gitignore` | ignores `e2e/out/` |
| `C20` | `README.md` | a Verification section with the report link and the one command |
| `C21` | `FRICTION-LOG.md` | dated entries for what building this met |
| `C22` | GitHub Pages: main branch, /docs folder | the setting that serves the report; changed by the owner by hand |
| `C23` | `babel.config.js` | an inline plugin that turns the build flag into a constant in the bundle |
| `C24` | `metro.config.js` | the flag is part of the transform cache version, so a Release build is never served a flagged transform |

**The scenarios** (`limits.suite`). `covers` names criteria of `docs/features/interstice/_facts.yml` acceptance[].

| id | suite | use case | covers | decided by |
|---|---|---|---|---|
| `S01` | release | the viewer opens the app and lands on the title list with a title focused | AC1, AC2 | `app.mode e2e=false`, `asset.segments` with segments present; ENTER yields `app.play` |
| `S02` | release | the viewer plays the demo clip from start to finish | AC1 | open, one append per segment, complete, play, playhead advancing to the end, **exactly one** eviction |
| `S03` | release | a description cue speaks over the film and the film comes back to full | AC5 | fire → duck to 25 → ended → restored, playhead advancing between |
| `S04` | release | BACK during playback returns to the list, and the viewer can start over | AC2 | `player.back from=playing`, then a second `app.play` |
| `S05` | release | the title has no description track; the app says so and the film plays anyway | AC8 | `loader.miss`, `controls.announce kind=missing`, playhead still advancing |
| `S10` | variant | three cues each start and finish inside their window | AC4 | per cue, duck inside the window and restore before its end |
| `S11` | variant | description off mid-film and back on; the film never stops | AC3 | toggle off, no duck while off, no stall, toggle on, next cue fires and the missed one does not |
| `S12` | variant | concise, standard, detailed while watching | AC17 | concise loads fewer cues than standard; detailed, whose file is absent, misses and standard loads |
| `S13` | variant | the track file is corrupt; the app says something different from "missing" | AC8 | `loader.load ok=false` with a reason, then `controls.announce kind=malformed`, playhead still advancing |
| `S14` | variant | one cue has no audio; the film must not be left quiet | AC5 | `audio.failed` then `audio.restored` for that cue |
| `S15` | variant | the bytes run short; the viewer is told, and playback resumes | AC24 | `player.stalled` after the playhead has passed 30000, then `player.resumed from=stalled` once the runner releases the held segment |
| `S16` | variant | the title cannot be opened; the viewer is told and BACK works | AC2 | the init segment's connection is dropped → open failure, then `player.back from=error` |
| `S17` | variant | a held direction seeks and the scheduler resyncs once | AC6 | **blocked by `D6`** |
| `S18` | variant | a feature-length film plays without the buffer growing *(stretch, deferred)* | AC23 | repeated eviction with a bounded held count — supports the criterion, cannot close it |

**How the app's criteria are classed** (`limits.coverage`): of 22, **4 automated**, **4 fixture**, **1 blocked**, **2 hardware**, **2 manual**, **9 out of scope** — each number counts criteria of the app in that class. Out of scope means the criterion is about the pipeline, the package, or the submission itself, and no device run can speak to it. Four classifications are partial and the report says how: the clip rather than the full film; inside the window rather than clear of dialogue; the volume property rather than what a listener hears; the Virtual Device rather than the worst device.

### 3.2 Rollout strategy

Per `decisions.timebox`: four phases inside 2026-10-05 .. 2026-10-12, sized in working sessions because no hour figure has been measured.

| phase | what | sessions | leaves behind |
|---|---|---|---|
| 0 — spike gate | answer `D1`, `D2`, `D3`, `D4`, `D5` on the device, record each as measured (`AC1`) | one | the capture rung, the input route, whether audio can be recorded, how the flag and the fixtures travel |
| 1 — RELEASE suite | `C1`–`C6`, `C10`, `C12`, `C15`–`C19`, scenarios `S01`–`S05`, a first report | two | a green run of the submitted binary and a page that shows it |
| 2 — VARIANT suite | `C8`, `C13`, `C14`, `C23`, scenarios `S10`–`S16`, `S17` rendered blocked | two | fault scenarios and the fixture label end to end |
| 3 — publish | `C9` finished, `C11`, `C20`–`C22`, the timeline strip | one | the link in the README |

**Order of sacrifice**, decided now: `S18` goes first, then video capture (screenshots stay), then the timeline strip, then Phase 2 as a whole. The RELEASE suite and its report are the floor and never yield.

**Phase 0 can end the set.** If `D1` and `D2` are both false there is no way to press a key on this image, and the set stops there with that recorded — which is itself a friction-log entry and a product-feedback item.

### 3.3 Critical coordination

Four files this set changes belong to the app set, and one check there will fail if this is ignored:

- **`pipeline/__tests__/scope.test.ts` fails on any file under `src/` with no entry in the app registry.** `src/e2e.ts` (`C13`) is new, so the app set gains a `changes[]` entry for it in the same commit, or `npm test` goes red.
- **`src/diagnostics.ts`, `src/App.tsx`, `src/screens/PlayerScreen.tsx`** are the app set's `C22`, `C1` and `C2`. They are changed here and their entries there are updated to say so.
- **`_profile.yml` is shared and one line of it is stale**: `commands.tests_expect` reads "63 passed, 63 total", the jest count before 2026-09-27; today's is 24 (`tests_baseline`). Exit 0 is the pass signal the profile names as authoritative, so nothing is broken — but this set will move the count again (`C18`), and the line should be re-measured then, once, by whoever makes that change.
- **`D6` is the app's to fix.** A seek control is product scope. This set records the finding and renders `S17` blocked; it does not add the control.

## 4. Data specification

One line on the wire, per `endpoints.beacon`: `GET http://localhost:8099/?m=<line>&b=<launch id>&s=<seq>&t=<device ms>`. The query is `contracts.beacon_query` — `m`, `b`, `s`, `t`. The launch id, sequence number and device clock are new (`C12`). They exist because arrival order is not emission order and a dropped request leaves no trace of itself (`limits.trace`, `D7`), and because the sequence restarts with every launch while one collector session spans many. Every run opens with a canary launch whose first line must arrive before any scenario starts.

What the collector stores per line, `contracts.trace_event`:

```json
{
  "boot": "k3f9x2",
  "seq": 41,
  "t_dev_ms": 1791471731402,
  "t_host": "2026-10-08T15:02:11.482Z",
  "line": "INTERSTICE.audio.duck id=probe to_pct=25",
  "name": "audio.duck",
  "fields": { "id": "probe", "to_pct": "25" }
}
```

Fixtures are served per `endpoints.fixtures`: `GET http://localhost:8099/fx/<path>`. The path carries no scenario: one VARIANT package knows one location, fixed at build time. Which scenario's files and faults are served is state of the collector, armed by the runner before each launch and cleared after it, with the app terminated in between so nothing carries over. `endpoints.emulator_grpc` is null until Phase 0 measures it.

The VARIANT build resolves `contracts.e2e_config` — `host`, `asset_id`, `asset_dir`, `segment_base` — from the build flag (`C23`), and reads the fixture's media layout from the host as `contracts.fixture_asset` — `init`, `segments`. The Release build resolves null: the flag compiles to the empty string, and nothing at run time can change a compiled constant.

A run is `contracts.run_record` (`run_id`, `started_at`, `suite`, `conditions`, `app_commit`, `package_version`, `capture_rung`, `input_route`, `selftest`, `restored_release`, `results`), and each of its results is `contracts.scenario_result` (`id`, `name`, `suite`, `use_case`, `covers`, `fixture`, `verdict`, `reason`, `blocked_by`, `steps`, `assertions`, `spoken`, `artifacts`, `trace_path`, `duration_ms`). `conditions` carries the three keys `_profile.yml` requires of every device run. Every path inside a run record is relative to its run directory, so publishing is a copy. The report is a pure function of the run record plus the app registry, which is what lets it rebuild with no device (`AC11`).

The criterion text in the coverage matrix is read from `docs/features/interstice/_facts.yml` at build time (`decisions.ac_text_read_not_copied`). A scenario carries ids only.

Environment, names only: `INTERSTICE_E2E`, `BEACON_PORT`, `E2E_CAPTURE`.

## 5. Security

- **The Release package gains no test switch.** The flag is build-time (`decisions.two_suites`); the alternative that was simpler to build (`A3`) would have let anything listening on the device's localhost choose what a blind viewer is told about the picture. `AC7` asserts no fixture file is inside the Release package.
- **The collector binds to loopback only**, as `tools/beacon-server.mjs` does today, and serves only files under the fixture directory of the scenario named in the path (`decisions.host_served_fixtures`). A path that escapes it is a 404.
- **Trace lines are untrusted text.** They come off a device and are rendered into HTML that is then published. The report escapes every line; nothing from a trace is ever written as markup.
- **The published report is public.** It holds file paths inside the package, timings, and frames of a CC-BY film — each page showing one carries `(CC) Blender Foundation | mango.blender.org` (`limits.report`). It holds no credentials: the harness reads none, and the fixture audio is generated before the run, not during it.
- **A third-party tool on rung 1.** `R-VVD-DRIVER` is unofficial and its license is unread (`limits.capture`: `wrapper_license` is null). It is pinned to a commit or not used; if its license does not allow that, `C4` speaks the gRPC interface directly. It runs on the host against a local emulator and never ships.

## 6. Cost and scalability

No cloud cost: the only AWS call is Polly for a handful of fixture cues, made once and cached, on credit the project already holds.

The cost that needs a bound is the repository. The report is committed, so `limits.report` caps it: 25 MB in total, 300 KB per screenshot, 12 s and 3 MB per clip, one published run at a time (`decisions.report_static_pages`). Run output stays in `e2e/out/`, ignored.

Run time and report size are unmeasured (`worst_case` — both null) and bounded in advance by a 90000 ms timeout per scenario (`limits.timing`). The measured values replace the nulls after Phase 1.

## 7. Master checklist

**Phase 0 — the spike gate**
- [ ] `D1`: the emulator gRPC interface returns a current frame after a key press
- [ ] `D2`: `inputd-cli` reaches the app on today's image
- [ ] `D3`: a recorded clip carries audio
- [ ] `D4`: the build flag is visible to the bundle
- [ ] `D5`: host-served track, cue audio and segments play through MediaSource
- [ ] each answer recorded as measured, with the capture rung and the input route chosen (`AC1`)

**The trace**
- [ ] every line carries a sequence number and a device clock (`C12`, `C16`); a gap fails the run (`AC5`, `D7`)
- [ ] the playhead and each overlay's spoken text are emitted (`C15`)
- [ ] verdicts come from the trace alone (`AC3`)

**The RELEASE suite**
- [ ] `S01`–`S05` run from one command against the Release package and exit non-zero on a fail (`AC2`)
- [ ] the selftest shows each scenario can fail (`AC4`, `C10`)

**The VARIANT suite**
- [ ] the fixture is built, served from the host, and absent from the Release package (`AC7`, `C8`, `C13`, `C14`)
- [ ] `S10`–`S16` run; `S17` is rendered blocked by `D6` (`AC6`)
- [ ] the device holds the Release package again when a VARIANT suite ends (`AC15`)
- [ ] `S18` if time allows

**The report**
- [ ] per scenario: use case, steps, captures, spoken transcript, decisive lines, criteria covered, verdict, conditions (`AC8`)
- [ ] the coverage matrix, criterion text read from the app registry, none missing (`AC9`)
- [ ] what it cannot show, on the same page (`AC10`)
- [ ] the timeline strip per cue scenario (`AC13`)
- [ ] rebuilds with no device (`AC11`)
- [ ] published within its size bound, attributed, linked from `README.md` (`AC12`, `C11`, `C20`, `C22`)

**Coordination**
- [ ] the app set registers `src/e2e.ts` and notes the three files changed here (§3.3)
- [ ] `D6` reported to the owner as an app finding
- [ ] `FRICTION-LOG.md` entries written on the day each obstacle is met (`AC14`, `C21`)

## 8. Risks

| risk | mitigation |
|---|---|
| Phase 0 finds no way to press a key (`D1` and `D2` both false) | the set stops at Phase 0 by design; the finding goes to the friction log and to product feedback. Cost: one session |
| the gRPC interface is undocumented and a Vega update removes it | capture is behind one seam with a null rung (`decisions.capture_ladder`); verdicts never depended on it (`decisions.trace_is_the_oracle`) |
| a green report read as more than it is | the suite column, the FIXTURE label, the blocked verdict and the cannot-show section are in the report's contract, not its styling (`AC6`, `AC7`, `AC10`) |
| the test build is still on the device when the demo video is recorded | the runner reinstalls the Release package when a VARIANT suite ends, pass or fail; the fixture title reads `E2E FIXTURE — not a film`; every launch says which build it is (`AC15`, `limits.fixture`) |
| the fixture is mistaken for the product's track, against `docs/features/interstice/_facts.yml` acceptance.AC7 | its own asset id, never packaged, never in the video, labelled everywhere; confirmed by the owner (`decisions.fixture_track`) |
| the harness passes because the trace is incomplete, not because the app is right | sequence numbers, a gap fails the run, and `absent` assertions must name their emitter (`D7`, `C6`) |
| instrumentation changes the thing measured — a line per second in the player | one throttled line at `limits.timing` `progress_interval_ms`; `S02` on the Release build is compared against the 2026-09-27 device trace before and after |
| it eats the time the video and the submission need | `decisions.timebox` and its order of sacrifice; the floor is two sessions past the spike |
| the published report bloats the repository a judge must clone | `limits.report` bounds, one published run, enforced by `e2e:publish` (`AC12`) |
| a frame of the film published without attribution | `limits.report` `attribution` on every page that shows one, checked by `AC12` |
