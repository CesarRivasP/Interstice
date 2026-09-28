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
