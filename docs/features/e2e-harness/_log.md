# Handoff log — e2e-harness

Append-only. One `##` block per round, newest at the BOTTOM. Never edit or delete
a previous entry — a rejected finding with its evidence attached is what stops the
next round re-deriving it.

**Read this file from disk before anything else. It outranks your context window.**
If your context disagrees with the log, your context is stale: re-read the files
the last entry names, at the versions it names.

Hashes: `python3 scripts/audit.py <dir> --read-line [FILE ...]` prints the
`Read:` line. By hand: `git hash-object <file>` (first 7 chars) plus `wc -l`. Both.

---

## R1 · 2026-10-04 · claude-fable-5-1 (Claude Code) · author
**Read:** `docs/features/interstice/_facts.yml` (1927 lines, blob 422b42b) · `docs/features/interstice/_log.md` (253 lines, blob 61ff333) · `docs/features/interstice/02e-tests-and-done.md` (284 lines, blob 6b8d022) · `docs/features/_profile.yml` (67 lines, blob 1ab556a) · `src/App.tsx` (145 lines, blob a52ccce) · `src/screens/PlayerScreen.tsx` (281 lines, blob 4491f3d) · `src/diagnostics.ts` (26 lines, blob fee5b0d) · `tools/beacon-server.mjs` (32 lines, blob 3dea0de)
**Log read through:** — (first entry)
**Dispositions:** — (nothing prior)
**About to do:** `new e2e-harness` — stage 1 only. Registry plus `01-master-plan.md` for an automated E2E harness that drives the Interstice app on the Vega Virtual Device, asserts on the beacon trace, captures the screen, and builds a static evidence report for the judging panel. Owner answered the intake batch on 2026-10-04: capture through the emulator gRPC with a fallback ladder, report as static HTML in the repository published through GitHub Pages, a set of its own. The fixture-track question came back as a request for a recommendation, so that decision is recorded as recommended-not-confirmed.
**Stage:** draft — first entry. Nothing is confirmed: the `reviewed` flip is the owner's.
**Findings, made while deriving scenarios from the code:**
- R1-F1 `FUNCTIONAL` `defects[D6]`: **the app has no seek.** `rg` for `currentTime = `, `seekTo`, `useTVEventHandler` and `onKey` over `src/` and the package source returns nothing, one symbol per command. The package adapter listens for `seeked` and nothing causes one. So `docs/features/interstice/_facts.yml` acceptance.AC6 cannot be shown on a device and manual step C.4 of the app's `02e` cannot be walked as written. Owned by the app set; here it blocks `S17`.
- R1-F2 `FUNCTIONAL` `limits.trace.no_position_line`: nothing emits the playhead, so "the film kept playing" is unassertable — silence from `player.stalled` is not evidence of playback. `changes[C15]` adds the emitter.
- R1-F3 `DRIFT`, in the shared profile: `_profile.yml commands.tests_expect` reads "63 passed, 63 total"; jest reports 24 since 2026-09-27. Not edited from this set — reported.
- R1-F4 `CONTRADICTION` between two observations of the world: the app set measured `inputd-cli` reaching the app on 2026-09-25; a third party reported on 2026-09-30 that it never does. Carried as `defects[D2]`, asserted until re-measured.
**Gap sweep (base + `mobile-tv`):** landed in the registry rather than in a list — trace loss and ordering (`defects[D7]`, `contracts.beacon_query`), concluding from silence (`changes[C6]`: `absent` must name its emitter), untrusted trace text rendered into published HTML (doc 01 §5), a test switch in the shipped binary (`alternatives[A3]`), repository growth (`limits.report`), film frames published without attribution (`limits.report.attribution`), a third-party tool of unread license (`limits.capture.wrapper_license: null`). `mobile-tv`: focus is asserted through its effect in the trace, never from a frame (`decisions.trace_is_the_oracle`); held-key behaviour is `S17`, blocked. **Stated blind spot:** every run is on the Virtual Device; nothing here is evidence for a physical Fire TV.
**Edits:** `_facts.yml` (712 lines, blob bde83fb) — new · `01-master-plan.md` (271 lines, blob ecac86f) — new · this log. Nothing outside `docs/features/e2e-harness/` was touched.
**Validation:** `npm test` exit 0 (jest 24, vitest 70 — the baseline, nothing added) · `audit.py` → clean after one fix: check 18 rejected an anchor into the package repository written as if it were a path here.
**Still open:** `decisions.fixture_track` and `decisions.timebox` are the agent's recommendation, unconfirmed · `defects[D1]`–`[D5]` and `[D7]` are `basis: asserted` and are what Phase 0 exists to answer · `limits.capture.wrapper_license` unread · `worst_case` unmeasured · `review` has not run.
**Next mode:** `review e2e-harness`, then the owner's `reviewed` flip, then `implement`.

---

## R2 · 2026-10-04 · claude-fable-5-1 (Claude Code) · review
**Read:** `_facts.yml` (712 lines, blob bde83fb) · `01-master-plan.md` (271 lines, blob ecac86f) · `docs/features/_profile.yml` (67 lines, blob 1ab556a)
**Log read through:** R1
**Ran serially** — `_profile.yml` has no `parallel:` key. Base sweep plus the `mobile-tv` layer, and the package source read for what the scenarios assume (`SegmentBuffer.ts`, `TrackLoader.ts`, `messages.ts`, the vega adapter).
**Findings:**
- R2-F1 `FUNCTIONAL` `contracts.beacon_query`: **the sequence number restarts at 0 on every launch and the collector cannot tell.** S04 relaunches nothing, but every scenario starts from a terminated app, and a suite is one collector session: launch two emits seq 0..n over launch one's 0..m. Gap detection then either fires on every scenario boundary or, worse, a lost line in launch two is masked by the same number from launch one. Needs a per-launch id on the wire.
- R2-F2 `FUNCTIONAL` `limits.trace`: **the first lines of a launch are emitted at module load**, before anything can confirm the collector is reachable. If forwarding is not up, they are lost inside a `catch` and the trace starts at seq 3 — the run is `trace_incomplete` for a reason that is the harness's, not the app's. The preflight must prove the round trip before launching, and a first seq other than 0 must fail loudly rather than be tolerated.
- R2-F3 `FUNCTIONAL` `contracts.beacon_query.t`: "device monotonic clock" names an API nobody measured on this runtime. `Date.now()` exists everywhere and is all the timeline needs — intervals between lines of one launch.
- R2-F4 `FUNCTIONAL` `endpoints.fixtures`: **unbuildable as written.** The path carries a scenario id, but the app's fixture location is fixed at BUILD time (`decisions.two_suites`), so one VARIANT package can only ever ask for one path. As specified it needs a package per scenario. The scenario has to be state of the collector, set by the runner, not part of the URL.
- R2-F5 `FUNCTIONAL` S15: **on the 20 s clip a withheld segment is not a stall, it is a hang in loading.** `SegmentBuffer.start()` awaits `ensure(0)`, and `wanted()` takes every segment starting within `aheadMs` (30 000) of the playhead — on a 20 s asset that is all of them, fetched before `open()` resolves and before `play()` is called. The scenario as written asserts `player.stalled` after playback began and would time out in `loading`. The fixture asset must be longer than the ahead window.
- R2-F6 `FUNCTIONAL` S16: `fetchBytes` never checks `response.ok`, so a 404 with a body is appended as media rather than rejected, and what happens next is the platform's choice. A fault that must produce `player.open failed` has to make `fetch` itself reject — a dropped connection — not return a status.
- R2-F7 `SECURITY`/`FUNCTIONAL` the VARIANT package: **it shares the app id with the Release package, so after a VARIANT run the device holds the test build.** Scenario: the suite runs on 10-11, the demo video is recorded on 10-18 from the same Virtual Device, and the title list in the submitted video shows a fixture title and plays fixture cues — the exact confusion `decisions.fixture_track` promises cannot happen. Nothing in the plan restores the device.
- R2-F8 `FUNCTIONAL` `contracts.scenario_result`: `trace_path` and `artifacts[].path` point into `e2e/out/`, which git ignores. The published report would link to files that are not in the repository, and `AC11` (rebuild with no device) would hold only on the machine that ran it.
- R2-F9 `FUNCTIONAL` S12, S13: the decisive lines named `scheduler.load` and `controls.announce`; the loader's own verdict is `loader.load path=… ok=… cues=…|reason=…`, which R1 missed. It is the line that distinguishes "malformed" from "missing" at the source.
- R2-F10 scale: **is this worth building now?** The number: 19 days to the deadline, with the app set still owing the video, the submission text, a validation session due 10-16 and `defects[D4]`. The RELEASE suite and its report are three sessions including the spike and are what the panel reads. `S18` needs the whole film segmented and minutes per run for a result that cannot close its criterion.
**Edits:** none (review changes nothing)
**Still open:** carried from R1.

---

## R3 · 2026-10-04 · claude-fable-5-1 (Claude Code) · validate
**Read:** `_facts.yml` (712 lines, blob bde83fb) · `01-master-plan.md` (271 lines, blob ecac86f) · `docs/features/_profile.yml` (67 lines, blob 1ab556a)
**Log read through:** R2
**About to do:** disposition R1-F1..F4 and R2-F1..F10 in the registry and doc 01, and record the owner's confirmation.
**Owner confirmation:** on 2026-10-04 the owner was shown the two decisions carried as the agent's recommendation (`decisions.fixture_track`, `decisions.timebox`) and the next steps (`review`, the `reviewed` flip, `implement`), and answered **"hazlo"**. Recorded as confirmation of both decisions and of the flip. `decided_by` on both now names the owner.
**Dispositions:**
- R1-F1 (`D6`, no seek) → **confirmed**. Stays `open`, `owned_by` the app set; `S17` is rendered blocked. Nothing in this set fixes it.
- R1-F2 (no playhead line) → **confirmed**. `changes[C15]`.
- R1-F3 (profile `tests_expect` stale) → **deferred**. Settled by whoever next changes the test count, which is this set's `C18`; doc 01 §3.3 says so.
- R1-F4 (`inputd-cli` observations disagree) → **deferred** to Phase 0, as `defects[D2]`.
- R2-F1 → **confirmed**. `contracts.beacon_query.b`, `contracts.trace_event.boot`; gaps are counted per launch.
- R2-F2 → **confirmed**. `endpoints.ping`, the preflight in `changes[C1]`, and `limits.trace.consequence`: a first seq other than 0 is `trace_incomplete`. Trailing loss is accepted in writing (`limits.trace.trailing_loss`) — it can only turn a pass into a fail.
- R2-F3 → **confirmed**. `t` is `Date.now()`.
- R2-F4 → **confirmed**. `endpoints.fixtures` lost its scenario segment; the collector serves whatever the runner last armed.
- R2-F5 → **confirmed**. `limits.fixture`: a 60 s asset of its own, the withheld segment starting at or after 40 000 ms; `S15` asserts the stall after the playhead passes 30 000.
- R2-F6 → **confirmed**. `S16`'s fault is a dropped connection, stated on the scenario.
- R2-F7 → **confirmed**. New `acceptance[AC15]`; `changes[C1]` reinstalls the Release package when a VARIANT suite ends; `limits.fixture.title_label`; `INTERSTICE.app.mode` in both builds and asserted by `S01`.
- R2-F8 → **confirmed**. Paths in a run record are relative to the run directory; `e2e:publish` copies the run into `docs/e2e/run/`.
- R2-F9 → **confirmed**. `S12` and `S13` decide on `loader.load`.
- R2-F10 → **confirmed in part**. `S18` is `deferred` with `reopens_when`; the rest stands, because the RELEASE suite and its report are three sessions and are the part a judge reads. The order of sacrifice in `decisions.timebox` already puts Phase 2 behind them.
**Edits:** `_facts.yml` (751 lines, blob 2ec7ca5) — `status: reviewed`, revision v2, the entries named above · `01-master-plan.md` (279 lines, blob 0bc6d08) — changelog v2, §2, §3.1, §4, §7, §8.
**Validation:** `audit.py --as-status draft` → the only findings were the two version lines this entry now records.
**Still open:** `defects[D1]`–`[D5]`, `[D7]` asserted, Phase 0 · `defects[D6]` open, the app set's · `limits.capture.wrapper_license` unread · `worst_case` unmeasured.
**Next mode:** `implement`.

---

## R4 · 2026-10-04 · claude-fable-5-1 (Claude Code) · implement
**Read:** `_facts.yml` (751 lines, blob 2ec7ca5) · `01-master-plan.md` (279 lines, blob 0bc6d08) · `docs/features/_profile.yml` (67 lines, blob 1ab556a)
**Log read through:** R3
**Stage:** draft → reviewed — the owner confirmed on 2026-10-04 ("hazlo"), after `review` R2 ran and R3 dispositioned every finding. All 22 `changes[]` entries carry `kind: planned`.
**About to do:** write `02-implementation.md` (preamble, Phases 0–6), `02b-harness-and-report.md` (Phases 7–18), `02e-tests-and-e2e.md` and `03-stakeholder-requirements.md`. Doc 02 is split from the start on the app-side / host-side boundary because it would pass 600 lines as one file.
**Split further while writing:** the stub above names `02b-harness-and-report.md`. That file never existed under that name: the host-side half came out at 1179 lines, so it was cut on phase boundaries into `02b-harness.md` (Phases 7–11), `02b2-scenarios.md` (Phase 12) and `02b3-runner.md` (Phase 13), with `02c-report-and-delivery.md` holding Phases 14–18. Eight documents, not five. Every cross-doc phase reference was swept after the cut.
**Findings, made while writing the phases against the code:**
- R4-F1 `FUNCTIONAL`, **in the app, not in this set**: `PlayerScreen` starts in `{kind: 'missing', detail: 'not loaded yet'}` and `ADControls` announces on mount, so the app speaks *"No description track was found for this title"* **before the loader has looked** — and on a title that HAS a track it says that and then the opposite. Unseen so far because the only track state the Release build has ever had is missing. `S05` asserts the announce as `seen` rather than ordered after `loader.miss` for this reason, and `S10` will show it on the fixture. For the app set to disposition.
- R4-F2 `FUNCTIONAL`: the three registry plans changed while the phases were written, each because the code said otherwise — `S15` holds its segment until the runner releases it (a timed delay is absorbed by a buffer running 30 s ahead; `limits.fixture.withheld_segment_from_ms` is 31000 and `limits.timing.withhold_ms` is gone); the round-trip proof is a canary launch, not a ping (nothing on the device can be asked to call the host on demand); `changes[C23]` `babel.config.js` is the flag's mechanism and was missing from scope. All three are in the registry and doc 01.
- R4-F3, **skill feedback**: check 21 treats a citation as cross-set only when a backticked span on the line holds a HYPHENATED slug-like token. The sibling set here is `interstice`, one word, so `docs/features/interstice/_facts.yml` never qualifies anything. Ids that happen to exist in both sets (`acceptance.AC5`) pass by coincidence; ids that exist only there (`contracts.description_track`, `decisions.friction_log_shape`) are reported as dangling. Worked around by naming those three in prose instead of in `container.id` form. The rule should accept a path to a sibling `_facts.yml` regardless of the slug's shape.
**Edits:** `_facts.yml` (781 lines, blob cd3fc88) — `changes[C23]`, `limits.trace.new_lines`, `limits.fixture`, `contracts.fixture_asset`, `contracts.run_record.restored_release`, `docs[]` with `regenerated_on:` · `01-master-plan.md` (283 lines, blob dd4c0ec) — related documents, §3.1, §4 · `02-implementation.md` (518 lines, blob 2cc4efd) — new · `02b-harness.md` (581 lines, blob 0a07a51) — new · `02b2-scenarios.md` (409 lines, blob d51a239) — new · `02b3-runner.md` (247 lines, blob 292b9be) — new · `02c-report-and-delivery.md` (499 lines, blob f611bd2) — new · `02e-tests-and-e2e.md` (221 lines, blob 35fc110) — new · `03-stakeholder-requirements.md` (141 lines, blob 05fb96c) — new. Nothing outside `docs/features/e2e-harness/` was touched: no code, no app registry, no profile.
**Validation:** `audit.py` below. Two POLISH left standing on purpose: `02` at 518 lines and `02b` at 581 are under the 600 threshold and nothing more is due to be written into either.
**The code in doc 02 has not been run.** It was written against the tree of 2026-10-04 with the package source open, and three blocks are marked `[AFTER PHASE 0]` because their content is what Phase 0 measures.
**Still open:** `defects[D1]`–`[D5]`, `[D7]` asserted — Phase 0 · `defects[D6]` open, the app set's · R4-F1 for the app set · `limits.capture.wrapper_license` unread · `worst_case` unmeasured · `_profile.yml tests_expect` stale, re-measured in `02` Phase 6.
**Next mode:** build — `02` Phase 0 first, on the device. `status:` flips to `implementing` with the first file that lands.

---

## R5 · 2026-10-04 · claude-fable-5-1 (Claude Code) · verify
**Read:** `_facts.yml` (781 lines, blob cd3fc88) · `01-master-plan.md` (283 lines, blob dd4c0ec) · `02-implementation.md` (518 lines, blob 2cc4efd) · `02b-harness.md` (581 lines, blob 0a07a51) · `02b2-scenarios.md` (409 lines, blob d51a239) · `02b3-runner.md` (247 lines, blob 292b9be) · `02c-report-and-delivery.md` (499 lines, blob f611bd2) · `02e-tests-and-e2e.md` (221 lines, blob 35fc110) · `03-stakeholder-requirements.md` (141 lines, blob 05fb96c) · `docs/features/_profile.yml` (67 lines, blob 1ab556a)
**Log read through:** R4
**About to do:** `02` Phase 0, the spike gate, on the Vega Virtual Device: `defects[D2]` (keys), `[D1]` (gRPC capture), `[D3]` (audio in a clip), `[D4]` (build flag, both directions), `[D5]` (host-served bytes through MediaSource). The owner said to carry it out on 2026-10-04. Conditions required by the profile — target_platform, build, content_asset — are read off the device and the build before the first observation.
**Stage:** reviewed → implementing — the first files landed this round (`babel.config.js`, `metro.config.js`, `src/e2e.ts`, `src/App.tsx`), because `defects[D4]` and `[D5]` cannot be asked without them.
**Conditions, read before the first observation:** Vega Virtual Device, `vvrp-tv-arm64`, aarch64, OS 1.2 (TV Ship/102282480), simulated · Release aarch64, SDK 0.24.12112, Vega CLI 1.3.4 · the 20 s clip, 4 segments.
**Results — all five answered, each on its entry as `basis: measured`:**
- `D2` **holds** — six presses, six trace lines (`KEY_ENTER` ×3, `KEY_BACK` ×2, `KEY_DOWN`+`KEY_ENTER`). R1-F4 → **confirmed for the app set's side**: the third-party report does not reproduce here. Not investigated why.
- `D1` **holds** — three current 1920x1080 frames around a key press, no stale one. Wrapper is MIT, pinned at `a9ea5d5`, source read before running, installed with `--ignore-scripts`. `capture_rung: grpc`.
- `D3` **holds** — a 12 s clip with h264 + aac, `mean_volume -14.4 dB`. **It does not yet show the duck**: the cue speaks over a film opening that is itself rising, so one recording cannot be read as "the film got quieter". A controlled pair is the scenario to add. The app set's claim that there is no audio capture path off this device is now false and is for that set to correct.
- `D4` **dead as written, fixed with `changes[C24]`** — R5-F1 below.
- `D5` **holds** for track files and media segments, byte counts identical to the packaged run. Cue audio from the host not yet exercised.
**Findings:**
- R5-F1 `SECURITY` `defects[D4]`: with the Babel plugin alone, a Release build made after a flagged one launched as `e2e=true host=http://localhost:8099` — **four alternating builds, four wrong**. Metro's transform cache does not key on the environment. Every build exited 0. The package that gets submitted would have carried the test host. **Fixed**: `cacheVersion` in `metro.config.js` from the same variable; five alternating builds, five right. → new `changes[C24]`, doc 01 §3.1, `02` Phase 4.
- R5-F2 `FUNCTIONAL` `limits.report`: a film frame is 1.36 MB as PNG, over four times the 300 KB bound. Captures become 1280-wide JPEG (76 KB measured). `limits.capture.frame_size`, noted in `02b` Phase 11.
- R5-F3, **for the app set, seen in the first screenshots this project has ever had:** (a) the title list shows **no focus indicator** — with two titles nothing says which one ENTER will start; (b) in the missing-track state the screen shows **no visible sentence** — `ADControls` is deliberately unstyled and its text is the default dark colour on a black screen, so the "stated visible" half of the app's AC8 is not met on screen; (c) R4-F1 reproduced on the device: `controls.announce kind=missing` is emitted **before** `loader.miss`, 2–16 ms earlier on three launches; (d) `player.surface created handle=1` is logged twice per open.
- R5-F4: port 8099 was held by a `tools/beacon-server.mjs` left running since 2026-09-26. Stopped it to read the trace. A second listener fails with `EADDRINUSE` and the app's beacon is fire-and-forget, so a stale reader silently eats every line — the runner's preflight must check who owns the port.
- R5-F5: the `.vpkg` is Zstandard-compressed, not a zip; `02e` §C.3 step 3 (`unzip -l`) does not work and needs a different listing command. Open.
**Edits:** `_facts.yml` (821 lines, blob d73a515) — `status: implementing`, revision v3, `defects[D1]`–`[D5]`, `limits.capture`, `endpoints.emulator_grpc`, `changes[C24]`, `built_on:` on C13/C14/C23/C24, `acceptance[AC1]` approved · `01-master-plan.md` (288 lines, blob 4615c73) — changelog v3, §3.1 · `02-implementation.md` (535 lines, blob 1f2d85f) — changelog v3, Phase 4 · `02b-harness.md` (583 lines, blob bf8f35f) — Phase 11 note · code: `babel.config.js`, `metro.config.js`, `src/e2e.ts` (new), `src/App.tsx` · `FRICTION-LOG.md` — two entries dated today · the app set: `docs/features/interstice/_facts.yml` (1929 lines, blob 02842d2) — `changes[C28]` · `docs/features/interstice/02e-tests-and-done.md` (284 lines, blob cb0a84a) — one sentence in §B.2 · and its log entry R45.
**Expected audit state:** check 20 reports eleven `changes[]` paths that do not exist yet (`e2e/*`, `docs/e2e`). They are the work not done, listed by the tool that is supposed to list it; they clear as each phase lands. Check 28 reports an empty `tracking:` — true: the work is on `main`, uncommitted, with no issue or PR.
**Validation:** `npm test` exit 0 — jest 24, vitest 70 (`scope.test.ts` red until `src/e2e.ts` was registered in the app set, as doc 01 §3.3 said it would be) · `npm run lint` exit 0, 12 warnings · five alternating device builds · the device was left on the Release package, last launch `INTERSTICE.app.mode e2e=false host=none`.
**Still open:** `defects[D6]` (the app set's) · `defects[D7]` asserted · R5-F3 for the app set · R5-F5 · `worst_case` unmeasured · `_profile.yml tests_expect` stale until `02` Phase 6.
**Next mode:** build — `02` Phases 1–3 and 6, then `02b` Phase 7 onward.

---

## R6 · 2026-10-04 · claude-fable-5-1 (Claude Code) · build
**Read:** `_facts.yml` (821 lines, blob d73a515) · `01-master-plan.md` (288 lines, blob 4615c73) · `02-implementation.md` (535 lines, blob 1f2d85f) · `02b-harness.md` (583 lines, blob bf8f35f) · `02b2-scenarios.md` (409 lines, blob d51a239) · `02b3-runner.md` (247 lines, blob 292b9be) · `02c-report-and-delivery.md` (499 lines, blob f611bd2) · `02e-tests-and-e2e.md` (221 lines, blob 35fc110) · `03-stakeholder-requirements.md` (141 lines, blob 05fb96c) · `docs/features/_profile.yml` (67 lines, blob 1ab556a)
**Log read through:** R5
**About to do:** build toward the floor `decisions.timebox` names — the RELEASE suite and its report. `02` Phases 1–3 and 6, `02b` Phases 7–11, `02b2` Phase 12 (RELEASE scenarios; VARIANT written, not run), `02b3` Phase 13, `02c` Phases 14 and 16. Then a device run. Branch `e2e-harness`, R1–R5 committed as `5025830`. The owner said to go ahead on 2026-10-04.
**Built:** `02` Phases 1–3 and 6 · `02b` Phases 7–10 · `02b2` Phases 11–12 · `02b3` Phase 13 · `02c` Phases 14, 15, 16 and the publish half of 17. Not built: GitHub Pages (`C22`, the owner's), and `e2e/__tests__/fixtures.test.ts`.
**Device runs, Vega Virtual Device, OS 1.2, SDK 0.24.12112, Release aarch64:**
- RELEASE, five runs: `S01` `S02` `S03` `S05` **pass**, `S04` **fail**. Exit code 1 each time. 88.9 s of scenario time.
- VARIANT, two runs: `S10` `S11` `S12` `S14` `S15` `S16` **pass**, `S13` **fail**, `S17` **blocked** by `D6`. `restored_release: true` both times. 181.7 s.
- capture `grpc`, keys `inputd-cli`, selftest 4/4 and 6/6.
**Findings in the app, both new, both for the app set:**
- R6-F1 `FUNCTIONAL` → `defects[D8]`: **after BACK the same title cannot be opened again.** Second open: `app.play`, `loader.miss`, `player.surface created handle=2` twice, then nothing — no append, no `player.opened`, no error — for 20 s. Five of five. No manual procedure ever played a title twice, which is how it survived.
- R6-F2 `FUNCTIONAL` → `defects[D9]`: **a corrupt track file is announced as missing.** `readJson` throws on a parse failure as on a 404 and the loader reads every throw as absence, so `kind=malformed` is unreachable by a truncated file. The app's own manual step C.6 expects a different message.
- Seen for the first time on a device, and working: a mid-film stall is announced and playback recovers when the bytes arrive (`S15`); a cue whose audio cannot be fetched still returns the film to full (`S14`); toggling description off drops the cue in flight's successor and does not replay it (`S11`); a missing level falls back to standard (`S12`).
**Findings in the harness as specified — four, each found by a run and each now a test:**
- R6-F3: `parseLine` took keys as `[a-z_]+`, so `e2e=false` was a continuation and `S01` failed on a correct app.
- R6-F4: a terminated app keeps emitting for a second or two; its late lines arrived after the next scenario's mark and were attributed to it (`buffer.appended` ×8, `app.play` ×3). A launch is now attributed by where its seq 0 arrived.
- R6-F5: waits searched from the start of the scenario, then from the last key press. Both let an earlier occurrence satisfy a later wait — "wait for the stall" matched the stall every playback starts with, and `S15` released its held segment 30 s early. Waits are sequential now.
- R6-F6: `count player.stalled exactly 0` in `S05` and `S12` contradicted a measurement already in the app registry (`waiting` fires at the start of normal playback). Replaced by an absence bounded between two playhead lines.
- R6-F7: the order asserted in `S02` was wrong about the app — `buffer.complete` precedes `player.opened`. And `run_record.started_at` was stamped at the end of the run.
**Changed from the plan, in the registry:** the capture wrapper is an exact devDependency (`@fortemate/vega-vvd-driver` 0.2.2) rather than a clone · captures are 1280-wide JPEG · fixture audio falls back to the host's `say` when Polly does not answer (the AWS session had expired) — `decisions.fixture_track` · `changes[C25]` `e2e/spoken.ts` · Phase 11 moved from `02b` to `02b2` to keep both under 600 lines.
**Edits:** `_facts.yml` (868 lines, blob 40d7c02) · `01-master-plan.md` (297 lines, blob e721286) · `02-implementation.md` (539 lines, blob cadf3ee) · `02b-harness.md` (529 lines, blob b5176da) · `02b2-scenarios.md` (525 lines, blob 40aebf2) · `02b3-runner.md` (265 lines, blob 4bf4c2c) · `02c-report-and-delivery.md` (529 lines, blob 0864982) · `02e-tests-and-e2e.md` (225 lines, blob 2eb1b7d) · `03-stakeholder-requirements.md` (145 lines, blob 231de55) · code under `e2e/` (new), `src/diagnostics.ts`, `src/screens/PlayerScreen.tsx`, `tools/beacon-server.mjs`, `package.json`, `package-lock.json`, `vitest.config.ts`, `.gitignore`, `README.md`, `docs/e2e/` (generated), `docs/features/_profile.yml` (73 lines, blob 526f7e4) — `tests_expect` re-measured; three `e2e_*` commands · the app set's log entry R46.
**Validation:** `npm test` exit 0 — jest 24, vitest 116 across 15 files · `npm run lint` exit 0, 12 warnings · `npm run e2e:report` rebuilds the page · the report opened in a headless browser and read: matrix of 22, cards with captures, transcript, steps, decisive lines, the blocked and the failed drawn as such.
**Not verified:** `02e` §C.2 step 5 (a hole in the sequence on a real run), §C.4 (verdicts identical with capture off), §C.5 step 3 (the canary-blocked path), §C.7 step 4 (390 px) — none was run. `acceptance[AC3]`, `[AC5]`, `[AC7]`–`[AC10]`, `[AC12]`, `[AC13]` stay below `approved` for that reason.
**Still open:** `defects[D6]`, `[D8]`, `[D9]` — the app's · `[D7]` asserted · GitHub Pages · R5-F5 (listing a `.vpkg`) · the controlled pair that would show the duck in a recording · `S18` deferred.
**Next mode:** the owner turns Pages on; the app set dispositions `D6`, `D8`, `D9` and R45's findings; then `verify`.

---

## R7 · 2026-10-04 · claude-fable-5-1 (Claude Code) · review
**Read:** `_facts.yml` (868 lines, blob 40d7c02) · `01-master-plan.md` (297 lines, blob e721286) · `02-implementation.md` (539 lines, blob cadf3ee) · `02b-harness.md` (529 lines, blob b5176da) · `02b2-scenarios.md` (525 lines, blob 40aebf2) · `02b3-runner.md` (265 lines, blob 4bf4c2c) · `02c-report-and-delivery.md` (529 lines, blob 0864982) · `02e-tests-and-e2e.md` (225 lines, blob 2eb1b7d) · `03-stakeholder-requirements.md` (145 lines, blob 231de55) · `docs/features/_profile.yml` (73 lines, blob 526f7e4)
**Log read through:** R6
**Source:** an automated security review of commit `aa91303`, which named two classes in `e2e/collector.ts` and gave no detail. The findings below are this round's own reading of the file against those two names.
**Findings:**
- R7-F1 `SECURITY` `changes[C5]` — missing origin authentication: the collector bound to loopback and answered anyone, with `Access-Control-Allow-Origin: *` on every response (inherited from `tools/beacon-server.mjs`). Scenario: a run is in progress and a browser tab on the same machine loads any page; that page issues `GET http://127.0.0.1:8099/?m=INTERSTICE.player.opened…&b=<id>&s=<n>` and the collector stores it as a line from the device. A verdict is computed from those lines (`decisions.trace_is_the_oracle`), so a forged line is forged evidence in a published report; the same page could read the fixture files. → **confirmed, fixed**: no CORS header; a request with an `Origin` is refused; the `Host` must be `localhost:<port>` or `127.0.0.1:<port>`, which closes DNS rebinding. R2's sweep covered path traversal and stopped there — doc 01 §5 said "binds to loopback only" as if that were the control.
- R7-F2 `SECURITY` `changes[C5]` — unhandled exception: `decodeURIComponent` throws `URIError` on a malformed escape (`/fx/%E0%A4%A`) inside the request handler, uncaught, and the process ends. Scenario: one such request mid-run; the collector dies, every later scenario sees no lines and reads as the app going silent. A read stream erroring on a file removed mid-read did the same. → **confirmed, fixed**: the handler is wrapped and answers 400; the stream's error ends the response.
- `tools/beacon-server.mjs` (`changes[C16]`) had both shapes and got both fixes.
**Edits:** `e2e/collector.ts`, `tools/beacon-server.mjs`, `e2e/__tests__/collector.test.ts` (four tests, each with its `Fails if`) · `02b-harness.md` (562 lines, blob fc38386) — Phase 8 code · `01-master-plan.md` (297 lines, blob 7e841d3) — §5 · `_facts.yml` (868 lines, blob 22598b2) — `tests_baseline` re-measured: vitest 120.
**Validation:** `collector.test.ts` 13 of 13 · **on the device**, because the fix could have refused the app itself: `npm run e2e:release` gave the same five verdicts as before, and `S15` (which fetches track, cue audio and segments from the collector) passed with `restored_release: true`. The app's fetch sends no `Origin` and addresses the collector as `localhost:8099`.
**Still open:** as R6. The published run in `docs/e2e/` is R6's and was not regenerated; its verdicts are unchanged by this round.

---

## R8 · 2026-10-04 · claude-fable-5-1 (Claude Code) · review
**Read:** `_facts.yml` (868 lines, blob 22598b2) · `01-master-plan.md` (297 lines, blob 7e841d3) · `02-implementation.md` (539 lines, blob cadf3ee) · `02b-harness.md` (562 lines, blob fc38386) · `02b2-scenarios.md` (525 lines, blob 40aebf2) · `02b3-runner.md` (265 lines, blob 4bf4c2c) · `02c-report-and-delivery.md` (529 lines, blob 0864982) · `02e-tests-and-e2e.md` (225 lines, blob 2eb1b7d) · `03-stakeholder-requirements.md` (145 lines, blob 231de55) · `docs/features/_profile.yml` (73 lines, blob 526f7e4)
**Log read through:** R7
**Source:** a second automated security review, of commit `d91322b`: "authorization-bypass / CSRF on loopback service (incomplete browser-origin gate)". One line, no detail; the reading below is this round's.
**Findings:**
- R8-F1 `SECURITY` `changes[C5]`: **R7's fix was incomplete, and the review is right.** R7 refused requests carrying an `Origin` and called that "anything a browser sent". It is not: an `<img src>`, a no-cors `fetch` or a navigation issues a GET with **no** `Origin`, and the beacon is a GET with a side effect. Scenario unchanged from R7-F1 — a page in a browser on the same machine forges trace lines during a run — and still open after R7. R7-F1 → **superseded** by this.
  → **fixed**, in two layers. (1) *Keep a browser out:* any request carrying a `Sec-Fetch-*` header is refused — a forbidden header name a page can neither remove nor set, sent by current browsers on every request to loopback — and `Origin` and `Referer` are refused too, for browsers that predate it. (2) *Bound what a forged line can do if one gets in:* a scenario accepts exactly one launch id, and `integrity` now fails a trace in which a sequence number arrives twice. A forger does not know the launch id (random per launch, never sent back in any response), so it can only start a second "launch" — now a failure — or guess six base-36 characters and then collide with or skip a real sequence number — also a failure.
- **What this does not do, stated rather than implied:** it does not authenticate the device. The Release package cannot carry a per-run secret, and a non-browser process of the same user can still write to the port. That is outside what a test harness on a developer machine defends against, and doc 01 §5 now says so in those words instead of "binds to loopback".
- R8-F2, found by the tests of the fix: Node's own `fetch` sends `sec-fetch-mode: cors`, so every collector test was refused by the collector. The tests now use a bare `http.request`, which is also the honest client — the app on the device sends no such header (confirmed on the device, below), and a test client should look like the app.
**Edits:** `e2e/collector.ts`, `e2e/trace.ts`, `e2e/run.ts`, `tools/beacon-server.mjs`, `e2e/__tests__/collector.test.ts`, `e2e/__tests__/trace.test.ts` · the registry, doc 01 §5, and the code in `02b` Phases 7–8 and `02b3` Phase 13 — versions on the line below.
**Edits:** `_facts.yml` (869 lines, blob d662449) — `decisions.verdict_vocabulary`, `tests_baseline` · `01-master-plan.md` (297 lines, blob 4e2dd5f) — §5 · `02b-harness.md` (579 lines, blob 39ef06d) — Phases 7–8 · `02b3-runner.md` (269 lines, blob c9465d6) — Phase 13.
**Validation:** `npm test` exit 0 — jest 24, vitest 122 · `npm run lint` exit 0 · **on the device**, because the gate could have refused the app: `npm run e2e:release` gave the same five verdicts, and `S15` passed with the Release package restored. The app's fetch sends no `Sec-Fetch-*`, `Origin` or `Referer`.
**Still open:** as R6.
