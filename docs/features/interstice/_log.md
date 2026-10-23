# Handoff log — interstice

Append-only. One `##` block per round, newest at the BOTTOM. Never edit or delete
a previous entry — a rejected finding with its evidence attached is what stops the
next round re-deriving it.

**Read this file from disk before anything else. It outranks your context window.**
If your context disagrees with the log, your context is stale: re-read the files
the last entry names, at the versions it names.

Hashes: `git hash-object <file>` (first 7 chars) plus `wc -l`. Both.

---

## R37 · 2026-09-26 · claude-opus-5 (Claude Code) · C10, and the app stops hand-listing its own asset
**Read:** `_facts.yml` (v17) · `_log.md` (through R36 end) · `02b2` Phase 6
**Log read through:** R36
**About to do:** `pipeline/synthesize.ts` (`changes[C10]`) — Polly, the fragmented-AAC container, and the three per-verbosity track files. Plus the half that can actually RUN today: emitting `contracts.asset_manifest` with its `segments`, and making `src/App.tsx` read it instead of hand-listing four segments in source.
**What is blocked and what is not, stated up front:** `C10`'s synthesis needs cue TEXT, which comes from `C9`, which `defects[D4]` blocks — and `AC7` forbids hand-writing any. So `buildTrack` is written and unit-tested against mocked Polly and ffmpeg, and its end-to-end run waits. The manifest and segment half depends on neither and runs today.
### Built
`pipeline/synthesize.ts` (`C10`) and `pipeline/prepare.ts` (`C27`), 12 tests between them.

### The app stopped hand-listing its own asset
`src/App.tsx` carried four `require()` calls with four pairs of timestamps typed into source — which drifts the moment anybody re-cuts the asset with a different segment length, and nothing would say so.

It cannot simply read them from the manifest either: **metro resolves `require` at BUILD time**, so a path computed at runtime bundles nothing, and the failure arrives on the device as a fetch for a file that is not in the package. So `prepare.ts` **generates** the module: static requires, which metro needs, with derived timings, which correctness needs. Verified on the device — init plus four segments, same as before, now with nothing hand-typed.

`prepareAsset` keeps the two halves of a manifest separate on purpose. The **authored** half is what a human measured: the asset, its subtitles, its duration and its `content_windows`, which need an eye on the frames either side of every cut and cannot be derived. The **derived** half is what a machine can produce. Mixing them is how a measurement becomes a guess.

It also warns when the segments do not reach the manifest's declared duration. That would otherwise strand the player short of the end in a `waiting` that never resolves — no error, no cause, and the viewer told nothing.

### The scope check earned its keep on day two
`scope.test.ts`, added last round, immediately failed on `pipeline/prepare.ts` and on the generated `src/assets/seg/segments.ts`. The first needed registering (`C27`); the second is **output, not scope** — registering generated files would mean the registry changing every time the asset is re-cut — so `src/assets/` is excluded with the reason written next to the exclusion. Then `audit.py` caught that `C27` was registered but cited nowhere. Two checks, two different halves of the same mistake, neither of which I would have caught by reading.

### What `C10` can and cannot do today
`buildTrack` and `synthesizeCue` are written and unit-tested with Polly and ffmpeg **injected**. The end-to-end run waits on `defects[D4]`: a track needs cue TEXT, that comes from `C9`, and `AC7` forbids hand-writing any. The container half is not waiting on anything — `limits.polly.container_chain` already ran real Polly bytes through ffmpeg to the device in R23.

Two tests carry the joins that would fail silently: descriptions are matched to windows by **window key, never by index** — indices renumber per verbosity level because `limits.ad.min_useful_words` drops more windows at concise, so an index join pairs a cue with a different cue's sentence at every level but `detailed`, and the counts still match — and a `failed` cue is **written, not dropped**, because the app can skip a failed cue and cannot skip one that is not there.

**Edits:** `pipeline/synthesize.ts`, `pipeline/prepare.ts`, `pipeline/__tests__/synthesize.test.ts` (7), `pipeline/__tests__/prepare.test.ts` (5) new · `media/clip.manifest.json` new (the 20 s excerpt is a different asset and gets its own) · `src/App.tsx` imports the generated module · `scope.test.ts` excludes `src/assets/` · `_facts.yml` (`changes[C27]`, `changes[C10].built`, `tests_baseline`) · `02b2` Phase 6 citation.
**Validation:** `npm test` exit 0 — jest 63, vitest **70** across 10 files · `npm run lint` exit 0 · `npm run build` exit 0 · `audit.py` clean · device run with the generated module.
**Still open:** the Bedrock use-case form · `AC20` **10-16** · `AC5`, `AC15`, `AC23` hardware-only.
**Next mode:** `02e`'s test plan is now well behind the suite — twelve components are built and §B.1 still describes tests for four of them.

---

## R38 · 2026-09-26 · claude-opus-5 (Claude Code) · the test plan, which its own suite had overtaken
**Read:** `_facts.yml` (v17) · `_log.md` (through R37 end) · `02e`
**Log read through:** R37

**R38-F0, and it is about this entry: THE STUB NEVER LANDED.** The command that opens a round's log entry failed with a shell error — `(eval):11: unmatched "` — and I read the next line of output instead of that one, then worked for a full round with no entry on disk. The rule exists because a round that dies halfway leaves a trace instead of silence; a stub that fails *silently* leaves exactly the silence it was meant to prevent, and I did not notice until the closing edit could not find its anchor. Recorded rather than quietly back-filled, because the fix is to check that the stub wrote, not to write it more carefully.

### The preamble was the worst of it
`02e` §B.0 opened by stating that *"the repository holds no application code"* and *"no test has ever run here"*, and described a fake adapter whose `setVolumePct` took a `rampMs` the interface no longer has. All three were true when written and had been false for fifteen rounds.

**A test plan behind its suite is worse than none.** It reads as the contract, so a builder follows it and writes against a harness that is not there. Regenerated against the repository: two runners and why they are separate, and the four fakes with what each one refuses to pretend.

The rule that section now ends on is the one `R25-F1` cost four hours to learn: **a fake written alongside its subject encodes the subject's assumptions**, so where a fake cannot avoid that, something else has to check it against the world. That is what §B.2's three registry-binding tests and Part C's device runs are for.

### R38-F1 `CONTRADICTION`: the test plan asserted the opposite of a measurement
§B.2 said the three verbosity levels produce the **same cue count** and differ only in word totals. R22 measured **47 / 55 / 60**. The plan contradicted `worst_case.cues_by_verbosity` in the registry it is supposed to be derived from — and a test written to it would have failed against correct data, which is the worst way for a test to fail.

`limits.ad.min_useful_words` drops more windows at `concise`, and that is the entire reason `changes[C10]` writes one file per level rather than one track with a shared cue list.

### §B.1 now describes the suite that exists
**133 tests across 15 files**, each entry naming its file and the assertions that carry weight, with a `Fails if:` on every parity or negative assertion. The ones worth having written down: the nesting property `C8` relies on, `part_index`/`part_count` separating a middle window from a film boundary, window-key joins in both `C8` and `C10`, `failed` cues written rather than dropped, the window measured in time rather than in count, and a stall being a state playback can leave.

### Part C, and three criteria that cannot close here
`C.2` (audible ducking), `C.7` (VoiceView) and the new `C.9` (the memory bound) are marked **hardware only**, each with the measurement that makes it so — no audio capture path off the Virtual Device, `limits.vega_media.voiceview_not_enablable`, and a 20-second clip that can never exercise eviction. Added `C.10` for `AC24`, where the line to watch is `INTERSTICE.player.resumed from=stalled` — instrumentation added in R29 precisely because a state change nobody can observe is a state change nobody can verify.

Also corrected: Part C still offered Fire OS *"if `D3` died"*, and `C.5` still referenced the `hardCeilingWords` clamp that R9 removed.

### The coverage map
Repointed at the phases that moved in R22's splits (`02b` → `02b2`, `02c` → `02c2`), and given rows for `D5`, `D6`, the content-window bound, `AC23` and `AC24`.

**Edits:** `02e` §B.0, §B.1, §B.2, Part C and the coverage map, all regenerated.
**Validation:** `npm test` exit 0 · `audit.py` clean.
**Still open:** the Bedrock use-case form · `AC20` **10-16** · `AC5`, `AC15`, `AC23` hardware-only.
**Next mode:** `03-stakeholder-requirements.md`, untouched since R8 and describing an ask built on a platform nobody had measured.

---

## R39 · 2026-09-26 · claude-opus-5 (Claude Code) · doc 03, and five claims that no longer matched the system
**Read:** `_facts.yml` (v17) · `_log.md` (through R38 end) · `03-stakeholder-requirements.md`
**Log read through:** R38
**About to do:** regenerate `03`. Untouched since R8, so it describes the system as it was imagined before the platform was measured: `defects[D1]` as an open hypothesis, frames "per gap" rather than per cue, a Bedrock call that this account cannot make, a 200 ms duck ramp the platform does not have, and Polly output in a container the device cannot play. §A.6 is the table that says *how each claim is checked* — it is exactly where a false claim costs credibility with the people scoring it.
### Five wrong claims, in the document whose job is to state claims that can be checked
`03` had not been touched since R8, so it described the system as it was **imagined before the platform was measured**. §A.6 is the table headed *how each claim is checked* — which makes it the one place in the set where a false claim costs credibility with the people scoring it.

- **`defects[D1]` was described as an open hypothesis.** It is resolved **false**: no frame accessor, rendering to a native surface, so `changes[C11]` is not merely deferred but **unsatisfiable on this platform**. `AC9` now says so rather than quietly disappearing, since a criterion that vanishes between plan and submission is the thing a careful reader notices.
- **Frames were "per gap".** Per **cue** — the demo asset's longest gap ran 167 seconds, and three frames for that is three frames for a minute and a half of film. §A.2 now carries the cue split *and* the content windows, because both came from running the code against a real film rather than from designing it.
- **"The three track files have the same cue count."** They do not: **47 / 55 / 60**. That sentence contradicted `worst_case.cues_by_verbosity` in the registry it was derived from — the **same error** §B.2 of `02e` carried, found yesterday and found again here. Two documents, one wrong belief, written on the same day and corrected a round apart.
- **The duck was a "200 ms platform ramp".** The platform setter is instantaneous and offers no ramp; the fade is ours, in JavaScript, in one module.
- **Polly's output was described as finished.** It is repackaged into fragmented MP4 — an MP3 cannot be appended to a `SourceBuffer`, and the device's player fetches nothing itself.

### Added, because a panel would find them anyway
`defects[D4]` and its cause, stated plainly in §A.4 next to the endpoint that does not answer: five measurements, three account states, two code paths, and a prerequisite no error message ever named. The three criteria that close on **physical hardware only**, each with the measurement that makes it so rather than a cautious hedge. `AC23` and `AC24` in the §A.6 table. And a checklist item the panel can actually run: **no cue lands on the credits, and the post-credits scene IS described** — that asymmetry is the finding, and it is checkable against the emitted track in one pass.

### R39-F1: a registry key superseded by a contract
`env_vars` still listed `DEMO_ASSET_PATH` and `DEMO_SUBTITLES_PATH`. `contracts.asset_manifest` names the media, the subtitles, the measured `content_windows` and the segments — so two variables pointing at halves of a file that describes both are a second source of truth for the same facts. Replaced by `DEMO_ASSET_MANIFEST`.

The first attempt recorded the reasoning as a new top-level `env_vars_note:` key, and `audit.py` check 19 rejected it: keys not in the template mean either the template is wrong or an edit reparented something. It was right — the reasoning is a comment, not a fact. Moved.

**Edits:** `03-stakeholder-requirements.md` (§A.2, §A.4, §A.5, §A.6, §B.2, §B.7, Annex A, changelog) · `_facts.yml` (`env_vars`, revision v18).
**Validation:** `npm test` exit 0 · `audit.py` clean.
**Still open:** the Bedrock use-case form · `AC20` **10-16** · `AC5`, `AC15`, `AC23` hardware-only.
**Next mode:** with `01`, `02`…`02e` and `03` all regenerated against measurement, the spec set and the repository finally describe the same system. What is left is `C9` behind the form, and the three deliverables that are not code: `C12`, `C13`, `C14`.

---

## R40 · 2026-09-27 · claude-opus-5 (Claude Code) · the measured effort span, and a convention I let decay
**Read:** `_facts.yml` (1872 lines, blob 5bd82e9) · `_log.md` (through R39 end) · `docs/features/_profile.yml` (67 lines, blob 1ab556a) — and every document in the set version-checked with `wc -l` and `git hash-object`, because R40-F1 below is about exactly that: `01-master-plan.md` (316 lines, blob 8c6f68d) · `02-implementation-and-e2e.md` (470 lines, blob 99aedfb) · `02b-pipeline-model.md` (449 lines, blob 2d43547) · `02b2-track-output.md` (261 lines, blob 8204ffa) · `02c-app-playback.md` (448 lines, blob 1868b5c) · `02c2-audio-and-controls.md` (256 lines, blob 65d3308) · `02d-screens-and-delivery.md` (411 lines, blob 20f511d) · `02e-tests-and-done.md` (284 lines, blob addf59e) · `03-stakeholder-requirements.md` (268 lines, blob 6ba4403)
**Log read through:** R39
**About to do:** record what the build actually cost, measured rather than estimated. Git timestamps say when work LANDED, not how long it took, and in this project that gap is large: rounds R1-R8 produced the whole registry, doc 01 and the five files of doc 02, and landed in ONE commit. Recording the span as a floor with the undercount stated, not as "hours invested".
### Recorded
`dates.effort`, `basis: measured`: **6 h 24 min of span across 6 sessions and 31 commits**, 39 rounds over 5 working days inside an 8-day window. The command that produces it is in `evidence.cmd`.

**It is recorded as a floor, and the note says why.** Git timestamps say when work LANDED, not how long it took, and here the gap is enormous: rounds R1–R8 produced the registry, doc 01, the gap sweep, the review dispositions and the five files of doc 02 — roughly 1500 lines of specification written across 09-19 to 09-21 — and **all of it landed in one commit** on 09-22 at 13:45. Eight rounds, zero visible minutes. Work before the first commit of every other session is invisible for the same reason.

So the per-round average this implies — about 10 minutes over the 31 rounds git can see — is meaningless, and is deliberately **not** stored as a field. An hours-invested figure would be `basis: asserted` with no falsifier, in a registry whose entire contract is that a claim states how it was established. The owner knows how long they sat down; this file only knows when code landed.

### R40-F1, found by the audit the moment this round opened its stub
**I stopped recording `(<n> lines, blob <sha7>)` in log entries around R13.** The early rounds do it — R13's entry names `_facts.yml (1070 lines, blob 2f56b5c)`. Every round since has named files without their version, so **check 16 could not verify which version any of them worked against**, which is the whole reason the convention exists.

The check fired against stale recorded values (`02b` at 551 lines when it is now 449, after the R22 split) and against files named with no version at all. It was right on both counts, and the finding is mine: a convention I followed while it was fresh and let go once the rounds got long.

The version chain is repaired on this round's **Read:** line above, in the inline form the check parses — the table I first wrote was not.

**Worth adding to the skill feedback already written:** the check works and caught a real lapse, but it only fires once a round's stub exists — so a convention can decay for twenty-five rounds before anything says so. A per-round reminder in `references/handoff.md`'s entry template would have cost nothing.

### R40-F2, and this one was hiding behind R40-F1: all six defects carried an undefined status
Every `defects[].status` said `resolved`. **That word is not in the vocabulary** — it is `open | fixed | dead`, and the check's own remediation says why it matters: *"nothing depending on this entry is revisited while the word is unknown."* Six hypotheses, from the very first round, in a state no consumer of this registry could interpret.

It only surfaced once the check-16 findings above were cleared, which is worth noting on its own: **a noisy check masked a substantive one.**

Mapped onto the real vocabulary by what each claim turned out to be:

| | claim | outcome | status |
|---|---|---|---|
| `D1` | the rendered frame can be read from JS | refuted | `dead` |
| `D5` | the Virtual Device may not decode video | refuted | `dead` |
| `D2` | a second stream plays while the main track ducks | confirmed | `fixed` |
| `D3` | the simulator installs, runs and plays the asset | confirmed | `fixed` |
| `D6` | an `AudioPlayer` takes an audio-only `SourceBuffer` | confirmed | `fixed` |
| `D4` | Bedrock refuses every call on this account | confirmed, **not repaired** | `open` |

`D4` is the honest one: the cause is found, the fix has not landed, and `open` is what says so. Setting it to anything else would have been the registry agreeing with a feeling rather than a state.

The first pass of this mapping put `D3` on `dead`, and check 14 immediately raised a `CONTRADICTION`: `alternatives[A4]` was discarded *because* `D3` held, so a `dead` premise voids the discard. `dead` means the concern was never real; `D3`'s concern was real and is now settled. Corrected to `fixed`, and the contradiction cleared — the check reasoned about my error better than I did.

### Two more, found in the same sweep
- **`02` Phase 3 still showed `"byte_index": null`** in its JSON example of `contracts.asset_manifest`. R34 replaced that field with `segments` everywhere else. Check 3 caught it as a key-set diff against the contract.
- **`_log.md:51` (`R2`) has no `Log read through:` line** and will keep reporting. Left alone deliberately: `references/handoff.md` forbids editing a previous entry, and R2 was written by another agent. The information is in fact there — its `Read:` line says *"through R1 end"* — just not in the field the check parses. That is a skill-feedback item, not a registry repair.

### And the audit points at a section that does not exist
The `_log.md` size POLISH says to *"rotate, never summarize: `references/handoff.md` §Rotating the log"*. **That section is not in the skill** — neither the heading nor the word "rotat" appears anywhere in it. So the log is 1167 lines, the check knows that is too long, and the remediation it names cannot be followed. Added to the skill feedback written this session, where item 11 had guessed at this and can now state it.

**Edits:** `_facts.yml` (1872 lines, blob 5bd82e9 — `dates.effort` new; all six `defects[].status` mapped onto `open | fixed | dead`) · `02-implementation-and-e2e.md` (470 lines, blob 99aedfb — the stale `byte_index` JSON fence).
**Validation:** `audit.py` → clean, after this entry repaired the version chain.
**Still open:** the Bedrock use-case form · `AC20` **10-16** · `AC5`, `AC15`, `AC23` hardware-only.
**Next mode:** `C12`, the open-source package — a prompt for a cold instance is written.

---

## R41 · 2026-09-27 · claude-opus-5 (Claude Code) · the effort figure in the timebox, and what the timebox now gets wrong
**Read:** `_facts.yml` (1872 lines, blob 5bd82e9) · `_log.md` (through R40 end) · `01-master-plan.md` (316 lines, blob 8c6f68d)
**Log read through:** R40
**About to do:** R40 recorded `dates.effort` in the registry but never put it where it was asked for — the timebox in `01` §3.2. Adding it there, and with it the divergence the table has accumulated: phase 2 (the app) is complete two weeks before it opens, phase 1 (the pipeline) is blocked on `defects[D4]`, and phase 3 is about to start early. A schedule that still reads as planned when the work has reordered is the kind of document people stop checking.
**Findings:** the effort figure belonged in two places and only reached one. Beyond that, reading the phase table against the work showed it has stopped describing the project: phase 2 (`C1`..`C6`, the app) is **done two weeks before it opens**, phase 1 (`C7`..`C10` plus the track) is **blocked and not late** — the code is built and tested, the track needs `C9`, `C9` needs Bedrock, Bedrock needs the use-case form in `defects[D4]` — and phase 3 (`C12`) is being pulled forward because of both. One consequence had gone unnoticed: §3.2 made `C15`/`C16` conditional on phase 1 closing green **before 09-30**, and that condition now cannot be met, so the deferral holds on a reason the document never stated.
**Edits:** `01-master-plan.md` (333 lines, blob c95e6de — §3.2 now carries `dates.effort` as **6h24m across 6 sessions / 31 commits / 39 rounds / 5 working days**, stated as a floor with the R1–R8 one-commit undercount named, plus a planned-vs-actual row per phase and the `C15`/`C16` consequence).
**Validation:** `audit.py` → `0 contradictions`. The figure is quoted from `_facts.yml dates.effort`, so check 4 has something to cross-refer to; the prose says *floor*, not *hours invested*, because git timestamps measure landing and not work.
**Still open:** the Bedrock use-case form · `AC20` **10-16** · `AC5`, `AC15`, `AC23` hardware-only · `AC16` sourced impact figure · `AC19` gap visualisation.
**Next mode:** `C12`, and the decision it waits on — does the hackathon app consume the published package or keep copies.

---

## R42 · 2026-09-27 · claude-opus-5-5 (Claude Code) · rotate
**Read:** `_log.md` (1206 lines, blob aadf719 — the version at HEAD, R1–R41, before this entry) · `_facts.yml` (1872 lines, blob 5bd82e9) · `01-master-plan.md` (333 lines, blob c95e6de) · `02-implementation-and-e2e.md` (470 lines, blob 99aedfb) · `02b-pipeline-model.md` (449 lines, blob 2d43547) · `02b2-track-output.md` (261 lines, blob 8204ffa) · `02c-app-playback.md` (448 lines, blob 1868b5c) · `02c2-audio-and-controls.md` (256 lines, blob 65d3308) · `02d-screens-and-delivery.md` (411 lines, blob 20f511d) · `02e-tests-and-done.md` (284 lines, blob addf59e) · `03-stakeholder-requirements.md` (268 lines, blob 6ba4403) · `docs/features/_profile.yml` (67 lines, blob 1ab556a)
**Log read through:** R41
**About to do:** rotate per `references/handoff.md` §Rotating the log (skill v1.12.0). Move R1–R36 verbatim to `_log-R1-R36.md`, keep R37–R41 here, and record every set file's version as the new baseline. Clears the two log findings: `R2` lacking `Log read through:` (unfixable in place — a previous entry is never edited) and the 1206-line size.
**Stage:** reviewed → reviewed — carried, not a transition. The last real one (`draft → reviewed`, R7) is now in the archive, and the audit reads `Stage:` from `_log.md` only.
**Archived:** `_log-R1-R36.md` (1040 lines, blob 5c60165) — R1–R36, verbatim. Verified before writing: header + archived rounds + kept rounds reassemble the pre-rotation file byte for byte. R37–R41 stay here as recent context.
**Baseline:** the `Read:` line above is the version of every file in `docs[]`, the registry and the profile at rotation time. Audit check 16 compares against it from now on; none of them was edited this round.
**Carried open:** as R41 recorded it, which is the set's own latest statement —
- `defects[D4]` — the Bedrock use-case form is not filled out; blocks `C9`, so the track, so phase 1.
- `AC20` — 10-16 still open.
- `AC5`, `AC15`, `AC23` — need hardware; cannot close on the Virtual Device.
- `AC16` — needs a sourced impact figure.
- `AC19` — gap visualisation not built.
- **Not re-judged here:** a keyword sweep of the archive finds 45 finding ids (`R<n>-F<m>`) with no line holding `confirmed` / `rejected` / `deferred` / `superseded`. Most read as settled inline — an edit that landed, a status that moved — rather than dispositioned by name. This round rotates and does not re-litigate them; a round that needs one reads it in the archive.
**Edits:** `_log.md` (rotated: header + R37–R42) · `_log-R1-R36.md` (new, 1040 lines, blob 5c60165). No registry or doc edit.
**Validation:** `audit.py` (skill v1.12.0) → clean, 0 findings; 23 candidates unchanged. Before rotating: 1 DRIFT (`R2`) + 1 POLISH (size). The first post-rotation run raised 2 DRIFT the procedure had not anticipated — the archive named in `Edits:` without a version, and the `Stage:` line gone with R7 — both fixed in this entry; the skill's §Rotating the log is being amended to say so.
**Still open:** unchanged from R41.

---

## R43 · 2026-09-27 · claude-opus-5-5 (Claude Code) · verify
**Read:** `_facts.yml` (1872 lines, blob 5bd82e9) · `_log.md` (193 lines, blob 622f373 — through R42 end)
**Log read through:** R42
**About to do:** record two code rounds that landed without an entry — `b7e01e8` (the stop() dip) and `d01b432` (six playback defects), both found through `changes[C12]`'s package and its `example/vega` on the Virtual Device — and bring the registry back in line with what that device run measured: `limits.mse_buffer.built` claims the 20 s clip never evicts, and it does; `limits.vega_media.no_range_requests` is cited and never defined; three new platform facts; `tests_baseline`.

### R43-F1 `FUNCTIONAL`: the film dipped to 25% on every stall and every switch-off
`DescriptionAudio.stop()` ramped from the duck level back to 100% whether or not a cue was speaking, and a ramp's first step SETS the volume. `PlayerScreen` calls `stop()` on every stall and on toggle-off — and `limits.vega_media.waiting_fires_at_start` puts a stall at the start of every playback. Only audible on hardware, and no test asserted on the volumes `stop()` writes. Found by the extracted package's own suite (`changes[C12]`), where it was fixed first. **Fixed** in `b7e01e8`, with a `PlayerScreen` test that is red without it.

### R43-F2 `FUNCTIONAL`: six defects that only a device could show
Running `changes[C12]`'s `example/vega` on the Virtual Device — the same adapter, scheduler and fade as this app — produced a log no mock could have. **All fixed** in `d01b432` and ported from the package, each with a test that is red on the code before it:
- **A loop at the end of the film** — `limits.vega_media.sourceopen_refires`: evicting after `endOfStream()` reopens the source and fires `sourceopen` again; the handler rebuilt the `SourceBuffer` and re-appended the asset, which evicted, which reopened.
- **Fades of ~510 ms instead of 200** — `limits.vega_media.coarse_timers` — which put three of four cue restores outside their window (`AC4`).
- **An interrupted cue's player never torn down** — `limits.vega_media.paused_never_ends`.
- **The restore held ~120 ms for `deinitialize()`.**
- **`positionMs()` NaN before media**, reaching the scheduler as `resync(NaN)`.
- **A cue reached late in its window spoke into the next scene** (`AC4`): switched back on 2.5 s before its window closed, a 2.6 s cue. `CueScheduler` now skips it with `reason=late` when the window cannot hold it.

Verified on the Virtual Device after the port, with this app: one eviction and done at the clip's end; probe cue fade 0.29 s, restore 0.23 s, 1 ms from `ended` to `spoke`.

### R43-F3 `CONTRADICTION`: the registry said the demo clip never evicts
`limits.mse_buffer.built` (R35): *"a 20-second clip with a 30-second window never evicts anything"*. It evicts at 19.94 s, once the playhead is `behind_s` past the end of segment 0 — which is exactly when F2's loop started, and why nobody saw it: the claim said there was nothing to watch. **Corrected** beside the original, per `references/evidence.md`, not over it. `AC23` is unchanged: the memory bound over a feature-length asset still needs hardware.

### R43-F4 `DRIFT`: a limit cited for nine rounds and never defined
`limits.vega_media.no_range_requests` has been cited by `limits.mse_buffer.segment_note` and `changes[C26]` since R34, and did not exist. Defined now from R34's own beacon line. `audit.py` does not report a dangling `limits.*` reference — worth a check, since this is the second registry-vs-reality gap found by reading rather than by the script (R36 was the first).

### R43-F3, followed through: what the correction touches
`audit.py` check 36 lists 17 citations of the corrected `limits.mse_buffer`. Read against `correction:`: **two** rested on the false claim and are fixed in place — `02e` Part C `C.9` and `03` §A.6 (the judging document, where a wrong claim is the expensive kind). The other **15** cite it for whole segments, the time-measured window or the stall branch, and are right as they stand.

**Edits:** `_facts.yml` (1915 lines, blob adb5616 — revision v19; `limits.mse_buffer` correction; `limits.vega_media` .no_range_requests, .sourceopen_refires, .coarse_timers, .paused_never_ends; `tests_baseline`) · code in `b7e01e8` and `d01b432` (`src/ad/DescriptionAudio.ts`, `src/ad/CueScheduler.ts`, `src/ad/duck.ts`, `src/platform/vega/index.tsx`, `src/platform/vega/SegmentBuffer.ts`, `test/PlayerScreen.spec.tsx`, `test/CueScheduler.spec.ts`, `test/vegaAdapter.spec.tsx` new, `test/mocks/w3cmedia.tsx`) · `02e-tests-and-done.md` (284 lines, blob 6b8d022 — Part C `C.9`) · `03-stakeholder-requirements.md` (268 lines, blob a17daae — §A.6, the `AC23` sentence) · R42's rotation committed as it stood (`b2e6258`), after `audit.py` ran clean on it.
**Validation:** `npm test` exit 0 — jest **72**, vitest 70 · `npm run lint` exit 0 · `npm run build:release` exit 0 and a Virtual Device run to the end of the clip · `audit.py` below.
**Still open:** the Bedrock use-case form · `AC20` **10-16** · `AC5`, `AC15`, `AC23` hardware-only · `AC16` · `AC19` · `changes[C12]` not yet published to npm, so the app still carries its own copies of the code the package fixed first.
**Next mode:** `C12` — publish, then the app consumes the package instead of the copies this round had to patch twice.

---

## R44 · 2026-09-27 · claude-opus-5-5 (Claude Code) · implement
**Read:** `_facts.yml` (1915 lines, blob adb5616) · `_log.md` (228 lines, blob 2d6da98 — through R43 end)
**Log read through:** R43
**About to do:** `changes[C12]` is published — `react-native-tv-audio-description@0.1.0` on npm, tag `v0.1.0`, `gitHead` matching. Make the app CONSUME it instead of carrying copies of the code it was extracted from: `src/ad/*`, `src/platform/MediaAdapter.ts` and `src/platform/vega/*` go; the app imports the package and hands it its `INTERSTICE.` logger. The decision taken at the start of C12 (2026-09-27) was consume, not copy — R43 had to patch the same six defects twice, which is the cost of copies stated as a measurement. Then mark `C12.built` and advance `AC10`.

### Built: the app consumes its own package
`react-native-tv-audio-description@0.1.0` is on npm with tag `v0.1.0`; the published `gitHead` (`86d9ad6`) is the tag's commit, so what the registry cites is what anyone installs. Before publishing, the package gained versioning: a Keep a Changelog `CHANGELOG.md`, and a `prepublishOnly` that refuses unless the version has a dated section, the tree is clean and HEAD carries `v<version>`.

The app now installs it from npm (`^0.1.0`) and deletes its copies: `src/ad/*` (`changes[C3]`–`[C6]`, `[C21]`) and `src/platform/*` (`[C18]`–`[C20]`), with the four suites that tested them — those tests live in the package and run there. `PlayerScreen`, `App` and `test/fakes/adapter.tsx` import the package; `App` hands it ``setLogger(line => log(`INTERSTICE.${line}`))``, so every `INTERSTICE.*` line the manual E2E reads still arrives, from the package, over the same beacon. `seam.test.ts` now guards the import of the package's `/vega` entry.

**Verified on the Virtual Device** with the npm build: title chosen, 4 segments appended, the spurious startup stall left (`resumed from=stalled`), the probe cue ducked and restored, one eviction at the clip's end and done — the same trace as before, with the package's lines under the app's prefix.

### R44-F1 `FUNCTIONAL`: the package cannot be loaded under Node
Its entry point exports `ADControls`, which loads React Native, which does not run under Node — so a track PRODUCER (this repo's own pipeline) cannot import the validator or the word budget from it. `contract-parity.test.ts` imports `lib/TrackLoader.js` by path, which checks the validator as shipped and says why in a comment; the package's own Node example imports its source modules directly for the same reason. **Deferred** to the package's next minor: a React-Native-free entry (`/core`) for producers.

### R44-F2: jest 72 → 24, on purpose
48 tests left with the code they test. A falling count reads as lost coverage unless it says where the tests went; `tests_baseline` says it.

**Edits:** `_facts.yml` (1927 lines, blob 422b42b — revision v20; `changes[C3]`–`[C6]`, `[C18]`–`[C21]` now `where: external` at the package; `changes[C12].built`; `acceptance[AC10]` `written → executed` with evidence; `tests_baseline`) · `02d-screens-and-delivery.md` (413 lines, blob 2109ed6 — Phase 14, built and consumed) · `package.json`, `package-lock.json` (the dependency) · `src/App.tsx`, `src/screens/PlayerScreen.tsx`, `test/fakes/adapter.tsx`, `pipeline/__tests__/seam.test.ts`, `pipeline/__tests__/contract-parity.test.ts` · deleted `src/ad/`, `src/platform/`, `test/{CueScheduler,TrackLoader}.spec.ts`, `test/{ADControls,vegaAdapter}.spec.tsx` · `README.md` (links the package; its Status no longer calls done work in progress).
**Validation:** `npm test` exit 0 — jest **24**, vitest 70 · `npm run lint` exit 0 (11 warnings, down from 18, none new) · `npm run build:release` exit 0 and the Virtual Device run above · `audit.py` below.
**Still open:** the Bedrock use-case form · `AC20` **10-16** · `AC5`, `AC15`, `AC23` hardware-only · `AC16` · `AC19` · R44-F1, the package's Node entry.
**Next mode:** `C13`/`C14` — the friction log and the submission, now that the three deliverables that are code exist; the R43 device findings are friction-log material.

---

## R45 · 2026-10-04 · claude-fable-5-1 (Claude Code) · handoff from the e2e-harness set
**Read:** `_facts.yml` (1927 lines, blob 422b42b) · `_log.md` (253 lines, blob 61ff333 — through R44 end) · `02e-tests-and-done.md` (284 lines, blob 6b8d022)
**Log read through:** R44
**What this is:** a sibling set, `docs/features/e2e-harness/`, was written and its spike gate run on the Virtual Device today. It changes four files this set owns and found things in this set's app. Both are recorded here so they are not only in another set's log.
**Edits:** `_facts.yml` (1929 lines, blob 02842d2) — one entry added, `changes[C28]` `src/e2e.ts`, because `scope.test.ts` fails on any source file with no entry · `02e-tests-and-done.md` (284 lines, blob cb0a84a) — one sentence in §B.2 citing it. Nothing else in this set was touched.
**Files of this set changed by that one:** `src/App.tsx` (`C1`: a build-mode line at module load, and — only in a build made with `INTERSTICE_E2E` set — a second title served from a test host) · `babel.config.js` and `metro.config.js` (the flag, and the cache version that keeps it out of the Release package). `src/diagnostics.ts` (`C22`) and `src/screens/PlayerScreen.tsx` (`C2`) are next.
**Findings for this set to disposition — none is fixed:**
- R45-F1 `FUNCTIONAL` `acceptance[AC6]`: **the app has no seek.** Nothing in `src/` or in the package sets the playhead; the adapter listens for `seeked` and nothing causes one. `02e` Part C §C.4 cannot be walked as written.
- R45-F2 `FUNCTIONAL` `acceptance[AC8]`: `PlayerScreen` starts in `{kind: 'missing'}`, so *"No description track was found"* is announced **before the loader has looked** — measured on the device, `controls.announce kind=missing` 2–16 ms ahead of `loader.miss` on three launches. On a title that has a track it will say that and then the opposite.
- R45-F3 `FUNCTIONAL` `acceptance[AC8]`, `[AC2]`: the first screenshots of this app show **no visible sentence in the missing-track state** (the package's controls are unstyled; default text colour on black) and **no focus indicator on the title list**.
- R45-F4 `CONTRADICTION` `limits.vega_media.concurrent_streams`, `.input_injection`: both say there is no screenshot and no audio capture path off the Virtual Device. Through the emulator's gRPC interface there is: 1920x1080 frames, and a 12 s clip with `mean_volume -14.4 dB`. Evidence on `docs/features/e2e-harness/_facts.yml` defects D1 and D3. To be corrected beside the originals, per `references/evidence.md`; `AC5`'s "hardware only" rests on it.
- R45-F5 `DRIFT`: `_profile.yml commands.tests_expect` reads "63 passed, 63 total"; jest reports 24 since R44.
**Validation:** `npm test` exit 0 — jest 24, vitest 70 · `npm run lint` exit 0.
**Still open:** as R44, plus the five above.

---

## R46 · 2026-10-04 · claude-fable-5-1 (Claude Code) · handoff from the e2e-harness set
**Read:** `_facts.yml` (1929 lines, blob 02842d2) · `_log.md` (through R45 end)
**Log read through:** R45
**What this is:** the harness of `docs/features/e2e-harness/` is built and ran both of its suites against this app on the Virtual Device. This entry carries what it found here. Nothing in this set's registry or documents was edited this round. The shared profile was: `docs/features/_profile.yml` (73 lines, blob 526f7e4) — `commands.tests_expect` re-measured to the jest line it has printed since R44 (R45-F5 → **confirmed**, fixed), and three `e2e_*` commands added.
**Files of this set changed by that one:** `src/diagnostics.ts` (`C22`: every line now carries a launch id, a sequence number and the device clock) · `src/screens/PlayerScreen.tsx` (`C2`: three new lines — `player.progress` once a second, `overlay.shown`/`overlay.cleared` with the spoken sentence, `ad.state`) · `tools/beacon-server.mjs` prints the two new fields. `npm test` exit 0 with them.
**Findings for this set to disposition — none is fixed:**
- R46-F1 `FUNCTIONAL` `acceptance[AC2]`: **after BACK the same title cannot be opened again.** The second open stops after `player.surface created handle=2`: no append, no `player.opened`, no error, for 20 s. Five of five on the device. One adapter is created at module scope in `src/App.tsx` and reused after `destroy()`. Evidence: `docs/features/e2e-harness/_facts.yml` defects D8, and scenario S04 in `docs/e2e/`.
- R46-F2 `FUNCTIONAL` `acceptance[AC8]`: **a corrupt track file is announced as missing.** `readJson` in `src/App.tsx` throws on a parse failure exactly as on a 404, and the loader reads every throw as absence. `02e` Part C §C.6 expects "a different stated message" for a truncated file; it gets the same one. Evidence: defects D9 there, scenario S13.
- **Shown working on a device for the first time**, which this set had only as unit tests: `AC24` — a mid-film stall is announced and playback resumes when the bytes arrive (S15) · `AC5`'s failure branch — a cue whose audio cannot be fetched still returns the film to full (S14) · `AC3` (S11) · `AC17` with its fallback (S12) · `AC4`'s scheduler half, three cues each inside its window (S10). All on a FIXTURE track, labelled as such; none of it speaks to the generated track, which still waits on `defects[D4]`.
- R45-F1..F5 stand as written.
**Edits:** `docs/features/_profile.yml` (73 lines, blob 526f7e4) — the shared profile, as described above. No file of this set.
**Validation:** `npm test` exit 0 — jest 24, vitest 116 · `npm run lint` exit 0.
**Still open:** as R45, plus R46-F1 and R46-F2.

---

## R47-W3 · 2026-10-18 · claude-fable-5-1 (Claude Code, worker 3 of 4) · implement
**Read:** `docs/features/interstice/_facts.yml` (1929 lines, blob 02842d2) · `docs/features/interstice/_log.md` (286 lines, blob 60d9f79 — through R46 end) · `docs/features/interstice/02d-screens-and-delivery.md` (413 lines, blob 2109ed6) · `docs/features/interstice/03-stakeholder-requirements.md` (268 lines, blob a17daae) · `docs/features/interstice/02e-tests-and-done.md` (284 lines, blob cb0a84a) · `docs/features/_profile.yml` (73 lines, blob 526f7e4) · `FRICTION-LOG.md` (156 lines, blob 3d6cc94) · `README.md` (188 lines, blob 46ed786)
**Log read through:** R46
**About to do:** the submission documents, no code and no device. `changes[C13]` close-out: a severity scale and a `severity:` line on every `FRICTION-LOG.md` entry, steps where an entry lacks them, and the 2026-10-18 Bedrock fact — every existing date and word of evidence left as written. `changes[C14]`: `SUBMISSION.md`, the Devpost field checklist with paste-ready text, product feedback per tool, the video script per `02d` Phase 16.6, and the Tears of Steel attribution. `README.md` truth pass outside the "Run the pipeline" block (worker 2's). Registry: `limits.hackathon` gains the rules re-read of 2026-10-18 (friction-log entry shape with severity, product feedback required, the CC-footage FAQ, credits exhausted, office hours #2); `changes[C13]`/`[C14]` `built:`; `acceptance[AC11]`, `[AC13]`, `[AC16]`, `[AC20]` attempts and `[AC12]` left `written` with the video URL placeholder. One of four parallel workers: this entry is the only one this worker appends, and nothing it does not own is touched.
**Dispositions:** none owed — R45-F1..F5 and R46-F1/F2 are device findings that belong to the worker on the app; they stand as written and the README Status names the two from R46 as open at the time of writing.

### Built: the friction log is closed, the submission is drafted, the README says what is true
- **`changes[C13]` closed.** The rules page re-read on 2026-10-18 names a shape the file lacked: *severity rating* and *steps taken*. A four-level scale (Critical / High / Medium / Low, one line each) sits under the shape block, and every one of the 15 entries carries a `severity` and a `steps` line, each marked `(added 2026-10-18)`. No dated word changed — `git diff` is additions only. Measured for `AC11`: 15 entries on 4 distinct days (6× 09-22, 6× 09-25, 1× 09-26, 2× 10-04), and `git log -S` on every heading finds its first commit on the day the entry is dated. The 2026-10-18 Bedrock fact (form submitted via `PutUseCaseForModelAccess`, `Converse` unchanged five minutes later, AWS docs pointing at Sales) is an `update 2026-10-18` bullet under the 09-26 entry rather than a sixteenth entry. Count by severity: 2 Critical, 3 High, 4 Medium, 6 Low.
- **`changes[C14]` written** — `SUBMISSION.md`, 492 lines: the Devpost field checklist (15 fields, 2 not fillable today), paste-ready text per field, `[IF GENERATED TRACK LANDS]` / `[IF NOT]` forks at the three places a claim depends on worker 2's track (description, AWS Builder block, video script minute 1:10), the Open Source block with the GitHub username, product feedback on the five required questions for seven tools, nine feature requests with priority, the `AC16` figure, the `AC20` drop statement, the 3-minute script in the `02d` §16.6 order with the VoiceView and `AC20` honesty beats, and the Tears of Steel attribution.
- **`README.md` truth pass**: Status rewritten to 2026-10-18 (Bedrock refused after the form, no generated track, fixture track labelled, two R46 defects open at time of writing, VoiceView not demonstrated, `AC20` dropped, live capture impossible) with the sentence to flip on 10-22 left as an HTML comment; a *Built with* section naming the track tools first; the verification link now carries `docs/e2e/index.html` beside it; the measured table corrected from the pre-clipping figures (38 gaps, 577.0 s, 78.6%) to the operative ones in `worst_case` (39 gaps, 47/55/60 cues, 451.8 s, 74.2% of content / 61.5% of asset) — the README had been citing a number the registry retired in R20. The "Run the pipeline" block is untouched (worker 2).
- **`AC16` entered the registry before the prose**: ADP Webmaster Report 2025, 13,109 described titles at year-end 2025, +24%, read through the text proxy with the command recorded; a secondary 2021 Netflix-UK percentage kept beside it; a "7%" blog figure attributed to ACB could not be found on ACB's site and is not used.
- **`AC20` retired** on `decisions.user_validation`'s own rule — nobody confirmed by 10-16 — with `retired_on`, `retired_because` and the attempt. `AC12`/`AC13` carry `aborted_no_conditions` attempts naming what waits on 10-22.
- **`limits.hackathon.rules_reread`** records the 2026-10-18 re-read as `measured`: the rules page answers a browser user agent with 200 (it was 202 empty in R1 and is 403 through the proxy), the faqs/resources/updates pages come through the proxy; the friction-log entry shape, the required product feedback, the mini-challenge fields, the priority scale, the CC-footage FAQ, credits exhausted 10-07, office hours #2 on 10-19 09:00 PT. The 2026-10-05 tips mail is `asserted` with its source.
- **`03` §A** now says what is handed over as it is: no validation quote, VoiceView not demonstrated, the fixture-track caveat — changelog entry dated 2026-10-18.

### Findings for the coordinator — none fixed here, none in this worker's scope
- R47-W3-F1 `DRIFT` `decisions.friction_log_shape`: names `tool | expected | happened | workaround | time_lost` and 5–8 entries; the file has 15 entries and two more lines per entry on the rules' wording. `limits.hackathon.rules_reread.friction_log_entry_shape` says so; the decision text and its `cited_in` (`01` §3.1, §3.2, §7; `02e` row 280) still carry the old shape. Decision, so `sync` cannot follow it.
- R47-W3-F2 `DRIFT` `owners.external`, `tracking.blocked_by` (1), `03` §B: all describe the `AC20` participant as a live dependency. `AC20` is retired; the header is the coordinator's.
- R47-W3-F3 `POLISH` `docs[] 03` has no `regenerated_on:` and this round edited it; the `docs[]` block is not this worker's.
- R47-W3-F4: the `w3cmedia` bare anchor DRIFT (`VideoPlayer.js:225`) the audit reported at the start of this round is not in its output at the end; nothing here touched that line. Worth one look.
- R47-W3-F5 for the e2e set / worker 1: `src/assets/seg/` is gitignored derived output that `src/App.tsx` imports, so `npm test` fails on a fresh worktree until it is generated or copied (`Cannot find module './assets/seg/segments'`). This round copied it from the main checkout; the README setup section does not say so.

**Edits:** `FRICTION-LOG.md` (209 lines, blob f6d5ab3) · `SUBMISSION.md` (new, 492 lines, blob a809454) · `README.md` (239 lines, blob 6bd74fd) · `docs/features/interstice/_facts.yml` (1993 lines, blob 661650f — `limits.hackathon.rules_reread` new; `changes[C13]`, `[C14]` `built:`; `acceptance[AC11]` executed, `[AC12]`, `[AC13]` attempts, `[AC16]` executed with figure and source, `[AC20]` retired) · `docs/features/interstice/03-stakeholder-requirements.md` (272 lines, blob d4288d8 — changelog 2026-10-18, §A.2 row, §A.6 rows for `AC15` and `AC20`)
**Validation:** `npm test` exit 0 — jest 24, vitest 122 · `npm run lint` exit 0 (12 warnings, none new) · `audit.py` before this round: 1 CONTRADICTION (`_profile.yml repo:` vs the worktree name — every worktree sees it), 1 DRIFT (the bare anchor); after: the same CONTRADICTION, 0 DRIFT, 0 POLISH.
**Still open:** `AC12` the video · `AC13` the form on 10-22 · the fork in `SUBMISSION.md` · R47-W3-F1..F5 above · everything R46 left open.

---

## R47-W1 · 2026-10-18 · claude-fable-5-1 (Claude Code) · implement + verify
**Read:** `_facts.yml` (1929 lines, blob 02842d2 — by offset: `changes[C1]`/`[C2]`, `acceptance[AC2]`/`[AC8]`) · `_log.md` (286 lines, blob 60d9f79 — through R46 end) · `02e-tests-and-done.md` (284 lines, blob cb0a84a — Part C §C.6) · `docs/features/_profile.yml` (73 lines, blob 526f7e4) · `docs/features/e2e-harness/_facts.yml` (869 lines, blob d662449 — `defects[D8]`/`[D9]`, `limits.suite`) · `docs/features/e2e-harness/_log.md` (180 lines, blob 3d31133 — through R8) · `src/App.tsx` (194 lines, blob 501b1c7) · `src/screens/PlayerScreen.tsx` (310 lines, blob fdbb2ff) · `src/diagnostics.ts` (35 lines, blob d08ce6f) · `e2e/scenarios/release.ts` (115 lines, blob 3df0a23) · `e2e/scenarios/variant.ts` (198 lines, blob 97bcf1d) · `node_modules/react-native-tv-audio-description/` README, `src/vega/index.tsx`, `src/TrackLoader.ts`, `src/messages.ts` (0.1.0)
**Log read through:** R46
**About to do:** worker 1 of four parallel workers (branch `CesarRivasP/w1-device-fixes`, worktree based on `e2e-harness` at `6bf2e74`). Fix three app defects measured on the Virtual Device on 2026-10-04 — R46-F1 (`defects[D8]` of the e2e-harness set: second open after BACK hangs), R46-F2 (`[D9]`: a corrupt track announced as missing), R45-F2 (missing announced before the loader looked) — unit tests first, then `npm run e2e:release` and `npm run e2e:variant` on the Vega Virtual Device, then `npm run e2e:publish` so `docs/e2e/` reflects the fixed build. Registry edits owned by this round: `acceptance[AC2]`/`[AC8]` attempts here; `defects[D8]`/`[D9]` in the e2e-harness set (its entry R9). Nothing else in either set is touched.
**Dispositions:**
- R46-F1 `FUNCTIONAL` `acceptance[AC2]` (second open after BACK hangs) → **confirmed, fixed** in `866ccec`. Root cause read in the package source, not guessed: `VegaVideo.destroy()` deinitializes the native player and leaves `initialised` resolved, so a second `open()` on the same adapter attaches a `MediaSource` to a player that is gone and `sourceopen` never fires. The package README's contract is one adapter per screen (`useMemo(() => createVegaAdapter(), [])`); the app had one at module scope. `src/App.tsx` now creates one per open and carries it in `Playing`. Measured: S04 **pass**, `player.opened segments=4 init=yes` twice in one launch, the second 2.0 s after `player.back from=playing` (run `2026-10-18T20-10-13-786Z-release`). The package half is recorded on `docs/features/e2e-harness/_facts.yml` defects.D8 `note_ownership` for its repository; the package is unchanged here.
- R46-F2 `FUNCTIONAL` `acceptance[AC8]` (corrupt track announced as missing) → **confirmed, fixed** in `866ccec`. `readJson` throws only on a non-2xx status; a parse failure logs `INTERSTICE.app.unparseable` and returns the raw text, which the package validator rejects as `malformed`. Measured: S13 **pass**, `loader.load … ok=false reason=malformed`, `controls.announce kind=malformed`, spoken *"The description track for this title could not be read. Playback continues without description."*, `player.progress` past 5000 ms, zero `ad.state kind=missing` (run `2026-10-18T20-12-14-975Z-variant`).
- R45-F2 `FUNCTIONAL` `acceptance[AC8]` (missing announced before the loader looked) → **confirmed, fixed** in `866ccec`. `PlayerScreen` holds `ad: ADState | null` and renders the controls, announces, and emits `ad.state` only once the loader has answered. Measured: S05 **pass** with the new order assertion `loader.miss` → `controls.announce kind=missing`; the trace reads `overlay.shown status=loading`, `loader.miss`, `controls.announce kind=missing`, `ad.state kind=missing`, in that order.
- R45-F1 (no seek, `AC6`), R45-F3 (no visible focus indicator; no visible sentence in the missing-track state), R45-F4 (`limits.vega_media` correction), R45-F5 (profile `tests_expect`, already fixed in R46) → **stand as written**; not this round's scope. R45-F3 is why `AC2` and `AC8` stay `written` below.
**Edits:** `docs/features/interstice/_facts.yml` (1939 lines, blob 2727389) — `acceptance[AC2]` and `[AC8]` gain `attempts[]`: 2026-10-04 `failed` (the runs that found D8/D9/R45-F2) and 2026-10-18 `passed`, each with the scenario, run id and what the pass does and does not show; `status: written` unchanged, because the focusable-element half of `AC2` and the VISIBLE half of `AC8` are R45-F3, which no trace can settle — the flip is the owner's · `docs/features/e2e-harness/_facts.yml` (881 lines, blob e4bed8e) — `defects[D8]` and `[D9]` → `status: fixed`, each with `fixed_on`, `fixed_by`, `fixed_evidence` from today's runs, the original measurement kept beside (its entry R9) · code, three commits on `CesarRivasP/w1-device-fixes`: `866ccec` (`src/App.tsx` (234 lines, blob ac62060) · `src/screens/PlayerScreen.tsx` (322 lines, blob cd69b41) · `test/App.spec.tsx` (107 lines, blob 7c694fc) · `test/PlayerScreen.spec.tsx` (328 lines, blob 5efe2f1) · `e2e/scenarios/variant.ts` (201 lines, blob cc2fedb)), `ef103b7` (`e2e/scenarios/release.ts` (119 lines, blob 6610942) · `e2e/__tests__/traces/S04.jsonl`, `S05.jsonl` new, `S13.jsonl` new — recorded from today's green runs · `docs/e2e/` republished, `docs/e2e/index.html` (269 lines, blob 74eebd4)), and the registry/log commit this entry closes.
**Device runs, Vega Virtual Device, aarch64, OS 1.2 (TV Ship/102282480), SDK 0.24.12112, Vega CLI 1.3.4, app commit `866ccec`, package 0.1.0, capture `grpc`, keys `inputd-cli`:**
- RELEASE `2026-10-18T20-10-13-786Z-release` — `S01` `S02` `S03` `S04` `S05` **pass** (5/5, was 4/5 with `S04` failing); selftest 5/5.
- VARIANT `2026-10-18T20-12-14-975Z-variant` — `S10`–`S16` **pass** (7/7, was 6/7 with `S13` failing), `S17` blocked by the e2e-harness set's D6 (no seek, R45-F1); selftest 7/7; `restored_release: true`.
- Both suites, n=1 each today. The fixtures were rebuilt here with the host voice (`say`), Polly credentials being absent in this worktree; nothing a scenario asserts depends on which voice spoke.
**Validation:** `npm test` exit 0 — jest **30** (was 24; six new: a second open initializes a player that is not the one BACK deinitialized; `readJson` throws on 404, parses JSON, returns a non-object on a truncated body; the screen says nothing about the description until the loader answers; unparseable text is "could not be read"), vitest 124 (was 122; `S04` and `S13` recordings) · `npm run lint` exit 0, 13 warnings (one new, the `@amazon-devices/react-native-w3cmedia` system-library notice on the import `test/App.spec.tsx` needs to count players) · `audit.py` on both sets: as found — the `repo:` CONTRADICTION is the worktree's name, not the spec's; the e2e-harness set's 7 DRIFT / 4 POLISH predate this round.
**Still open:** R45-F1, R45-F3, R45-F4 · `AC2`/`AC8` `status: written` until R45-F3 is settled · `README.md` §Verification still says the report includes "the two it currently fails" — it now fails none; README is outside this worker's scope (worker 3's) · `docs/features/e2e-harness/02b2-scenarios.md` lines 294 and 422 describe `S05` as `seen`-only and `S13`'s count as 1, the pre-fix assertions; the registry (`limits.suite`) needs no change, the prose is that set's next `sync` · the package defect behind D8 (`destroy()` leaves `initialised` resolved) is for `react-native-tv-audio-description`'s repository, text on D8 `note_ownership`.

---

## R47-W2 · 2026-10-18 · claude-fable-5-1 (Claude Code, worker 2 of 4, branch `CesarRivasP/w2-describe-pipeline`) · implement
**Read:** `docs/features/interstice/_facts.yml` (1929 lines, blob 02842d2) · `docs/features/interstice/_log.md` (286 lines, blob 60d9f79 — through R46 end) · `docs/features/interstice/02b-pipeline-model.md` (449 lines, blob 2d43547) · `docs/features/interstice/02b2-track-output.md` (261 lines, blob 8204ffa) · `docs/features/interstice/02e-tests-and-done.md` (284 lines, blob cb0a84a) · `docs/features/_profile.yml` (73 lines, blob 526f7e4)
**Log read through:** R46
**About to do:** build `changes[C9]` (`pipeline/describe.ts`) behind a `DescriptionProvider` seam with two implementations (Bedrock Converse, Anthropic Messages), `pipeline/run.ts` as the orchestrator with per-stage idempotence and a `--dry-run`, the vitest suites for both, the README "Run the pipeline" block, and the registry edits this brief owns: `changes[C9]`, `changes[C10]` (built note), `acceptance[AC7]`, `defects[D4]` (the 2026-10-18 re-measurement after the use-case form), plus new `changes[]` entries for the files `scope.test.ts` would otherwise reject. Four workers edit this log concurrently; this entry is appended once, at the end, and nothing above it is touched.

### Built: C9 behind a provider seam, and the pipeline runs end to end (offline)
- `pipeline/providers/` (**new `changes[C30]`**, a directory entry): `DescriptionProvider` — frames + text in, one string out — with `BedrockConverseProvider` (Converse API, image blocks, `BEDROCK_MODEL_ID`, backoff per `limits.bedrock.on_throttle`, `Error 002` surfaced ONCE as a fatal error naming `DESCRIPTION_PROVIDER=anthropic`), `AnthropicProvider` (`@anthropic-ai/sdk` 0.135.0, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL_ID` default `claude-sonnet-5-5` — the latest Sonnet the installed SDK's `Model` type names; the brief named `claude-sonnet-4-5` "or the latest you can verify in the SDK's types"), and `FakeProvider` + `fakeSynthesize` for the dry run. `selectProvider`: `DESCRIPTION_PROVIDER=bedrock|anthropic`, default bedrock; the pipeline never switches on its own.
- `pipeline/describe.ts` (`changes[C9]`): `asData` (S2 fence), `buildCastPrompt`/`parseCast`, `buildCuePrompt` (cast, last 10 descriptions, both neighbours fenced, the `part_index`/`part_count` branches, target + ceiling, a retry paragraph), `validateDescription` (one object, one key, non-empty, ≤ ceiling — reasons `no_json`/`bad_json`/`shape`/`empty`/`over_budget`), `describeCue` (one call, ONE retry with the budget restated, then `failed`; a throttle that outlived its attempts is one failed cue, any other provider error is rethrown so a run stops rather than writing 163 failed cues), `buildDramatisPersonae`. `DescribedCueResult` extends the `DescribedCue` that `synthesize.ts` already declared, adding `attempts` and `reason`.
- `pipeline/run.ts` (**new `changes[C29]`**): C7 → C8 → C9 → C10 under `generated/<asset_id>/` (`generated/dry-run/<asset_id>/` on a dry run). Idempotent per stage — `frames/index.json`, `cache/cast.txt`, `cache/descriptions.<level>.json` (only `ok` is final; `failed` is retried next run, which is how `AC14` regenerates), an audio sidecar so an unchanged sentence is not re-synthesised. Flags: `--dry-run`, `--manifest`, `--out`, `--levels`, `--limit`, `--frames stub`. `DEMO_ASSET_MANIFEST` honoured (`env_vars`); the README's `DEMO_ASSET_PATH`/`DEMO_SUBTITLES_PATH` were R39 drift and are gone.
- Tests: `describe.test.ts` (26), `providers.test.ts` (12), `run.test.ts` (7), `contract.track.test.ts` (02e §B.2's "test that needs D4", against `generated/tears-of-steel/`, skipped visibly until a real run exists). `scope.test.ts` now reads a `file:` with a trailing slash as a directory entry. `contract-parity.test.ts` unchanged and green.

### Measured 2026-10-18 (dry run, fake provider, fake Polly)
- `npm run pipeline -- --dry-run --frames stub`: 39 gaps → **47 / 55 / 60** cues → **163** calls (the R22 figure, reproduced by running). Three track files, each `validateTrack(...).ok` against the package's `lib/TrackLoader.js`; every cue `words ≤ wordCeiling(duration)`. 14.7 s wall. Second run over the same output: **0 calls, 162 clips reused, cast reused**.
- With the real asset present (symlinked, gitignored): `C8` extracted **120 JPEGs** for the 60 windows — 21 windows × 1, 19 × 2, 20 × 3 — in 28 s; second run `extracted=0 reused=60`, 0 calls. The fake Polly's clips are fragmented mp4 (`ftyp` `M4A` + `moov` + `moof`), i.e. the `C10` container.
- `ANTHROPIC_API_KEY` was **absent** in this session, so step 5 of the brief (a real `standard`-level run, cost and counts) did **not** happen. `generated/` is also gitignored (`.gitignore:…generated/`), so committing real tracks would need an un-ignore decision the coordinator should take first.

### Findings (none fixed; for the coordinator or the next round)
- **R47-W2-F1 `DRIFT`** `02b2-track-output.md` Phase 6: its `pipeline/run.ts` listing is the pre-C29 sketch (`out/`, `DEMO_ASSET_MANIFEST!`, no cache, no `--dry-run`). Outside this worker's doc scope; `02b` Phase 5 now points at `02b2` for the orchestrator, so the two disagree until `02b2` §6 is regenerated.
- **R47-W2-F2 `FUNCTIONAL`** a fresh worktree fails `npm test` before any change: `Cannot find module './assets/seg/segments' from 'src/App.tsx'`. `.gitignore` re-includes `!src/assets/seg/segments.ts` but its parent `src/assets/seg/` is ignored, and git cannot re-include a file inside an ignored directory (`git check-ignore -v` names line 36). Worked around here by copying `src/assets/clip.mp4` and `src/assets/seg/` from the main checkout; `_profile.yml commands.tests` therefore has an unstated precondition (`pipeline/prepare.ts` must have run).
- **R47-W2-F3 `DRIFT`** `status: reviewed` while `changes[]` has had `built:` entries since R25; `mode-implement` says the first build flips it to `implementing` with a `Stage:` line. A shared field, not flipped by a parallel worker.
- **R47-W2-F4** `changes[C29]`/`[C30]` ids were taken by a parallel worker; if another worker also minted C29/C30, the coordinator renumbers at merge (an id is never recycled, so the loser moves up).
- R45-F1..F5, R46-F1, R46-F2: not this worker's scope; they stand as written.

**Edits:** `_facts.yml` (1986 lines, blob 3f312fa — `changes[C9].built`, `changes[C10].built` appended, **new** `changes[C29]`, `changes[C30]`, `acceptance[AC7].attempts[]`, `defects[D4]` evidence n 5→6 + `outcome` FALSIFIED paragraph, `env_vars` +3) · `02b-pipeline-model.md` (264 lines, blob 6cf5ef1 — Phase 5 banner, code section as built, verification, Done) · `README.md` (210 lines, blob 09c1b89 — the "Run the pipeline" block only) · `pipeline/describe.ts`, `pipeline/run.ts`, `pipeline/providers/{types,backoff,bedrock,anthropic,fake,index}.ts` (new) · `pipeline/__tests__/{describe,providers,run,contract.track}.test.ts` (new) · `pipeline/__tests__/scope.test.ts` (73 lines, blob 6ee156f) · `package.json`, `package-lock.json` (`@anthropic-ai/sdk` 0.135.0). Not touched: `02b2`, `02e`, `_profile.yml`, anything under `src/`.
**Validation:** `npm test` exit 0 — jest **24**, vitest **167** (18 files + `contract.track.test.ts` skipped) · `npm run lint` exit 0 (12 warnings, none new) · `npx tsx pipeline/run.ts --dry-run` exit 0 twice (stub frames; real frames) · `audit.py`: 1 contradiction (the pre-existing `_profile.yml repo:` vs worktree name), 0 drift once this entry records the versions above, 39 candidates — as found.
**Still open:** `D4` (AWS Sales, owner's clock) · `AC7` attempt recorded, needs a key or an unblocked account · R47-W2-F1..F4 · everything R46 listed.
**Next mode:** with `ANTHROPIC_API_KEY`: `DESCRIPTION_PROVIDER=anthropic npm run pipeline -- --levels standard --limit 5` first (cost check), then the full run; `contract.track.test.ts` un-skips itself; record cost from `INTERSTICE.run.done … input_tokens= output_tokens=`; then `AC14`.

---

## R47-W4 · 2026-10-18 · claude-fable-5-1 (Claude Code, worker 4 of 4) · implement
**Read:** `docs/features/interstice/_facts.yml` (1929 lines, blob 02842d2) · `docs/features/interstice/_log.md` (286 lines, blob 60d9f79) · `docs/features/interstice/02d-screens-and-delivery.md` (413 lines, blob 2109ed6)
**Log read through:** R46
**About to do:** `AC19` — the gap visualization of `02d` Phase 16 §16.1, rendered offline from C7 data: `tools/viz/` (model over `pipeline/gaps.ts`, SVG timeline strip, ffmpeg split-screen before/after), `npm run viz`, outputs under `docs/video/`. Registry: `changes[C14]` sub-item for AC19, `acceptance[AC19]` attempt with the files as evidence, `decisions.gap_visualization` only if the render forces a change. Three other workers edit this log and registry concurrently; this entry and the edits named here are the whole footprint of this one.

### Built: both AC19 renders, offline, from C7
`tools/viz/model.ts` runs `parseWebVtt → mergeSpeech → findGaps → clipToContent → splitIntoCues` from `pipeline/gaps.ts` over `media/tears-of-steel.en.srt` and the manifest, and also re-walks the split arithmetic to list the windows `splitIntoCues` drops silently, and the silences under `min_gap_ms` it never emits — the strip has to show what was rejected, not only what was kept. `timeline.ts` writes the strip as SVG with no dependency (1920×1080 for the video with a zoom inset at 3:25–4:55; 1200 wide for the README); `raster.ts` rasterizes with `rsvg-convert` if present, else ImageMagick with a type map written per run from the fonts on disk. `split.ts` reads the same model and emits the ffmpeg graph for the split-screen: top the film as shipped, bottom the same seconds ducked with the caption in the window, a level bar and a playhead; the command is written to `generated/viz/split/ffmpeg-command.txt` before it runs. `npm run viz` regenerates both; `tools/viz/README.md` documents it and the attribution line, which is on every frame.

**Measured while building, each of which changed the code:** ImageMagick's SVG renderer paints `<pattern>` fills black and drops the stroke on `<rect>`/`<path>` — every hatch and outline is `<line>`s. This ffmpeg 8.1 has no `drawtext` (no libfreetype) — all text is PNG overlays. It does not re-evaluate `drawbox` per frame (`w='20+80*t'` drew nothing at any t) — the level bar is a PNG that slides under an opaque shield by `(1-level)·width`, with `overlay … eval=frame`, which does. The ducking: `volumedetect` on 3:38–3:41 reads `mean_volume: -11.4 dB` in the film and `-23.5 dB` in the clip — 12.1 dB, i.e. 25% amplitude, `limits.ad.duck_target_pct` as specified. Clip at crf 24 was 4.7 MB; crf 28 is 2.9 MB, under the 3 MB commit limit, and the code leaves anything larger under `generated/`.

**Figures, computed live** (and pinned by `pipeline/__tests__/viz-model.test.ts`): 76 subtitle cues · 67 speech spans · 38 gaps · 18.6% dialogue · 78.6% silence ≥ 1.5 s, 61.5% inside the content windows · 55 cue windows at `standard` (47 `concise`, 60 `detailed`) · 30 silences rejected · 9 gaps split · 5 windows dropped.

### R47-W4-F1 `DRIFT` README "cues after splitting long gaps ~70"
The README table says `~70`; `splitIntoCues` on the real asset gives **55** at `standard` (47 / 60 at the other levels), because `min_useful_words` drops windows the R13 estimate counted. `README.md` is outside this worker's scope; the strip prints 55. For the coordinator: replace `~70` with the per-level figures, or cite the strip.

### R47-W4-F2 `POLISH` the split-screen caption is a PLACEHOLDER
No `contracts.description_track` exists for the asset (nothing under `media/` or `generated/` in any checkout), so the clip ducks the film and shows an orange PLACEHOLDER naming the window's word budget — no cue text was hand-written (AC7). `npm run viz:split -- --film <mp4>` after Worker 2's track lands beside the asset (`media/tears-of-steel.standard.track.json`) captions the real cue and mixes its clip; nothing else changes.

**Edits:** `docs/features/interstice/_facts.yml` (1952 lines, blob ddc5c78 — `changes[C14]` gains the AC19 sub-item, built; `acceptance[AC19]` gains `attempts[]` with the files as evidence, status stays `written` until the video is cut; `decisions.gap_visualization` unchanged — the render matches it) · `docs/features/interstice/02d-screens-and-delivery.md` (415 lines, blob 63e487d — §16.1, one paragraph: what was built and where) · new: `tools/viz/{model,svg,timeline,raster,split,cli}.ts`, `tools/viz/tsconfig.json`, `tools/viz/README.md`, `pipeline/__tests__/viz-model.test.ts`, `docs/video/gap-timeline-{video,readme}.{svg,png}`, `docs/video/gap-split-screen.mp4` · `package.json` (`viz`, `viz:timeline`, `viz:split`, `viz:check` — `lint` not touched, so `viz:check` is run by hand).
**Validation:** `npm test` exit 0 — jest 24, vitest 127 (5 new) · `npm run lint` exit 0 · `npm run viz:check` exit 0 · `npm run viz` end to end with `--film` pointing at the main checkout's film · `audit.py`: the one pre-existing CONTRADICTION (profile `repo:` vs this worktree's name) and nothing new.
**Still open:** as R46, plus R47-W4-F1 (README figure) and R47-W4-F2 (placeholder caption, closes when the generated track lands). `AC19` flips when `C14`'s video embeds these renders.


---

## R47-M · 2026-10-18 · claude-fable-5-1 (Claude Code, coordinator) · merge
**Read:** the four worker branches at their final commits — `CesarRivasP/w3-submission-docs` (96f7ea5), `CesarRivasP/w1-device-fixes` (99e7198), `CesarRivasP/w2-describe-pipeline` (a6c3ddc), `CesarRivasP/w4-gap-visualization` (a81c881) — each worker's closing message, and this log through R47-W4.
**Log read through:** R47-W4
**What this is:** the four parallel rounds of 2026-10-18 (R47-W1..W4, each in its own Orca worktree off `e2e-harness` 6bf2e74) merged back into `e2e-harness` in the order W3, W1, W2, W4 (`--no-ff`, merge commits c75143f, 0de1522, 3d8d0b7, 4dd51bb). Conflicts were only in this file and in `_facts.yml`, every one a two-workers-appended-at-the-same-place conflict; resolved by keeping every entry, in merge order, with no line of any worker's text changed.
**Coordinator edits between merges:**
- `README.md` §Verification and §Status no longer call the two device defects open — W1 fixed them the same day (4c4e26a).
- `README.md` §Setup: a fresh clone needs the gitignored `src/assets/clip.mp4` and `src/assets/seg/` before `npm test` or the build, and regenerating them is not one command yet (R47-W3-F5 and R47-W2-F2 → **confirmed**, documented, not fixed) (b2b9b1b).
- `decisions.friction_log_shape` gains `amended:` for the severity rating and steps the rules name (R47-W3-F1 → **confirmed, fixed**) (b2b9b1b).
- `_facts.yml` conflict resolutions: `acceptance[AC7]` keeps W2's attempt; `[AC8]` keeps W1's attempts; `[AC19]` keeps W4's block; `[AC20]` keeps W3's retirement. `changes[C29]`/`[C30]` were minted only by W2 (R47-W2-F4 → no collision).
**Dispositions still owed to a later round:** R47-W2-F1 (`02b2` Phase 6 listing is the pre-C29 sketch), R47-W2-F3 (`status: reviewed` never flipped to `implementing`), R47-W3-F2 (`owners.external`/`tracking.blocked_by` still describe the AC20 participant as live), R47-W3-F3 (`docs[] 03` has no `regenerated_on`), R47-W4-F1 (README cue count — already 47/55/60 after W3's truth pass, so **not reproducible**), R47-W4-F2 (split-screen caption is a placeholder until a generated track exists), R45-F1, R45-F3, R45-F4.
**Validation on the merged branch:** `npm test` exit 0 — jest **30**, vitest **174** · `npm run lint` exit 0 · `npm run viz:check` exit 0 · `npx tsx pipeline/run.ts --dry-run --frames stub` exit 0 (163 calls, fake provider) · `audit.py`: the two DRIFT lines it printed after the merges were this entry's missing versions.
**Edits:** `_facts.yml` (2089 lines, blob 76cc081) · `README.md` (269 lines, blob 9b6ec93) · `_log.md` (this entry).
**Still open:** `D4` Bedrock — AWS Sales / support, owner's clock · `AC7` needs a key or an unblocked account (`DESCRIPTION_PROVIDER=anthropic npm run pipeline -- --levels standard --limit 5` first) · `AC12`/`AC13` the video and the Devpost form on 10-22 · `AC14` the quality watch once a track exists · the findings above.
**Next mode:** the owner pushes `e2e-harness`, merges to `main`, enables GitHub Pages (`/docs`); then a real pipeline run, `AC14`, the video.


---

## R48 · 2026-10-18 · claude-fable-5-1 (Claude Code) · implement
**Read:** `_log.md` through R47-M · `pipeline/providers/{types,anthropic,index,backoff}.ts` · `pipeline/run.ts` entry point · `README.md` §Run the pipeline · `_facts.yml changes[C30]`, `env_vars`.
**Log read through:** R47-M
**About to do:** the owner holds a Google Gemini API key and no Anthropic key, and `defects[D4]` still closes Bedrock (re-measured today). Add Gemini as a third real implementation of the `changes[C30]` seam so `changes[C9]` can run for real before the deadline, and let `run.ts` read a gitignored `.env` so the key never has to live in a shell profile. Price checked on the official page 2026-10-18: Flash models at 0.30–0.75 USD per 1M input tokens with a free tier; the 163-call run is under one dollar.

### Built
- `pipeline/providers/gemini.ts` — `GeminiProvider`: `generateContent` over Node `fetch`, no SDK; frames as `inline_data` jpeg parts before the text; `x-goog-api-key` header; `usageMetadata` into `usage`; 429/500/503 → `ProviderError retryable` under `withBackoff` (`limits.bedrock.on_throttle`), any other non-2xx fatal on the first attempt; a safety block (HTTP 200, no candidate text) returned empty so validation writes the cue `failed`, never hand-written (`AC7`). `DEFAULT_GEMINI_MODEL = gemini-3.8-flash` (first written as 2.5-flash; the first real call answered 404 *no longer available to new users*, naming 3.8), `GEMINI_MODEL_ID` overrides, and the track's `model_id` records whichever ran.
- `pipeline/providers/index.ts` — `DESCRIPTION_PROVIDER=gemini`, needs `GEMINI_API_KEY`; `PROVIDER_NAMES` gains it; `types.ts` id union gains `'gemini'`.
- `pipeline/run.ts` — `loadDotEnv`: a `.env` in the working directory fills variables the shell did not set, never overrides one.
- `README.md` §Run the pipeline: the Gemini block and the `.env` line; the fail-fast sentence names both fallbacks.
- Tests: `providers.test.ts` +4 (parts order and header, 429 retried to `MAX_ATTEMPTS` then 400 fatal on the first try, safety block → empty, selection only with a key).
**Not done:** no real call was made — `GEMINI_API_KEY` was not visible in this session (not in `.zshrc`/`.zprofile`/`.zshenv`, no `.env`). The first real run is `DESCRIPTION_PROVIDER=gemini npm run pipeline -- --levels standard --limit 5`, then `AC7`.
**Edits:** `pipeline/providers/gemini.ts` (new) · `pipeline/providers/{index,types}.ts` · `pipeline/run.ts` · `pipeline/__tests__/providers.test.ts` · `README.md` (275 lines, blob f3ccc8c) · `_facts.yml` (2098 lines, blob a8419c4 — `changes[C30]` appended, `env_vars` +2).
**Validation:** `npm run lint` exit 0 · vitest **178** (was 174) · jest unchanged (30).
**Still open:** as R47-M, plus the first real Gemini run.
**Next mode:** verify — run `--limit 5`, read the five cues against the frames, then the full run and `AC14`.

---

## R49 · 2026-10-19 · claude-opus-5-5 (Claude Code) · verify
**Read:** `pipeline/providers/gemini.ts` · `pipeline/describe.ts` (the provider-error branch) · `_log.md` through R48
**Log read through:** R48
**About to do:** the first real run of `changes[C9]`, free of cost: Bedrock still `Error 002` (re-measured 2026-10-19 as the account ROOT, us-east-1 and us-west-2, nova-lite and nova-pro, `authorizationStatus AUTHORIZED` beside it), and the owner chose no paid tier anywhere.

### Measured
- **Gemini free tier is 20 requests per model per day** (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, `quotaValue 20`), and 3.x Flash models answer 503 under load. `gemini-2.5-flash` answers 404 to new users. Gemini 3.x thinks by default and the thoughts are billed against `maxOutputTokens` — 57 of 60 tokens on a probe, empty answer — so thinking is off (`608eb25`). The provider now rotates through a model list, drops a model whose daily quota is gone, skips an overloaded one at once, and paces calls (`7c28f27`, `4195664`).
- **Ollama, `qwen2.5vl:7b`, on the build machine (M1 Pro, 16 GB):** 13.8 GiB resident, the cast pass 3 min 45 s and empty, the second cue past the 5 min fetch timeout. Built (`OllamaProvider`) and unit-tested; not usable on this machine for a full run.
- **Standard level, Gemini rotating six models at 7 s spacing:** **21 of 55 cues ok**, 34 failed when every model's daily quota was spent. Every ok cue within its budget at the first attempt. Track emitted at `generated/tears-of-steel/tears-of-steel.standard.track.json` (gitignored) with the 34 marked `failed`. Polly synthesized every ok cue.
- Sample, `0-11500`: *A title card reads, "the Mango Open Movie project." Next, huge rocket thruster cones loom above a massive industrial launch complex shrouded in mist.* · `73800-84600`: *A sniper in a bell tower aims at a ship. Below him, a newspaper covering Thom's face reads, 'ROBOTICIST CREATES KILLER ROBOTS'.*

**Validation:** vitest 186+ · lint 0.
**Still open:** 34 standard cues — the quotas reset at midnight Pacific; the cache makes the re-run pay only for them. `AC7` flips to executed when the standard track has no failed cue. `AC14` after that.
**Next mode:** verify — re-run `--levels standard` after 2026-10-20 00:00 PT.

---

## R50 · 2026-10-19 · claude-opus-5-5 (Claude Code) · implement + verify
**Read:** `src/App.tsx` · `src/screens/PlayerScreen.tsx` · `e2e/capture.ts` · the package's `src/ADControls.tsx` and `test/ADControls.spec.tsx` · `_log.md` through R49
**Log read through:** R49
**About to do:** R45-F3 — no visible focus on the title list, and the package's controls unstyled (default text colour on black, no focus state). The Design criterion is the entry's weakest; this is the cheapest thing that moves it.

### Built
- **Package, `react-native-tv-audio-description` (commit 35d18c9, local, not pushed, not published):** `ADControls` draws what it announces — inverted colours plus a 4 px `#FFD400` outline on the focused control, white text on a translucent panel, the selected level marked `●`, the failure sentences in the same legible colour; `theme` prop and `DEFAULT_THEME`. Package issue #3. 88 tests (3 new, on what is SHOWN).
- **App:** `TitleItem` in `src/App.tsx` — the title list draws its focus the same way. `PlayerScreen` bounds the controls (`right: 48`) and lifts them to `bottom: 128`: the native video surface paints its letterbox bars OVER React views, and at `bottom: 48` the second line of the missing-track sentence was hidden under the bar (measured on the VVD).
- **Harness, `e2e/capture.ts`:** the capture found the WRONG DEVICE. With an Android TV emulator (`TV_1080_RELEASE`) also running on the host, the wrapper's defaults (console 5554, gRPC 8554, no `--pid`) addressed it, and a whole release run captured another app's screens while every verdict — decided from beacon trace lines — still passed. That run was deleted unpublished; the 11 shots in `docs/e2e/` were checked one by one and are all the VVD. `findVvd()` now finds the device by its binary, reads its console port from what it listens on, enables gRPC on the matching port and passes `--pid` to every command; no VVD process is a loud failure.

### Verified on the Vega Virtual Device (package installed from a local tarball, `--no-save`)
- RELEASE `2026-10-19T17-44-24-666Z-release` — S01–S05 pass. VARIANT `2026-10-19T17-46-05-915Z-variant` — S10–S16 pass, S17 blocked by D6. Shots inspected: focused title inverted with outline (S01), the four controls on a panel with the focused level outlined and the selected one marked (S12), both failure sentences whole and legible (S03, S13).
**Not done:** `npm publish` of the package 0.2.0 waits on the owner (irreversible); until then the app's `package.json` still resolves `^0.1.0`, and `docs/e2e/` is not republished, because its header would name package 0.1.0 for a build that ran 0.2.0 code.
**Validation:** jest 31 · lint 0 · package jest 88.
**Edits:** `README.md` (275 lines, blob c922677) and `_facts.yml` (2098 lines, blob 531673f) — both changed in `608eb25` (R49) when the Gemini default moved from 2.5-flash, which answers 404 to new users, to 3.8-flash; recorded here because R49 did not.

---

## R51 · 2026-10-19 · claude-opus-5-5 (Claude Code) · verify
**Read:** `package.json` · `docs/e2e/index.html` (as regenerated) · `_log.md` through R50
**Log read through:** R50
**What this is:** the package release R50 waited on, and the app moved onto it.
- `react-native-tv-audio-description@0.2.0` published by the owner (npm 2FA), tag `v0.2.0` pushed; the registry's `gitHead` is `8a8c2af`, the tag's commit. Issue #3 closed by the commit.
- The app depends on `^0.2.0`. Built from the npm package and run on the VVD: RELEASE `2026-10-19T19-05-55-724Z-release` S01–S05 pass; VARIANT `2026-10-19T19-07-42-151Z-variant` S10–S16 pass, S17 blocked by D6. All 11 shots inspected before publishing — every one the VVD (R50's capture fix holding with the Android emulator still running).
- `docs/e2e/` republished from those two runs: header names package 0.2.0, 12 pass, 1 blocked, 2.2 MB.
**Found, not fixed:** R51-F1 `POLISH` — on the stall and error states (S15, S16) the centred status line overlaps the controls panel at the left. Readable, not clean.
**Validation:** jest 31 · vitest 186 · lint 0.

---

## R52 · 2026-10-19 · claude-opus-5-5 (Claude Code) · implement + verify
**Read:** `src/screens/PlayerScreen.tsx` · `test/PlayerScreen.spec.tsx` · `e2e/scenarios/variant.ts` (S11, S12) · `_log.md` through R51
**Log read through:** R51
**Disposition:** R51-F1 `POLISH` → **confirmed, fixed.** With the description controls on screen, the status line (stall, error) is centred in the space to their right (`left: 360`) on its own translucent panel; with no controls it stays centred on the screen. One jest test pins both cases.
**Verified on the VVD:** RELEASE `2026-10-19T19-32-40-097Z-release` S01–S05 pass. VARIANT run three times: `19-34-15` S12 failed (the D-pad landed one control lower — `controls.verbosity to=standard` where the scenario pressed for concise), `19-39-02` S11 failed (`no audio.duck id=c2`, a missing trace line, the shape of open `defects[D7]` in the e2e set), `19-44-08-264Z` all pass. Neither failure touches what this round changed, and each passed on the other two runs; recorded as R52-F1 below rather than retried until green. Shots of the published pair inspected: S15/S16 status line clear of the panel.
- R52-F1 `FUNCTIONAL` for the e2e set: key-driven scenarios S11/S12 are intermittent on the VVD, 1 failure in 3 runs each today — one a focus landing, one a lost line. Not disposed here.
`docs/e2e/` republished from RELEASE 19-32-40 and VARIANT 19-44-08: 12 pass, 1 blocked.
**Validation:** jest 32 · lint 0.

## R53 · 2026-10-19 · claude-opus-5-5 (Claude Code) · docs
**Read:** `SUBMISSION.md` · `README.md` (Status, Built with) · `FRICTION-LOG.md` · `generated/tears-of-steel/tears-of-steel.standard.track.json` (header only) · `_log.md` through R52
**Log read through:** R52
**Disposition:** the submission text caught up with R48–R52. `SUBMISSION.md` no longer carries the `[IF GENERATED TRACK LANDS]` / `[IF NOT]` fork: the truth is a third branch — Bedrock still refuses (`defects[D4]`), and the track is generated through the provider seam on Gemini. One placeholder stays, `[N]`, the standard cues `ok` after the final run (21 of 55 today, R49). Also brought current: the package at 0.2.0 and 88 tests, the harness status (12 pass, 1 blocked; R46-F1/F2 fixed), the friction-log count. README Status splits the old ⛔ bullet into "description has run, on Gemini, not yet on the device" and "Bedrock refuses". `FRICTION-LOG.md` gains the R50 capture defect as a dated entry (the Virtual Device takes whatever emulator console port is free; capture photographed another emulator) — High, 16 entries, 14 on Amazon tools.
- R53-F1 `FUNCTIONAL` for the video: §3's verbosity-switch shot needs concise and detailed tracks, and only standard is generated. Open in `SUBMISSION.md` §5 for the owner: generate them on the remaining free quota or label them fixture on screen.

## R54 · 2026-10-19 · claude-opus-5-5 (Claude Code) · docs
**Read:** `SUBMISSION.md` §3 and §5 · `_log.md` R49 (the measured yield) through R53
**Log read through:** R53
**Disposition:** R53-F1 → **decided by the owner, closed.** The free tier measured 21 ok cues in a day (R49), not the 120 calls its quota names, so concise + detailed (107 cues) cannot land before the video. The quota goes to the standard track and its `AC14` regenerations. `SUBMISSION.md` §3: the app shot grows to 1:35–2:25 on the generated track; the verbosity control gets 2:25–2:30 with the computed window counts (47 / 55 / 60) and the caption that text is generated for standard only — no fixture text is heard anywhere in the video. §5 records the decision.

## R55 · 2026-10-19 · claude-opus-5-5 (Claude Code) · implement + verify
**Read:** `_facts.yml` `worst_case` (gaps_detected, describable_pct, their notes) and `acceptance[AC19]` · `tools/viz/{model,svg,timeline,cli,split}.ts` · `tools/viz/README.md` · `pipeline/__tests__/viz-model.test.ts` · `_log.md` R52–R54
**Log read through:** R54
**Disposition:** the gap-timeline strip led with the raw R13 figures — "38 gaps ≥ 1.5 s", "78.6% describable silence" — that `worst_case` has marked superseded since R20, while `SUBMISSION.md`, the README table and the video say 39 / 451.8 s / 74%. A judge would have seen one number and heard another. **Fixed:** `tools/viz/model.ts` gains `content_ms` and `describable_of_content_pct`, computed from the manifest's content windows and the clipped gaps; the cards and subtitle now lead with **39** gaps in the content, **451.8 s = 74.2% of the content** describable, 76 cues, 67 spans, 55 cue windows, 18.6% dialogue. The raw 38 survives only as a footer note labelled "before clipping to the content windows"; 78.6% (and 61.5%) are printed nowhere. Both PNGs re-rendered and inspected; the first try put the note on the footer line, where it ran into the attribution, so it got its own line. `gap-split-screen.mp4` burns in none of these figures — not re-rendered. `acceptance[AC19]` gains a 10-19 attempt saying so. The raw silence total prints as 577.2 s from today's model against the registry's 577.0 s (R13 assumed a 734 s runtime; ffprobe later measured 734.17 s) — kept off the strip rather than introduce a third figure.
**Edits:** `tools/viz/model.ts` (205 lines, blob d5a28b4) · `tools/viz/timeline.ts` (336 lines, blob 105ce96) · `tools/viz/cli.ts` (99 lines, blob 2a9e9ca, log line) · `pipeline/__tests__/viz-model.test.ts` (74 lines, blob 9136092) · `_facts.yml` (2101 lines, blob 2401324 — `acceptance[AC19]` attempt appended) · `docs/video/gap-timeline-{video,readme}.{svg,png}` (re-rendered) · `_log.md` (this entry).
**Validation:** vitest 185 (19 files, viz-model 6) · lint 0 errors (11 pre-existing warnings in `src/`) · `viz:check` 0.

## R56 · 2026-10-20 · claude-opus-5-5 (Claude Code) · implement + verify
**Read:** `generated/night-run.log` · `generated/tears-of-steel/cache/descriptions.standard.json` · `pipeline/{run,describe}.ts` · `pipeline/providers/{types,gemini}.ts` · `acceptance[AC7]` · `_log.md` through R55
**Log read through:** R55
**Measured:** the standard run after the free-tier reset (04:35 PT) described the 34 remaining cues in 36 calls, 0 failed — the quota held, against R54's estimate of ~21 a day. Polly then stopped on `Your session has expired. Please reauthenticate.` (the AWS sign-in session); descriptions are written before synthesis, so nothing was lost. After `aws login` a second run made **0** model calls, synthesized the 34 new clips and wrote the track: **55 of 55 ok**.
**Disposition:** R56-F1 `FUNCTIONAL` → **fixed.** That cache-only run labelled the track `model_id: gemini-3.8-flash` — the provider's configured first model, which wrote 1 cue of 55 — because `buildTrack` took `provider.modelId`, the models that answered *this run*. Now each `ok` cue caches the model that wrote it (`DescribedCueResult.model`, from the new optional `DescriptionProvider.lastModelId`, set by the Gemini rotation), and `trackModelId()` builds `model_id` from the cues; a legacy cue with no record is named `unrecorded`, never guessed. The 2026-10-20 cache was backfilled from the run's own rotate/ok lines (3-flash-preview 16, 3.6-flash 7, 3.1-flash-lite 5, 3.7-flash 3, 3.5-flash 2, 3.8-flash 1); the 21 cues of 2026-10-19 carry that run's recorded pair, `gemini-3-flash-preview+gemini-3.1-flash-lite`. The cache before backfill is kept beside it (`.bak-2026-10-20`, gitignored). Track `model_id` now: `gemini-3-flash-preview+gemini-3.1-flash-lite+gemini-3.6-flash+gemini-3.8-flash+gemini-3.7-flash+gemini-3.5-flash`.
**Edits:** `_facts.yml` (2103 lines, blob 46242e7 — `acceptance[AC7]` attempt, passed, standard only, status stays written) · `pipeline/run.ts` · `pipeline/describe.ts` · `pipeline/providers/{types,gemini}.ts` · tests in `run`, `describe`, `providers`. Carried from the e2e-harness set's R10 (2026-10-19), which this log had not seen: `docs/features/e2e-harness/_facts.yml` (881 lines, blob c29f914 — `contracts.run_record.app_commit`).
**Validation:** vitest 192 (21 files, 2 new; `contract.track` validates the generated track) · `npm run lint` 0 · `tsc -p pipeline` 0.
**Next:** load the generated standard track on the Virtual Device, re-run both suites, republish `docs/e2e/`; fill `[N]` = 55 in `SUBMISSION.md`; AC14.

## R57 · 2026-10-20 · claude-opus-5-5 (Claude Code) · implement + verify
**Read:** `src/App.tsx` · `src/screens/PlayerScreen.tsx` · `pipeline/{prepare,segment}.ts` · `metro.config.js` · the package's `TrackLoader`, `CueScheduler`, `vega/SegmentBuffer` · `e2e/scenarios/*` · `limits.vega_media.{media_process_is_separate,build_packages_assets_dir}` · `limits.mse_buffer` · `_log.md` through R56
**Log read through:** R56
**Measured:** R56's "load the track on the device" had nothing to load into. The package carried the 20 s excerpt and a probe cue; no Tears of Steel track was in it, and the Release suite's S05 asserted exactly that absence. The generated track's `audio_uri` is relative (`audio/<id>.standard.m4a`) and the package hands it to `clips.play` as is. The owner chose to package the film (over serving it from the host, or an excerpt).
**Disposition:** R57-F1 `FUNCTIONAL` → **fixed.** `changes[C31]` `pipeline/package.ts` (`npm run package:film`) cuts the whole film by `C27` into `src/assets/seg/` — 123 segments of 6 s, 117 MB — and copies the generated track, with the 55 clips its `ok` cues name, into `src/assets/ad/`. A required `.json` is inlined by metro, not copied, so the emitted `tracks.ts` hands the app the object plus a static `require` per clip; `App.packagedTrack` resolves each `audio_uri` when the loader asks for a path under the product directory and leaves every other path to `fetch`. The probe cue and the clip are no longer wired. Release package: **128 MB**. On the device, both suites from commit `e0567b5`: release 4/4 (`2026-10-20T17-24-25-693Z-release`), variant 8 pass + S17 blocked (`2026-10-20T17-27-00-931Z-variant`). `loader.load ok=true cues=55`; `cue_0-11500` fired at pos_ms=142, ducked to 25 and restored at ~10.3 s, inside its window; the second cue fired at 11593. `limits.mse_buffer.device_evict`: S06 saw `buffer.evicted` with held ≤ 9 every time, the first device run of the evict half. AC4 and AC5 gain a passed attempt each, scoped to that one cue; both stay `written`. AC23 stays `written` (45 s of 12 min, not the worst device). The harness changes — S02/S03/S05 retired, S06/S07/S19 — are e2e-harness R11. The video's missing-track beat (`SUBMISSION.md` §3, 2:30) moves to the labelled fixture: the Release package has no track file to rename.
**Edits:** `_facts.yml` (2126 lines, blob 0ac357e — `changes[C31]`, `limits.mse_buffer.device_evict`, `acceptance[AC4]`, `acceptance[AC5]`) · `02b2-track-output.md` (263 lines, blob b1779a7 — C31 paragraph) · `pipeline/package.ts` (new) · `src/App.tsx` · `src/assets/ad/{tracks.ts,tears-of-steel.standard.track.json}` (generated, committed) · `test/App.spec.tsx` (2 new) · `package.json` (`package:film`) · `.gitignore` · `README.md` · `SUBMISSION.md` · `docs/e2e/` (republished). Carried from the e2e-harness set's R11: `docs/features/e2e-harness/_facts.yml` (896 lines, blob 1bc4f45 — `limits.suite`).
**Validation:** jest 34 · vitest 193 · `npm run lint` 0 errors · `tsc -p e2e` 0 · both suites green on the device as above.
**Next:** AC14 — watch the film end to end on the device and rate every cue; regenerate the worst. Video 10-21.

## R58 · 2026-10-22 · claude-opus-5-5 (Claude Code) · verify + implement
**Read:** the owner's AC14 sheet (`generated/tears-of-steel/ac14/ac14-sheet-updated.numbers`, exported to CSV) · `generated/tears-of-steel/cache/{cast.txt,descriptions.standard.json}` · the frames of cues #9, #19, #42 · `pipeline/{run,gaps,manifest,synthesize}.ts` · `pipeline/__tests__/contract.track.test.ts` · `acceptance[AC7]`, `[AC14]`, `[AC18]` · `_log.md` through R57
**Log read through:** R57
**Measured:** the owner watched the host-side mix (`generated/tears-of-steel/ac14/`, R57's plan) end to end and rated all 55 cues: **mean 4.51**, **2 failed** (score ≤ 2) = **3.6%** — #19 (2) and #42 (1); 34 fives, 18 fours, one 3. Sheet committed as `docs/ac14/ratings-2026-10-22.csv` (notes in the owner's words, Spanish).
**Dispositions:**
- R58-F1 `FUNCTIONAL` (AC18) → **recorded, not fixed.** 10 notes are one defect: a character named wrongly (#19, #31, #38, #39, #40, #43, #50, #51, #53, #55). `cast.txt` holds two names, Celia and Thom, because `buildDramatisPersonae` sees only the first window's frames and the first 20 subtitles; the model hands those two names to whoever is on screen. The fix — a cast built from frames across every content window, then all 55 cues re-described — is one full run the free Gemini tier cannot pay for before the deadline (owner's call, 2026-10-22). `acceptance[AC18]` gains a failed attempt.
- R58-F2 `FUNCTIONAL` (AC14) → **regenerated, partly kept.** #9, #19, #42 were deleted from the cache and re-described on `gemini-3.6-flash` (3.8-flash and 3.7-flash out of daily quota; two runs before that got 503 and `fetch failed`, recorded as `failed` and retried). With the same cast the new #9 was worse (it named Thom at the rifle) and #19 still wrong, so their original entries were restored from `descriptions.standard.json.bak-2026-10-22`; #42 came back better (the grappling hook fired at the ceiling) and is kept.
- R58-F3 `FUNCTIONAL` → **fixed.** The owner: the credits, 9:48–11:48, play in silence, and a viewer cannot tell the film ended. `contracts.content_window.announce_end` (optional): a fixed sentence the pipeline speaks where that window ends, `ANNOUNCE_MS` = 3000 bounded by the next window and the asset end; no model call, `source_frames_ms: []`, logged as `describe.announce`. The manifest's film window carries "The end credits roll." → `cue_588000-591000` (1.51 s of Polly). It joins the track, not the level's counts (`LevelResult.announced`), and does not enter `model_id`. **It is hand-written text**, the one exception to AC7: `contract.track.test` matches it to the manifest verbatim and requires empty frames, so the exception cannot widen. `acceptance[AC7]` gains an attempt saying so.
**Verified on the VVD:** Polly stopped once more on the expired sign-in session; after the owner's `aws login` the pipeline synthesized the two new clips (0 model calls) and wrote **56 cues, 0 failed**. `npm run package:film` → 56 clips. From commit `64a5b72`: release 4/4 `2026-10-22T18-30-03-493Z-release` (`loader.load ok=true cues=56`), variant 8 pass + S17 blocked `2026-10-22T18-32-50-127Z-variant` (app `64a5b72+dirty` — the refreshed traces under `e2e/__tests__/`, no app source). `docs/e2e/` republished; the S07 clip came out at 3.1 MB against the 3 MB bound and was re-encoded (x264 CRF 30, 1.1 MB) before publishing. Not verified on the device: the credits cue firing at 588 s — no scenario plays that far.
**Edits:** `_facts.yml` (2137 lines, blob 9dfa211 — `contracts.content_window.announce_end`, `acceptance[AC7]`, `[AC14]`, `[AC18]` attempts) · `media/tears-of-steel.manifest.json` (21 lines, blob e6245d3) · `pipeline/{gaps,manifest,run}.ts` · tests in `gaps`, `manifest`, `run`, `contract.track` · `src/assets/ad/` (regenerated) · `docs/ac14/ratings-2026-10-22.csv` (new) · `README.md` (288 lines, blob 1bc47ab) · `SUBMISSION.md` (510 lines, blob 49bb7e5) · `docs/e2e/` (republished). Carried from the e2e-harness set's R12: `docs/features/e2e-harness/_facts.yml` (896 lines, blob 55af0fe — S07 decisive line).
**Validation:** vitest 197 · jest 34 · `npm run lint` 0 errors · both suites on the device as above.
**Next:** the video (AC12), then the submission (AC13).

## R59 · 2026-10-22 · claude-opus-5-5 (Claude Code) + claude-fable-5-1 (review) · review + docs
**Read:** a judge's-eye review of the entry by a read-only subagent (Fable) over `SUBMISSION.md`, `README.md`, `FRICTION-LOG.md`, `docs/e2e/`, `docs/video/`, the registry and the OSS repository · `tools/viz/split.ts` · `_log.md` R58
**Log read through:** R58
**Dispositions** (each finding checked before acting; one of the review's figures was wrong and is corrected below):
- R59-F1 `FUNCTIONAL` (DQ-class) → **fixed.** The §3 video script ran to 3:00 against a limit of *under* 3 minutes while its header claimed 2:45. Re-timed to 2:45: an 8 s hook with a cue firing on the device first, the Bedrock refusal cut from 25 s to 18 s with the Polly cost on screen, the cast-and-blind-viewer captions shortened.
- R59-F2 `FUNCTIONAL` → **fixed.** `SUBMISSION.md` §2.2 still said "all 55 … no hand-written cue text" after R58 made the track 56 cues with one manifest sentence, and never said only the standard level was generated. Both stated, with the AC14 result.
- R59-F3 `FUNCTIONAL` → **fixed.** `README.md` ran the x86_64 package; the Virtual Device and harness are aarch64. A fresh clone had no route to the film: the README now names the download page and the transcode, then `npm run package:film`.
- R59-F4 `POLISH` → **fixed.** README and SUBMISSION had no images: the gap timeline and two device shots (S07 controls, S19 missing track) added, with a note that the emulator capture omits the video plane.
- R59-F5 `FUNCTIONAL` → **fixed.** `docs/video/gap-split-screen.mp4` was still the 10-18 placeholder. Re-rendered from the generated track (`acceptance[AC19]` attempt).
- R59-F6 `POLISH` → **fixed.** AWS Builder §2.7 now carries the measured cost: 56 `SynthesizeSpeech` calls, **5,601** characters (the review said 5,572; counted from the packaged track), ≈ $0.09 of Polly neural per film, 5.2 MB of clips, zero AWS calls on the TV. Built With lists Polly before Bedrock. README Status dated 2026-10-22.
- R59-F7 → **added.** `FRICTION-LOG.md` gains the 2026-10-22 `aws login` session entry (R56 and R58 both hit it): 17 entries, 15 on Amazon tools, 7 Low.
- **Left to the owner** (public or external): the GitHub repository descriptions and topics (Interstice's still says "with Amazon Bedrock and Polly"), a GitHub Release with the aarch64 `.vpkg`. **Not done:** the AC18 cast fix (R58). The registry's dated close-out counts at `changes[]` friction-log and `acceptance[AC11]` (15 entries, 2026-10-18) are measurements of that day and stay as recorded.
**Edits:** `SUBMISSION.md` (522 lines, blob 87afdf0) · `README.md` (305 lines, blob 217b1ae) · `FRICTION-LOG.md` (231 lines, blob e20e5d5) · `_facts.yml` (2140 lines, blob dc79fd6 — `acceptance[AC19]` attempt) · `docs/video/gap-split-screen.mp4` (re-rendered).
**Validation:** documents and one render; no code changed.

## R60 · 2026-10-22 · claude-opus-5-5 (Claude Code) · implement + docs
**Read:** the Remotion agent skills (`remotion-create`, `remotion-markup`, `remotion-best-practices`, installed at project scope under `.claude/skills/`) · `e2e/{capture,input,device}.ts` · `SUBMISSION.md` §3 · `acceptance[AC12]`, `[AC19]` · `_log.md` R59
**Log read through:** R59
**Measured:** the demo video's device footage. The harness's gRPC `record` measured **1 fps** of distinct frames during playback (10 in 10 s) and slowed the film to under half speed on the device; the e2e S07 clips measure 5–6 fps. Not used for picture. The Virtual Device runs with a GUI window (`-skin tv-remote`); its 960×540-point screen area recorded with `screencapture -v -R` gives 1920×1080 at ~17–21 distinct fps with the film at real time (scene cuts match the film's at a constant offset, 4.5→4.77 s over 70 s). Sound comes from a parallel gRPC recording at 2 fps, aligned to the film by envelope cross-correlation (corr 0.74–1.4 on dialogue windows). The Android TV emulator also running on the host used 6 % CPU; not the cause.
**Disposition:** R60-F1 `FUNCTIONAL` → **done.** Video published, public: **https://youtu.be/9BRS-iJYW0s**, 2:32, English, 1080p. Remotion 4.0.537 (4.0.538 refused by the host's npm `before` policy), project kept outside this repository; narration Amazon Polly Matthew (generative), 1,579 characters; loudness −15.3 LUFS, peak −1.2 dBFS. `SUBMISSION.md` §3 now describes the published cut, with times and narration verbatim; §1, §2.4 and §5 carry the URL. `acceptance[AC12]` and `[AC19]` gain passed attempts; both stay `written`. README links the video and corrects R59's caption: the device shots are dark because they are taken before the film's first frame, not because the capture omits the video plane (the gRPC clips show the film).
**Edits:** `SUBMISSION.md` (522 lines, blob ee1a2fa) · `README.md` (311 lines, blob ffb2973) · `_facts.yml` (2146 lines, blob 8035556 — `acceptance[AC12]`, `[AC19]`).
**Validation:** documents only. `youtube.com/oembed` resolves the URL (title and channel), so it is public.
**Next:** `AC13` — the owner submits the form.

## R61 · 2026-10-23 · claude-opus-5-5 (Claude Code) · implement + docs
**Read:** the Devpost requirement that the repository hold all source, assets and instructions the project needs to run · `pipeline/package.ts` · `.gitignore` · `README.md` · `changes[C31]` · `_log.md` R60
**Log read through:** R60
**Disposition:** R61-F1 `FUNCTIONAL` → **fixed.** A fresh clone could not run the app as submitted: `src/assets/ad/audio/` (the 56 Polly clips the committed track names, 4.0 MB) was gitignored, and `npm run package:film` re-copied tracks from `generated/tears-of-steel/` — gitignored, absent on a clone — and would have rewritten `src/assets/ad/tracks.ts` with no track. The clips are now committed (56 of 56 `audio_uri` in `tears-of-steel.standard.track.json` resolve). `packageTracks` (exported from `package.ts`) still cuts the segments, and when `generated/<asset>/` holds no `*.track.json` it leaves `src/assets/ad/` untouched and logs `INTERSTICE.package.tracks_kept`; with tracks present it behaves as before. `changes[C31]` gains a note. README gains the fresh-clone path (clone → `npm install` → film download + transcode → `package:film` → `npm run build` → the Virtual Device), says no API keys are needed to run, and links the prebuilt Release `v0.1.0-hackathon`. The film itself stays out of git. No app behaviour changed.
**Edits:** `_facts.yml` (2150 lines, blob 8ff3edb — `changes[C31]` note) · `pipeline/package.ts` (99 lines, blob 2cb7699) · `pipeline/__tests__/package.test.ts` (89 lines, blob 5dcee31, new, 4 cases) · `.gitignore` (42 lines, blob 051eb8d) · `README.md` (322 lines, blob c7ac4d8) · `src/assets/ad/audio/` (56 clips, now committed).
**Validation:** vitest 199 · jest 34 · `npm run lint` 0 errors · `tsc -p pipeline` 0. No device run: nothing the app bundles changed.
