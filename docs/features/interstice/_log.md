# Handoff log — interstice

Append-only. One `##` block per round, newest at the BOTTOM. Never edit or delete
a previous entry — a rejected finding with its evidence attached is what stops the
next round re-deriving it.

**Read this file from disk before anything else. It outranks your context window.**
If your context disagrees with the log, your context is stale: re-read the files
the last entry names, at the versions it names.

Hashes: `git hash-object <file>` (first 7 chars) plus `wc -l`. Both.

---

## R1 · 2026-09-19 · claude-opus-5 (Claude Code) · author
**Read:** `docs/features/_profile.yml` (new this round) · no prior spec set in this repo (`docs/` did not exist)
**Log read through:** — (first entry)
**Dispositions:** — (nothing prior)
**About to write:** `_facts.yml` (registry) + `01-master-plan.md` (stage 1 decision doc).
Inputs: four user decisions taken in session — name `Interstice`, prose language `en`,
hybrid AD path (prepared track base + live capture as a gated layer), solo entry.
Hackathon facts sourced from the Devpost rules/resources pages (fetched through a
read proxy; `curl` against devpost returns `202` with an empty body, so none of those
numbers is re-runnable as a command — they enter the registry as `basis: asserted`
with `falsified_by:` and a `source:`).
**Edits:** `docs/features/_profile.yml` (new, 34 lines, blob d319072) · `_facts.yml` (new, 412 lines, blob 53816c5) · `01-master-plan.md` (new, 202 lines, blob f992b77)
**Gap sweep (base + `mobile-tv` layer), findings and where each one landed:**
- S1 SECURITY — live capture sends a frame of what the viewer is watching to a third party. → `decisions.privacy_optin`, `AC9`, doc 01 §5.
- S2 SECURITY — subtitle text is third-party content fed into a model prompt; a crafted cue file is an injection surface. → `C9` (delimited data, bounded output, shape validation, `status: failed` on rejection), doc 01 §5.
- S3 SECURITY — the submission video is published publicly and the rules forbid unauthorized copyrighted material. → `decisions.demo_asset_licensing`, doc 01 §5 and §8.
- F1 FUNCTIONAL — a description longer than its gap talks over dialogue. → `limits.ad.max_words_per_cue` derived from the gap, `AC4`.
- F2 FUNCTIONAL (mobile-tv) — a screen state whose only focusable element unmounts leaves the D-pad dead. → `C2` names a focus host in every state, `AC2`; BACK during playback stated separately.
- F3 FUNCTIONAL (mobile-tv) — held direction emits a stream of key events; one cue per event, and a seek desyncs the scheduler. → `C3` coalesces and resyncs, `AC6`.
- F4 FUNCTIONAL (mobile-tv) — 32-bit heap on a Fire TV Stick; resident audio clips are unbounded. → `limits.clip_cache.max_clips_in_memory: 8`, clips stream from disk.
- F5 FUNCTIONAL (mobile-tv) — backgrounding during playback. → `C4` stops on background.
- F6 FUNCTIONAL — Bedrock throttling mid-run with no branch. → `limits.bedrock.on_throttle`, `contracts.description_cue.status: failed`, doc 01 §6.
- F7 FUNCTIONAL — a missing or malformed track renders as silence, which is indistinguishable from a working app with nothing to say. → `AC8`, `C5`/`C6`.
- Scale question (base sweep §Any change that answers a limit of scale): nothing here exists to answer a limit of scale — one asset, one viewer, processed once offline. Stated in doc 01 §6 rather than left implicit.
- Unclassified by any kind: `C12`, `C13`, `C14` are deliverables, not code changes. Swept on their own terms — each has a dated phase in §3.2 and an acceptance criterion (`AC10`, `AC11`, `AC12`).
**Still open:**
- `D3` (Vega simulator runs here) — `basis: asserted`. Blocks the platform choice itself; `A4` reopens if it dies. Settled by the Phase 0 spike, 09-19 → 09-22.
- `D2` (concurrent audio + duck) — `basis: asserted`. Blocks the product's core interaction; the pause fallback must be decided in Phase 0, not discovered later.
- `D1` (runtime frame capture on Vega) — `basis: asserted`. Blocks `C11` only, which is why `C11` is `kind: deferred`.
- `tests_baseline` — `outcome: aborted_no_conditions`. No application code exists yet; `_profile.yml commands.tests` / `tests_expect` / `lint` / `build` / `device_log` / `force_stop` are all `null` and are filled at the end of Phase 0.
- `limits.bedrock.invoke_rate_per_account` and `limits.polly.chars_per_request` are `unknown`, confirmed against the console on the first pipeline run.
- All `limits.hackathon` values are `asserted` against the rules page, not `measured`: `curl` against devpost returns HTTP 202 with an empty body, so no command reproduces them. Re-read the page by hand before Phase 5.
**Next mode:** `review interstice` (gap sweep against the written set, by a cold reader), then user confirmation, then `status: draft -> reviewed`, then `implement`.

---

## R2 · 2026-09-19 · kimi-k3 (OpenCode) · review findings landing
**Read:** `.claude/skills/feature-spec/SKILL.md` (233 lines, blob dbe4914) · `_facts.yml` (412 lines, blob 53816c5) · `01-master-plan.md` (202 lines, blob f992b77) · `_log.md` (47 lines, blob 5c71d64, through R1 end)
**Dispositions (R1 open items):** all stand — D3, D2, D1 stay `open` (the Phase 0 spike resolves them, not this round); `tests_baseline` stays `aborted_no_conditions`; hackathon numbers stay `asserted` against the rules page. None of this round's edits resolves a hypothesis; they reshape what gets built around them.
**About to write (stub opened before editing, per protocol):** land the six findings from a cold-read review of v1 into `_facts.yml` + `01-master-plan.md`.
**Findings (cold read of v1) and where each landed:**
- F1 FUNCTIONAL — `D2`'s only fallback (pausing the asset per cue) breaks the "watch a film" premise the product stands on. → new `decisions.d2_fallback`: the pipeline pre-mixes a second audio track (ducking + cues baked in) and the app toggles via audio-track switching — no concurrency needed, playback never stops. Pause demoted to last resort. Landed in `defects.D2.note`, doc 01 §3.2 gate, §8.
- F2 FUNCTIONAL — a near-dialogue-free demo asset (Big Buck Bunny, Sintel) collapses the gap mechanism into one continuous gap; the clever part of the demo becomes invisible. → `decisions.demo_asset_licensing` extended with the substantial-dialogue requirement, candidates (Tears of Steel, Elephants Dream) and Phase 0 subtitle verification. Doc 01 §5, §7 Phase 0 checklist, §8.
- F3 FUNCTIONAL — one midpoint frame misdescribes a gap that spans a cut; independent per-gap cues drift in naming ("the woman" / "she" / a name). → `limits.ad.frames_per_gap_max: 3` (midpoint + per-shot via scene detection, still one Bedrock call per cue) and `limits.ad.rolling_context_cues: 10` (preceding descriptions fed back as naming context). `C8`/`C9` re-scoped. Doc 01 §2, §3.1, §6, §7.
- F4 FUNCTIONAL — no acceptance criterion covered description QUALITY; AC7 proves provenance, not that a cue is good, and cue quality is what the design/impact judging criteria read. → `AC14` (full-length watch, every cue rated against the picture, worst regenerated before recording). Phase 4, doc 01 §7.
- F5 FUNCTIONAL (mobile-tv layer) — an app FOR blind users whose own control surface had no screen-reader criterion. → `AC15` (VoiceView pass, shown in the demo video). Phase 4, doc 01 §7.
- F6 POLISH — the problem statement asserts thin AD coverage with no sourced figure, weakening the "potential impact" criterion. → `AC16`: at least one sourced figure, and it enters the registry (with `source:`) before the prose, per the no-invented-numbers rule.
- REJECTED — "docs 02/03 carry `stage: reviewed` but do not exist on disk": that is the feature-spec convention (SKILL.md, `new` step 4 — stages are set at authoring time so `audit` knows when each doc comes due). Not an inconsistency; no edit. Recorded so the next round does not re-derive it.
**Edits:** `_facts.yml` (451 lines, blob a8e6d78 — revisions v2; decisions +`d2_fallback`, `demo_asset_licensing` rewritten; limits.ad +`frames_per_gap_max`/`rolling_context_cues`; changes C8/C9 re-scoped; D2 note; acceptance +AC14/15/16) · `01-master-plan.md` (213 lines, blob e0b0f28 — changelog v2, §2, §3.1, §3.2, §5, §6, §7, §8; the §7 D2 line caught up to the pre-mix fallback after `audit` output surfaced it still said "pause fallback")
**Still open:** everything R1 left open, plus the two new Phase 0 checklist items (dialogue-bearing asset, subtitle quality). YAML re-validated with `yaml.safe_load_all` after editing (edited as text, never round-tripped).
**Next mode:** user confirmation of this round, then `status: draft -> reviewed`, then `implement` (docs 02/03). The `review` gap sweep is already satisfied by R1's sweep plus this round's landed findings.

---

## R3 · 2026-09-19 · muse-spark-1.2 (OpenCode) · competitive hardening
**Read:** `_facts.yml` (451 lines, blob a8e6d78) · `01-master-plan.md` (213 lines, blob e0b0f28) · `_log.md` (65 lines, blob 26b7481, through R2 end) · `docs/features/_profile.yml` (34 lines, blob d319072)
**Log read through:** R2
**Dispositions (R2 open items):** all stand — D3/D2/D1 `open` awaiting Phase 0 spike; `tests_baseline` `aborted_no_conditions`; hackathon numbers `asserted`; dialogue-bearing asset + subtitle quality Phase 0 items inherited. None of this round resolves a hypothesis; it hardens the product around them.
**About to write (stub opened before editing, per protocol):** land competitive hardening from user-requested review (engineering strong, `wow`/narrative weak) into `_facts.yml` + `01-master-plan.md`.
**Findings (competitive review) and where each landed:**
- C1 COMPETITIVE — verbosity is a checkbox, not a feature. Without selectable levels the product reads as a file, not a feature (A2). → new `decisions.verbosity_levels` (concise 0.6 / standard 1.0 / detailed 1.35 rescaling `limits.ad.max_words_per_cue`), `limits.ad.verbosity_scales` + `limits.ad.quality_gate`, `C5` re-scoped to three-level D-pad + VoiceView selector, `C10` regenerable per level, `AC17`. Doc 01 §2, §3.1, §3.2 Phase 2, §7 App, §8.
- C2 COMPETITIVE — rolling context alone drifts names (pronoun drift). One extra call fixes coherence for the whole film. → new `decisions.dramatis_personae` (one-call cast anchor from opening frames + subtitles, fed into every `C9` prompt alongside `limits.ad.rolling_context_cues`), `C9` re-scoped, `AC18`. Doc 01 §2, §3.1, §7 Pipeline, §8.
- C3 COMPETITIVE — a gap is silence: invisible to a sighted judge in a 3-min video. The core mechanism does not exist if it is not visualized. → new `decisions.gap_visualization` (timeline strip dialogue vs gaps + split-screen before/after rendered from `C7` data), `C7` noted as viz source, `C14` extended, `AC19`. Doc 01 §2, §3.1, §7 Submission, §8.
- C4 COMPETITIVE — impact story is a number without a face. Judges score `potential impact` with a viewer, not a stat. → new `decisions.user_validation` (one 20–30 min blind/low-vision session before Phase 5, with/without comparison, consent on file, anonymized quote for video/SUBMISSION.md, no PII in repo), `AC20`. Doc 01 §3.2 Phase 5, §7 Submission, §8.
- C5 COMPETITIVE — friction-log bonus is 10% but a log reconstructed at the end reads as fabricated and scores zero. → new `decisions.friction_log_shape` (`tool | expected | happened | workaround | time_lost`, 5–8 entries, written during build), `C13` re-scoped per shape, `AC11` tightened. Doc 01 §3.1, §3.2 Phase 5, §7, §8.
- C6 COMPETITIVE — `D2` fallback as "failure mode" undersells it; on old sticks concurrent duck may never work. → `decisions.d2_fallback` kept but reframed in doc 01 as compatibility mode for older sticks (pre-mixed second track via track switching), not just a failure branch. Doc 01 §3.2 gate, §8.
- C7 POLISH — `AC14` without scoring is not auditable; `C12` without a one-command runnable bar fails the OSS mini-challenge in practice. → `AC14` tightened to 1–5 per cue + track mean + % failed (`limits.ad.quality_gate`); `C12`/`AC10` tightened to one-command runnable; quality coherence tied to `AC18`. Doc 01 §3.2 Phase 4, §7.
**Edits:** `_facts.yml` (531 lines, blob 0a5e56e — revisions v3; decisions +`verbosity_levels`/`dramatis_personae`/`gap_visualization`/`user_validation`/`friction_log_shape`; limits.ad +`verbosity_scales`/`quality_gate` + extended note; changes `C5`/`C9`/`C13`/`C14` re-scoped, `C7` annotated; acceptance +`AC17`/`AC18`/`AC19`/`AC20`, `AC14` tightened) · `01-master-plan.md` (221 lines, blob 72d9034 — changelog v3, §2 pipeline+device+viz, §3.1 table `C5`/`C7`/`C9`/`C10`/`C13`/`C14`, §3.2 phases 0–5 with `AC17`/`AC18`/`AC19`/`AC20` and quality gate, §7 Pipeline/App/Submission, §8 risks reframed + new rows for viz/validation/verbosity)
**Validation:** `python3 -c "yaml.safe_load_all(open('_facts.yml'))"` ok; `python3 scripts/audit.py docs/features/interstice/` → clean — every mechanized check passed · stage draft: 2 doc(s) not due yet · pending downstream coverage listed for `implement`.
**Still open:** all R2 items plus: `D3`/`D2`/`D1` still `open` (Phase 0 spike 09-19→09-22); `tests_baseline` still `aborted_no_conditions` (no app code yet, `_profile.yml commands.tests` null until Phase 0); `limits.hackathon` still `asserted` (curl Devpost → 202, re-check by hand before Phase 5); `limits.bedrock`/`limits.polly` still `unknown` until first pipeline run; new `AC17`–`AC20` and tightened `AC14`/`C5`/`C9` await Phase 2–5 implementation.
**Next mode:** user confirmation of R3, then `status: draft -> reviewed`, then `implement` (docs 02/03). The `review` gap sweep is already satisfied by R1+R2+R3 (R3 is competitive hardening, not a safety gap sweep — no new `defects[]`/`alternatives[]` introduced).

---

## R4 · 2026-09-19 · claude-sonnet-5 (Claude Code) · TypeSafe judgment layer
**Read:** `_facts.yml` (531 lines, blob 0a5e56e) · `01-master-plan.md` (221 lines, blob 72d9034) · `_log.md` (85 lines, blob 9e4c78a, through R3 end) · TypeSafe live docs (`concepts/system-one.md`, `primitives/choice.md`, `api.md`) — confirmed Jev/System One is **text-only**, no image/video input.
**Log read through:** R3
**Dispositions (R3 open items):** all stand — `D3`/`D2`/`D1` still `open` awaiting Phase 0 spike; `tests_baseline` still `aborted_no_conditions`; `limits.hackathon` still `asserted`; `limits.bedrock`/`limits.polly` still `unknown`. None of this round resolves a hypothesis.
**About to write (stub opened before editing, per protocol):** land two TypeSafe-based additions requested by the user after a value-add evaluation of the feature set against the TypeSafe skill — both scoped to what Jev can actually do (text-only judgments, no vision):
- `C15` (`pipeline/normalize_cast.ts`) — a Choice call matches each generated cue's character reference against the `dramatis_personae` cast list and normalizes it before synthesis. Directly strengthens the existing `C2`/F3 naming-drift mitigation (today only `rolling_context_cues`, a soft nudge) with a checkable, code-enforced step.
- `C16` (`pipeline/subtitle_guard.ts`) — a Noul call screens each subtitle line for injection intent before it enters the `C9` prompt as context; a line over `limits.typesafe.injection_noul_threshold` is dropped and logged. Second layer on top of the existing `S2` mitigation (delimited data + shape validation on the output side).
Explicitly rejected in this round: using TypeSafe for `AC14` visual-fidelity scoring — Jev is text-only and cannot see a frame, so that stays a human watch per `limits.ad.quality_gate`. Recorded so a later round does not re-propose it without re-deriving the same limitation.
**Edits:** `_facts.yml` (583 lines, blob acd3e70 — revisions v4; new decision `typesafe_judgment_layer`; new `limits.typesafe`; new changes `C15`/`C16`; `endpoints.typesafe_systemone` + `env_vars` +`TYPESAFE_API_KEY`; acceptance +`AC21`/`AC22`) · `01-master-plan.md` (231 lines, blob 73ad22d — changelog v4, §2 cast-normalization sentence, §3.1 table +`C15`/`C16`, §3.2 Phase 1 row, §4 endpoints/env_vars, §5 second security paragraph + text-only-scope paragraph, §6 cost line, §7 Pipeline checklist +2 items, §8 two risk rows updated)
**Validation:** `python3 -c "yaml.safe_load_all(open('_facts.yml'))"` ok · `python3 scripts/audit.py docs/features/interstice/` → first pass found 1 DRIFT (`endpoints.typesafe_systemone` never cited verbatim in prose); fixed by quoting the exact registry string in doc 01 §4 instead of paraphrasing it; re-run → clean, every mechanized check passed, stage draft: 2 doc(s) not due yet.
**Still open:** everything R3 left open (`D3`/`D2`/`D1`, `tests_baseline`, `limits.hackathon`/`limits.bedrock`/`limits.polly`), plus `limits.typesafe.injection_noul_threshold` (`0.7`) is `basis: decided`, not measured — no subtitle corpus exists yet to tune it against; revisit once the demo asset's real subtitle file is in hand (Phase 0/1).
**Next mode:** user confirmation of R4, then continue toward `review`/`status: reviewed` as already queued from R3.

---

## R5 · 2026-09-19 · claude-opus-5 (Claude Code) · review (cold read of v4)
**Read:** `_facts.yml` (583 lines, blob acd3e70) · `01-master-plan.md` (231 lines, blob 73ad22d) · `_log.md` (100 lines, blob f193a24, through R4 end) · `docs/features/_profile.yml` (34 lines, blob d319072) · `~/.claude/skills/typesafe-ai/SKILL.md` · `https://docs.typesafe.ai/api.md` (fetched)
**Log read through:** R4
**Dispositions (R4 open items):** all stand — `D3`/`D2`/`D1` `open` awaiting the Phase 0 spike; `tests_baseline` `aborted_no_conditions`; `limits.hackathon` `asserted`; `limits.bedrock`/`limits.polly` `unknown`; `limits.typesafe.injection_noul_threshold` untuned. This round resolves no hypothesis and edits nothing.
**Verified, not a finding (recorded so no later round re-derives it):**
- `endpoints.typesafe_systemone` checked against the live HTTP API reference: `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer <API_KEY>`. The registry string matches. `Choice` and `Noul` are real primitives with the semantics R4 used.
- R4's refusal to use Jev for `AC14` visual-fidelity scoring is correct and stays recorded.
- R2's REJECTED finding on `docs[].stage` is correct — that is the convention, not a defect.
**Findings (cold read of v4):**
- R5-F1 `CONTRADICTION` `contracts.description_cue.source_frame_ms: int` vs `limits.ad.frames_per_gap_max: 3` (R2-F3). Since v2 a cue can be produced from up to three frames, and the contract still records exactly one. Failure: the pipeline emits a cue built from the midpoint plus two per-shot frames and has nowhere to write two of them; whoever writes `C8`/`C10` picks a rule (first? midpoint? last?) in doc 02, and the track cannot be audited against the picture afterwards. Fix in the registry: `source_frames_ms: array<int>`.
- R5-F2 `CONTRADICTION` `decisions.verbosity_levels` states the pipeline regenerates the track per level and 'the app selects the matching track at runtime', but `contracts.description_track` carries no verbosity field and nothing states how the app locates the other two files. Failure: `C6` loads a track and cannot tell which level it is; the naming scheme gets invented in doc 02, where it is invisible to `sync` and to the audit. Fix: `verbosity: 'concise | standard | detailed'` on `description_track`, plus the lookup rule stated once.
- R5-F3 `FUNCTIONAL` `C15` rewrites cue text (`the woman` -> `Isabelle`) AFTER `C9` bounded it to `limits.ad.max_words_per_cue` and BEFORE `C10` synthesises it. Normalization changes the word count, so a cue that fit its gap can stop fitting. Failure: a normalized cue overruns its gap and talks over the next line of dialogue — the exact thing `AC4` forbids and the premise the word budget exists to protect. Fix: `C15` re-checks the budget after rewriting and either re-bounds or returns the cue to `C9`; state which.
- R5-F4 `CONTRADICTION` `AC20` (`decisions.user_validation`) requires a blind or low-vision participant, which is a dependency on a person outside the team. `owners.external` still reads 'none — solo entry', `tracking.blocked_by` is still `null`, and doc 01 §3.3 still reads 'None external — this is a solo entry and nothing in the plan waits on another party'. Failure: recruitment starts when Phase 5 starts, the participant is not found in three days, and either `AC20` is dropped at the deadline or the submission slips. Base gap sweep, §New dependency on an external owner: it needs `blocked_by:`, a named owner and a date on THEIR clock.
- R5-F5 `FUNCTIONAL` (scope vs the clock) v1 -> v4 added two components (`C15`, `C16`) and nine acceptance criteria (`AC14`..`AC22`), and **not one phase date moved**. Two concentrations are now implausible: Phase 4 (10-16 -> 10-19, four days) holds a full-length cue-by-cue 1–5 watch of a feature film plus the VoiceView pass plus regeneration of the worst cues; Phase 5 (10-20 -> 10-22, three days) holds a recruited user session, a custom gap-visualization render, the friction-log close-out, the product feedback and the submission itself. Failure: the submission buffer (10-22, one day before the deadline) is consumed first, and the deadline is `limits.hackathon.submission_deadline` — hard. Fix is a choice, not an edit: move dates, or cut scope, or accept in writing that the buffer is gone.
- R5-F6 `JUDGMENT` (recommendation, the owner decides) `C15`/`C16` are the cheapest scope in the set to defer. Both are offline-only, so neither risks the device path; the endpoint is real and the primitives fit. But each problem already has a mitigation (naming drift: `decisions.dramatis_personae` + `limits.ad.rolling_context_cues`; subtitle injection: delimited data + shape validation, over a subtitle file the author chooses and controls), a third non-Amazon vendor adds a key and a setup step to a repo judges must run, and `tech implementation` is scored on effective use of the REQUIRED tech. Recommended: `kind: deferred`, `deferred_because: decisions.typesafe_judgment_layer`, `reopens_when: 'Phase 1 closes with the pipeline green before 09-30'`. Keeps the idea and returns Phase 1 to `C7`..`C10`.
**Edits:** none — this is a review round.
**Still open:** everything R4 left open, plus R5-F1..R5-F5 awaiting disposition by the owner, and R5-F6 awaiting a decision.
**Next mode:** owner dispositions R5-F1..F6; the accepted ones land in `_facts.yml` first (never in prose first), then `sync`, then `audit`. `status:` stays `draft` until then.

---

## R6 · 2026-09-19 · claude-opus-5 (Claude Code) · validate (R5 dispositions landed)
**Read:** `_facts.yml` (583 lines, blob acd3e70) · `01-master-plan.md` (231 lines, blob 73ad22d) · `_log.md` (through R5 end)
**Log read through:** R5
**Dispositions (R5 findings, decided by the owner):**
- R5-F1 → **confirmed**. `contracts.description_cue.source_frame_ms: int` → `source_frames_ms: 'array<int>'`; `C10` now states that each cue records every frame it was built from; doc 01 §4 JSON block and its explanatory paragraph updated.
- R5-F2 → **confirmed**. `contracts.description_track` gains `verbosity: 'concise | standard | detailed'`; the lookup rule (`<asset_id>.<verbosity>.track.json` beside the asset, fallback `standard`) is authored once in `decisions.verbosity_levels` and quoted in doc 01 §4.
- R5-F3 → **confirmed**, carried with the deferral. The word-budget re-check is written into `C15.reopens_when` so the constraint travels with the entry instead of being rediscovered when it returns.
- R5-F4 → **confirmed**. `owners.external` names the validation participant; `tracking.blocked_by` states they run on their own clock; `decisions.user_validation` opens recruitment in Phase 0 with a drop-dead date of 10-16 and an explicit drop rather than a slip; doc 01 §3.2 Phase 0, §3.3 (rewritten — it had claimed nothing external existed), §7 and §8 follow.
- R5-F5 → **accepted in writing**, not fixed. New `decisions.schedule_risk_accepted` (`accepted_by: César Rivas`, 2026-09-19) records that the dates stand, the 10-22 buffer is spent, and names the order of sacrifice: AC19 degrades to a static diagram, then AC20 is dropped, then AC14 drops to a stratified sample; AC1..AC13 and the submission never yield. Doc 01 §3.2 and §8.
- R5-F6 → **confirmed**. `C15`/`C16` → `kind: deferred` with `deferred_because: decisions.typesafe_judgment_layer` and `reopens_when: 'Phase 1 closes green before 09-30'`. `decisions.typesafe_judgment_layer` gains `status: deferred`, `why_deferred:` and `reopens_when:`; `limits.typesafe` gains `status: inactive`. Design and the verified endpoint stay in the registry so a reopen starts from a checked fact, not a memory.
**Trim walk (base gap sweep §Trimming scope), forced by R5-F6:**
- `acceptance[]` — `AC21`/`AC22` named `C15`/`C16` and nothing could have satisfied them once those were deferred. Removed, with a comment in place stating they return verbatim if the reopen fires. This is the exact failure the sweep documents: a criterion that survives a trim unreviewed.
- `decisions.*` — no other decision rested on the TypeSafe layer. `decisions.dramatis_personae` justified itself on its own terms (rolling context drift) and does not lose its rationale; checked rather than assumed.
- Doc 01 rows that had promoted `C15`/`C16` as active mitigations (§8 pronoun drift, §8 injection, §5, §6 cost) were rewritten to say what the defence actually is now — a single layer, and it says so.
**Edits:** `_facts.yml` (641 lines, blob 39cfe4c — revisions v5) · `01-master-plan.md` (243 lines, blob fc3c081 — changelog v5, §2, §3.1, §3.2, §3.3, §4, §5, §6, §7, §8)
**Validation:** `yaml.safe_load_all` ok (edited as text, never round-tripped) · `python3 scripts/audit.py docs/features/interstice/` → clean, every mechanized check passed, stage draft, 2 docs not due yet.
**Still open:** `D3`/`D2`/`D1` `open` awaiting the Phase 0 spike · `tests_baseline` `aborted_no_conditions` · `limits.hackathon` `asserted` against the rules page · `limits.bedrock`/`limits.polly` `unknown` until the first pipeline run · `limits.typesafe` inactive · the `AC20` participant unidentified, with 10-16 as the drop-dead date.
**Next mode:** owner confirmation of R6, then `status: draft -> reviewed`, then `implement` (docs 02 and 03).

---

## R7 · 2026-09-19 · claude-opus-5 (Claude Code) · stage flip
**Read:** `_facts.yml` (641 lines, blob 39cfe4c) · `_log.md` (through R6 end)
**Log read through:** R6
**Stage:** draft → reviewed — confirmed by César Rivas in session on 2026-09-19, after R6 reported its dispositions. The flip IS the record of that confirmation; it was not inferred.
**Preconditions checked before flipping (`SKILL.md` §implement, all three refused-not-warned):**
1. `review` ran (R5) and every finding carries a disposition in this log (R6): F1/F2/F3/F4/F6 confirmed, F5 accepted in writing with an expiry-bearing order of sacrifice.
2. Owner confirmation obtained in session, recorded by this flip.
3. Every `changes[]` entry carries a `kind:` — verified mechanically, 16/16, none missing. The three `deferred` entries (`C11`, `C15`, `C16`) each carry `deferred_because:` and `reopens_when:`.
**Dispositions (R6 open items):** all stand unchanged — `D3`/`D2`/`D1` `open` awaiting the Phase 0 spike; `tests_baseline` `aborted_no_conditions`; `limits.hackathon` `asserted`; `limits.bedrock`/`limits.polly` `unknown`; `limits.typesafe` inactive; the `AC20` participant unidentified with 10-16 as drop-dead.
**Edits:** `_facts.yml` (642 lines, blob c91a927 — `status: draft` → `reviewed`, revisions v6). No prose edits: doc 01 carries `status` in its header line, updated by `sync` in the same round.
**Expected audit change:** docs 02 and 03 carry `stage: reviewed` and the set has now reached that stage, so they come into scope and their absence becomes a real finding rather than 'not due yet'. That is correct and stays open until `implement` writes them.
**Still open:** everything R6 left open, plus docs 02 and 03 now due.
**Next mode:** `implement interstice` — writes `02-implementation-and-e2e.md` and `03-stakeholder-requirements.md`, covering every item the last audit listed under pending downstream coverage.

---

## R8 · 2026-09-21 · claude-opus-5 (Claude Code) · implement (docs 02 / 02b / 03)
**Read:** `_facts.yml` (642 lines, blob c91a927) · `01-master-plan.md` (243 lines, blob 4ca22a5 — R7 flipped the header `Status:` line to `reviewed` but recorded no hash for it; this is that hash) · `_log.md` (158 lines, blob d5d8b41, through R7 end) · `docs/features/_profile.yml` (34 lines, blob d319072) · skill `references/implementable.md`, `references/doc-pattern.md`, `templates/02-*.tpl`, `templates/03-*.tpl`
**Log read through:** R7
**Preconditions re-checked at the top of this round (SKILL.md §implement, refused-not-warned):** all three still hold as R7 recorded them — `review` ran (R5) with every finding dispositioned (R6); `status: reviewed` is on disk as the owner's confirmation; 16/16 `changes[]` carry `kind:`.
**Dispositions (R7 open items):** all stand — `D3`/`D2`/`D1` `open` awaiting the Phase 0 spike; `tests_baseline` `aborted_no_conditions`; `limits.hackathon` `asserted`; `limits.bedrock`/`limits.polly` `unknown`; `limits.typesafe` inactive; `AC20` participant unidentified, drop-dead 10-16. This round resolves no hypothesis — it writes the build docs around them.
**About to write (stub opened BEFORE generating, per protocol — this mode produces ~75% of the set's prose and a round that dies partway leaves files no entry accounts for):**
- `02-implementation-and-e2e.md` — preamble + Part A phases 0–6 (repo scaffold, profile fill, pipeline `C7`..`C10`).
- `02b-app-and-delivery.md` — Part A phases 7–17 (`C6`,`C3`,`C4`,`C5`,`C2`,`C1`, then the `[MANUAL]` deliverables `C12`/`C13`/`C14`), Part B test plan, Part C E2E, the Definition of Done, and the coverage map against doc 01's checklist. Split decided up front per `references/doc-pattern.md` §Splitting an oversized doc — one file carrying both halves lands well past the ~600-line threshold, and the split is cheaper before the prose exists than after.
- `03-stakeholder-requirements.md` — the submission package as handed over, per `docs[] 03 note:`.
- `_facts.yml` — register `02b` in `docs[]`; `01-master-plan.md` — the `Related documents` list and the header `External owner:` line, which still reads `none — solo entry` while `owners.external` has named the `AC20` participant since R6 (a check-1 wording drift the script cannot see).
**Known constraint carried into the writing, stated here so no later round re-derives it:** `_profile.yml commands.tests`/`tests_expect`/`lint`/`build`/`device_log`/`force_stop` are all `null` and the repo holds no application code, so no phase can cite a real test command yet. Doc 02 makes filling the profile its own numbered phase with a *measured* pass line (copied from a real run, never guessed), and every later `Phase N verification:` cites the profile key rather than a command invented for the doc. Vega OS platform API names are likewise unverified (`D3` open), so the platform binding is isolated behind an adapter interface owned by this spec and its Vega implementation is a `[MANUAL]` phase filled from the Phase 0 spike output — that also makes the `A4` Fire OS fallback a one-file swap.
**Findings raised and landed BY this round (writing paste-ready code is itself a review pass — this is what it found):**
- R8-F1 `CONTRADICTION`, landed in the registry before a line of the code was written. `limits.ad.verbosity_scales.detailed: 1.35` was clamped by `decisions.verbosity_levels`' phrase "never exceeding the gap budget", read as `limits.ad.max_words_per_cue`. Under that reading `detailed` clamps back to `standard` on every single cue and the two track files come out byte-identical — `AC17` ("three verbosity levels … rescale `max_words_per_cue` … and are demonstrated in the demo") is then impossible to satisfy, because two of the three demos are the same file. Invisible to every prior round and to the mechanical audit: both halves lived in the registry and the prose copied them faithfully, exactly like R5-F1/R5-F2. Fix: new `limits.ad.hard_ceiling_words: 'floor((gap_ms - 200) / 1000 * 160 / 60)'` — it subtracts only `duck_ramp_ms`, because the ramp is physically required and the remaining 100 ms of margin is precisely what `detailed` is allowed to spend. `limits.ad.note` states the trap; doc 01 §2, §8 and doc 03 Annex A carry it; `02` Phase 2 implements it and `02e` §B.1 asserts the three levels are strictly distinct with the `Fails if:` naming this exact mutation.
- R8-F2 `DRIFT`, doc 01 header. `- **External owner:** none — solo entry` had been false since R6, when `owners.external` was given the `AC20` participant. §3.3 was rewritten then and the header line was not. A check-1 wording drift no script can see. Fixed.
- R8-F3 `POLISH`, doc 01 changelog was oldest-first while `references/doc-pattern.md` §Changelog discipline says newest-first. Flipped; no content changed.
**Deviation from the plan in this round's own stub, stated rather than quietly executed:** the stub said two files (`02` + `02b-app-and-delivery.md`). The result is **five**. Both drafts tripped `audit` check 17 at 1030 and 1200 lines. This is a greenfield build — there is no existing code, so every phase carries a whole file — and the rule's remedy is explicit: split, never summarise, because compression destroys the resolved paths and paste-ready blocks that make doc 02 worth reading. Cut on top-level phase boundaries, reading order preserved, the preamble in `02` and not duplicated, every cross-file ref carrying its doc prefix.
**Edits:**
- `_facts.yml` (676 lines, blob 85e39ce — revisions v7; `limits.ad.hard_ceiling_words` + rewritten note; `docs[]` now registers five implementation files with a `note:` each)
- `01-master-plan.md` (251 lines, blob 7d0a814 — v7 changelog, changelog order flipped, `External owner` line, `Related documents` list, §2 clamp sentence, §8 verbosity risk row)
- `02-implementation-and-e2e.md` (507 lines, blob 6be2ddc — preamble governing all five + Part A Phases 0–3: `[MANUAL]` spike gate, repo scaffold that fills `_profile.yml commands.*`, `pipeline/types.ts` + `pipeline/budget.ts`, `C7`)
- `02b-pipeline-model.md` (549 lines, blob 42f040e — Phases 4–6: `C8`, `C9`, `C10` + `pipeline/run.ts`)
- `02c-app-playback.md` (586 lines, blob 99ef49a — Phases 7–11: `src/platform/MediaAdapter.ts`, `C6`, `C3`, `C4`, `C5`)
- `02d-screens-and-delivery.md` (376 lines, blob b07ca97 — Phases 12–17: `C2`, `C1`, `C12`/`C13`/`C14`, instrumentation removal)
- `02e-tests-and-done.md` (311 lines, blob 3378719 — Part B, Part C, Definition of Done, coverage map)
- `03-stakeholder-requirements.md` (243 lines, blob be66802 — §A judging panel, §B `AC20` participant, Annex A on the word budget)
**Design decisions taken inside doc 02 that a later round must not re-derive:**
- **`src/platform/MediaAdapter.ts` is a seam this spec owns, not over-engineering.** `D3` is `open` and `alternatives[A4]` reopens *immediately* if it dies. With the seam that reopen is one new directory; without it, six files rewritten under deadline. `02c` Phase 7's verification is the structural one: `rg -n "from '.*platform/vega" src/ --glob '!src/platform/**'` must return nothing.
- **`src/platform/vega/index.ts` ships as a `[MANUAL]` stub that throws.** Every symbol in it is a Vega OS API name and none has been observed on this machine. Writing it before the Phase 0.1 spike would be an invented fact that six files then build on — the failure `_profile.yml`'s `null` commands exist to prevent, in a different costume.
- **`pipeline/limits.ts` was renamed `pipeline/budget.ts`.** `limits.ts`/`limits.js` collide with the registry key `limits.*` and `audit` check 21 reads every one of them as a citation of a registry id that does not exist. The rename removes the collision at zero cost.
- **`02e` §B.0 states a deviation rather than faking compliance:** `references/implementable.md` requires the mock preamble be copied verbatim from a real test in this repo and the source file named. No such file exists (`tests_baseline.evidence.outcome: aborted_no_conditions`). The preamble is therefore *established* by the doc, and `02` Phase 1 is where it first executes.
- **`AC9` is recorded as out of scope, not dropped.** `C11` is `kind: deferred`, so the criterion is vacuously true; `02e` says so in the Definition of Done and in the coverage map. A criterion that silently disappears between plan and submission is what a careful reader notices.
**Validation:** `yaml.safe_load_all` ok (registry edited as text, never round-tripped; every replacement asserted `count == 1`) · all 20 `acceptance[]` items verified present verbatim in the `02e` Definition of Done · all 29 `01` §7 checklist items verified present **verbatim** in the `02e` coverage map (the left column is now generated from doc 01's own text, so check 5 is mechanical from here on) · `python3 scripts/audit.py docs/features/interstice/` → **0 contradictions, 0 drift, 3 polish**. The three polish are check 17 "approaching the split threshold" on the 507/549/586-line halves; splitting further would put one phase per file and is refused. The 25 remaining candidates are check 4 (every one is a filename-qualified `01-master-plan.md §N`, the form `references/doc-pattern.md` §Cross-reference rules explicitly allows — judged, not findings) and check 8 (two fences that are `package.json`/`tsconfig.json` file content, and one ```http fence whose paragraph names `_facts.yml endpoints` two words earlier).
**Still open — unchanged by this round, which wrote documents and resolved no hypothesis:** `D3`/`D2`/`D1` `open`, awaiting the Phase 0 spike · `tests_baseline` `aborted_no_conditions` and `_profile.yml commands.tests`/`tests_expect`/`lint`/`build`/`device_log`/`force_stop` all `null` until `02` Phase 1 and `02d` Phase 13.1 fill them **from real runs** · `limits.hackathon` still `asserted` against the rules page, to be re-read by hand before `02d` Phase 16.8 · `limits.bedrock.invoke_rate_per_account` and `limits.polly.chars_per_request` `unknown` until `02b` Phase 6.2 · `worst_case` all-`null` until `02b` Phase 6.1 · `limits.typesafe` inactive · the `AC20` participant unidentified, drop-dead **10-16**.
**Next mode:** execute `02` Phase 0 — `D3` first, before anything else in this repository. It is the only hypothesis whose failure invalidates the platform choice rather than a feature, and the plan gives it until **09-22**. When Phase 0 closes, `sync interstice` propagates the measured `defects[].outcome` and the filled `_profile.yml commands.*` into every doc that cites them.

---

## R9 · 2026-09-22 · claude-opus-5 (Claude Code) · execute `02` Phase 1 (repo scaffold + profile fill)
**Read:** `_facts.yml` (676 lines, blob 85e39ce) · `02-implementation-and-e2e.md` (507 lines, blob 6be2ddc) · `docs/features/_profile.yml` (34 lines, blob d319072) · `_log.md` (195 lines, blob e9c7f0e, through R8 end)
**Log read through:** R8
**Dispositions (R8 open items):** all stand. `D3`/`D2`/`D1` still `open` — **Phase 0 has NOT run**, it is `[MANUAL]` and waits on the owner (Vega SDK install, AWS account, `AC20` recruitment, asset choice). This round executes Phase 1 only, which the spec makes independent of Phase 0: the scaffold needs no account and no device.
**About to write (stub opened before editing, per protocol):** `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore` at the repo root, then `npm install` and a **real** `npm test` run whose literal output fills `_profile.yml commands.tests_expect` and re-measures `_facts.yml tests_baseline` from `aborted_no_conditions` to `basis: measured`. No value below is typed from memory; each is copied from output.
**Environment observed this round (recorded because three later phases depend on it and none of it was verified before):** `node --version` → `v24.16.0` · `npm --version` → `11.13.0` · `ffmpeg -version` → `ffmpeg version 8.1` · `ffprobe -version` → `ffprobe version 8.1`. That settles the `[MANUAL]` prerequisite `02b` Phase 4 states ("`ffmpeg -version` must print a version"), ahead of the phase that needs it. No friction entry: it was already installed.
**Findings raised BY executing the phase (running a spec is a review of it — this is what ran):**
- R9-F1 `CONTRADICTION`, and it kills `AC17`. **R8-F1 was the right diagnosis and the wrong fix.** R8 added `limits.ad.hard_ceiling_words` (subtracting only `duck_ramp_ms`) so the ×1.35 `detailed` scale would have room above `max_words_per_cue`. Running the arithmetic before writing the test showed the clamp changes nothing: 100 ms at 160 wpm is **0.27 words**, so it never crosses a floor boundary. `standard == detailed` at 1500 / 2000 / 3000 / 5000 / 8000 ms — every gap size the film produces. Two of the three track files would still have come out identical and `AC17` would still have been undemonstrable.
  Root cause, stated so a fourth round does not re-derive it: **the gap is a physical bound and no verbosity level can exceed it**, so a scale above 1.0 is unreachable by construction and no clamp can rescue one. Fix: `limits.ad.verbosity_scales` become **targets as a fraction of one ceiling** — `{ concise: 0.6, standard: 0.85, detailed: 1.0 }` — and `limits.ad.hard_ceiling_words` is removed as an orphan. Verified distinct at ten gap sizes from 1500 ms to 12000 ms before the registry was touched. `decisions.verbosity_levels.what` rewritten (target vs ceiling), `limits.ad.note` now records **both** failed attempts (R3's ×1.35, R8's clamp) with the arithmetic that killed each.
  Propagated: doc 01 §2 and the §8 verbosity row · `02` Phase 2 (`wordBudget`/`hardCeilingWords` replaced by `wordTarget`/`wordCeiling`; `wordCeiling` deliberately takes **no** `Verbosity` argument, which is the type-level statement that the gap is the gap) · `02b` Phase 5 (the `C9` prompt now asks for the target and validates against the ceiling, two different numbers) · `02e` §B.1 and §B.2 · doc 03 Annex A.
- R9-F2 `SECURITY`, found by `npm audit` on the first real install. `02` Phase 1 pinned `vitest ^2.0.0` — written from the author's knowledge, never installed. It reports **5 vulnerabilities, 1 critical**: a path-traversal / arbitrary-file-read advisory reaching `vitest` through `@vitest/mocker`, plus an `esbuild` dev-server advisory through `vite`. `limits.hackathon.repo_must_be` makes this repository **public** and the judges clone and run it. Bumped to `vitest ^5.0.1` and `@types/node ^24.0.0` (node here is v24), wiped `node_modules` + lockfile, reinstalled → `found 0 vulnerabilities`. `npm audit` is now a step of Phase 1 and of its verification line, not a courtesy.
- R9-F3 `FUNCTIONAL`, doc 02 Phase 1 was unexecutable as written. It said "there are no tests yet, so the run reports zero — that is fine and it is still a real run". It is not: `vitest run` with no test files prints `No test files found, exiting with code 1` and **exits 1**. There is no pass line, so `tests_expect` could not be measured from an empty repository — the phase's own deliverable was unreachable from inside the phase. Fix: Phase 2's first test is now stated as a **precondition of finishing Phase 1**, and `--passWithNoTests` is explicitly rejected in the doc — it produces a green line that proves nothing, a worse oracle than none.
**Work done (code, not spec):**
- `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore` — new, repo root. `npm install` → 72 packages, `npm audit` → `found 0 vulnerabilities`.
- `pipeline/types.ts`, `pipeline/budget.ts` — **extracted programmatically from the `02` Phase 2 fenced blocks**, not retyped, so doc and code cannot diverge on day one.
- `pipeline/__tests__/budget.test.ts` — 6 tests. The `AC17` assertion loops over ten gap sizes rather than spot-checking one, because a single spot-check at one gap is exactly what hid the collapse in R3 and again in R8.
- `FRICTION-LOG.md` — opened per `02` Phase 0.7 with the two entries this round generated, in the `decisions.friction_log_shape` shape. Amazon-tool entries and toolchain entries are kept in separate sections so the Vega/Bedrock/Polly feedback the bonus is scored on is not diluted by things Amazon cannot act on.
**Measured this round (every value copied from output, none typed from memory):**
- `node --version` → `v24.16.0` · `npm --version` → `11.13.0` · `ffmpeg`/`ffprobe` → `8.1` (settles the `[MANUAL]` prerequisite `02b` Phase 4 states, ahead of the phase that needs it; no friction entry — already installed)
- `npm test` → exit **0**, `Test Files  1 passed (1)` / `Tests  6 passed (6)`
- `npm run lint` (`tsc --noEmit`) → exit **0**, no output
- **Mutation check, same day:** restoring the R3/R8 scales (`standard: 1.0`, `detailed: 1.35`) in `pipeline/budget.ts` turns **2 of the 6 red**, then restoring `0.85`/`1.0` turns them green again. The `Fails if:` line in `02e` §B.1 is a real oracle, not decoration — recorded because a parity assertion that has never been seen to fail is a parity assertion nobody has verified.
**Edits:** `docs/features/_profile.yml` (41 lines, blob 4f28845 — `commands.tests`/`tests_expect`/`lint` filled from the run; `build`/`device_log`/`force_stop` still `null`, correctly, because Phase 0.1 has not run) · `_facts.yml` (689 lines, blob 6e7d4a3 — revisions v8; `verbosity_scales` rewritten; `hard_ceiling_words` removed; `decisions.verbosity_levels.what` rewritten; `tests_baseline` `asserted`/`aborted_no_conditions` → **`basis: measured`** with cmd, exit code, value and the mutation note) · `01-master-plan.md` (255 lines, blob 0449971) · `02-implementation-and-e2e.md` (523 lines, blob db8e331) · `02b-pipeline-model.md` (551 lines, blob 45bff51) · `02e-tests-and-done.md` (312 lines, blob 26f32c6) · `03-stakeholder-requirements.md` (244 lines, blob 167cc55)
**Validation:** `yaml.safe_load` on the profile and `yaml.safe_load_all` on the registry, both ok, both edited as text · every replacement asserted `count == 1` · `python3 scripts/audit.py docs/features/interstice/` → **0 contradictions, 0 drift, 3 polish** (the same three check-17 "approaching the threshold" notices on the 513/551/586-line halves).
**Not done, and not started:** nothing in Phase 0 that needs the owner — `D3` (Vega SDK + simulator), `D2`, `D1`, the AWS account and credits request, the `AC20` recruitment, the demo-asset choice. All three defects remain `open` with `outcome: null`. **Phase 1 was executable without any of them, which is why it went first; Phase 2 onward is not** — `02b` Phase 5 needs Bedrock credentials and `02c` Phase 7 needs the Vega API surface that only `D3` reveals.
**Next mode:** `D3` — Vega SDK install and simulator, on the owner's clock. `02` Phase 0.1. It is the only hypothesis whose failure invalidates the platform rather than a feature, and `01-master-plan.md` §3.2 gave Phase 0 until **09-22**, which is today. Everything buildable without an account or a device is now built.

---

## R10 · 2026-09-22 · claude-opus-5 (Claude Code) · measure (AWS reachable, Bedrock is not, rules re-read)
**Read:** `_facts.yml` (689 lines, blob 6e7d4a3) · `_log.md` (224 lines, blob 5bbd2ca, through R9 end) · `docs/features/_profile.yml` (41 lines, blob 4f28845) · the hackathon **rules** and **resources** pages, fetched this round through the read proxy
**Log read through:** R9
**Dispositions (R9 open items):** `D3`/`D2`/`D1` still `open` — the Vega SDK is still not installed. `limits.bedrock`/`limits.polly` were `unknown`; this round measures what it can of both. `limits.hackathon` was `asserted` since R1 and is re-read here. `worst_case` still all-`null`.
**About to write (stub opened before editing, per protocol):** turn this round's measurements into registry entries — the hackathon numbers from `asserted` to `measured`, two corrections to facts that were written wrong, `D4` (Bedrock account authorization) as a new measured defect, `A5` as its alternative, and the AWS credit request recorded as done.
**Measured this round (every value from output; the proxy command is re-runnable, which is what makes these `measured` and not `asserted`):**
- `curl -sS --max-time 45 https://r.jina.ai/https://amazonappdev2026.devpost.com/{rules,resources}` → both pages retrieved. R1 could not do this: a direct `curl` to devpost returns HTTP 202 with an empty body, which is why the whole `limits.hackathon` block sat `asserted` for three days.
- `aws sts get-caller-identity` → the entrant AWS account, **root** principal (noted to the owner; root cannot be constrained by IAM policy, and the scoped IAM policy to replace it is written but not applied — not blocking).
- `aws polly synthesize-speech --engine neural --voice-id Joanna` → `ContentType: audio/mpeg`. **Polly works.**
- `aws bedrock list-foundation-models --region us-east-1` → 115 models; three Amazon multimodal: `amazon.nova-pro-v1:0` and `amazon.nova-lite-v1:0` (ON_DEMAND + INFERENCE_PROFILE), `amazon.nova-2-lite-v1:0` (**INFERENCE_PROFILE only** — a bare model id fails on it; recorded because it is the newest and the one a later round reaches for by name).
- `aws bedrock-runtime invoke-model` and `converse`, three regions → **all refused**, `Error 002: Access to Bedrock models is not allowed for this account`. See `D4`.
**Findings landed this round:**
- R10-F1 `CONTRADICTION`, wrong since R1. `limits.hackathon.repo_must_be` read `'public, open-source licensed, with setup instructions'`. The rules allow **either** public with a detectable license file **or** private shared with `testing@devpost.com` and six named Amazon Developer Relations GitHub accounts. Not cosmetic: it is the difference between a hard constraint on where credentials and assets may live and a free choice. `decisions.docs_in_english` had leaned on "the repository is necessarily public" as its first reason; doc 01 §1 now says the decision stands on its second reason, which was always the load-bearing one.
- R10-F2 `DRIFT`. The AWS credit form has **two different URLs** — rules `forms.gle/5hyhr1u6x3fuV2aW7`, resources `forms.gle/GaHFxSbBQNG9Kti6A`. `limits.hackathon.aws_credits_form` records the rules one because the rules are the contract, and the note records the discrepancy so a later round finding the other link does not assume this one is a typo.
- R10-F3 `SECURITY`/`FUNCTIONAL`, and the largest of the round: **`D4`** — Bedrock refused at account scope. The first `basis: measured` defect in this set. Four explanations ruled out by measurement rather than by argument: not regional (three regions, same error) · not the API shape (InvokeModel and Converse, same error) · not the retired Model-access page (models auto-enable on first invoke; the first invoke is what fails) · not the credentials or account state (Polly works on the same root session; account ACTIVE since 2018; not in an Organization, so no SCP). Leading hypothesis, unconfirmed and recorded as such: Bedrock carries country restrictions other AWS services do not, and this account falls outside the region list that carries it. Authoritative answer is an AWS Support case. **Working around a geographic restriction is explicitly not under consideration** — the rules require the entrant to be authorised to use every third-party service per its terms.
- R10-F4, the relief, and it is measured too. **The AWS Builder mini challenge does not require Bedrock.** Rules and resources both say "incorporate AWS services with documented integrations", naming Bedrock/AgentCore/Strands/Kiro/SageMaker as examples followed by "and more". Polly satisfies it. So `D4` costs the vision model, not the mini challenge, and not the primary track. `decisions.hackathon_track` now says so, because thirty minutes of this round were spent treating `D4` as a $10,000 hole that it is not.
- R10-F5. `decisions.oss_package_scope` was a `decided` guess about what the Open Source mini would accept. The rules say "a new repo (with open-source license), a branch, a fork, or a pull request" — a standalone new repository is explicitly valid. Confirmed rather than assumed, and the four required submission fields (contribution URL, project repo URL, GitHub username, description) are now recorded for `C14` to collect.
- R10-F6. **Four Amazon references this set did not know existed**, all from the resources page, now in `related_docs[]` with `where: external`. Two of them change how open hypotheses get closed: **Amazon Devices Builder Tools** (`developer.amazon.com/docs/vega/0.24/mcp-server`) is an MCP server plus Agent Skills that put Amazon device knowledge into an AI coding assistant — the cheapest lever on `D3` that exists, and the path pins the SDK line at vega 0.24; and **`vega-video-sample`**, which the page describes as carrying a **W3C media player**, meaning standard media-element semantics and therefore a likely answer to `D2` and to the `VideoPlayer` half of `02c` Phase 7 by reading a sample instead of running a spike. `react-native-multi-tv-app-sample` (one codebase across Vega, Android TV, Apple TV and web) makes `alternatives[A4]` far cheaper than the spec priced it.
**New registry entries:** `defects[D4]` (`basis: measured`, blocking, with the ruled-out list) · `alternatives[A5]` non-bedrock-vision-provider (`outcome: open`, `depends_on: [D4]`, decide-by **09-30**, fallback ladder ordered cheapest first: organisers → another legitimately held account → another vision provider for `C9` only) · `related_docs[]` ×4 · `limits.bedrock.region`/`model_candidates`/`model_chosen`/`blocked_by` · `limits.polly.reachable`/`neural_voices_en_us`/`voice_chosen` · `limits.hackathon.aws_credits_form`/`aws_credits_requested`/`firetv_runtime_requirement`.
**Checklist item closed:** AWS promotional credits **requested 2026-09-22**, inside the 10-21 deadline. Doc 01 §7 is ticked. That is the first Phase 0 item to close and it is one of the two that run on someone else's clock.
**Audit corrections made in-round, recorded because the script caught what the author did not:** the four `related_docs[]` entries needed `where: external` (check 20 reads a URL as a repo path); and `alternatives[A5]` was written `basis: measured` when the measured thing is `D4` — the claim that another provider would work is a prediction, so it is `asserted` with a `falsified_by`.
**Edits:** `_facts.yml` (850 lines, blob f6cfb18 — revisions v9) · `01-master-plan.md` (271 lines, blob 474f443 — changelog v9, §1 repo requirement + the `docs_in_english` reasoning, §3.3 rewritten to two external dependencies, §7 credits ticked, §8 two new risk rows) · `FRICTION-LOG.md` (55 lines, blob d5c9623 — the **Amazon section has its first two entries**, which are the ones the 10% bonus is scored on: the undiagnosable `Error 002`, and the `aws login` 400 with no indication of which identity it expected. Both carry a `what would have helped` line, which is what turns a complaint into product feedback.)
**Validation:** `yaml.safe_load_all` ok, registry edited as text, every replacement asserted `count == 1` · `python3 scripts/audit.py docs/features/interstice/` → **0 contradictions, 0 drift, 3 polish** (the same three check-17 size notices).
**Still open:** `D3`/`D2`/`D1` — the Vega SDK is still not installed, and this is now the only thing standing between the set and real progress · **`D4`**, awaiting an AWS Support case or the organisers, decide by **09-30** · `AC20` participant unidentified, drop-dead **10-16** · `limits.bedrock.invoke_rate_per_account` and `limits.polly.chars_per_request` still `unknown` (the Bedrock one cannot be measured until `D4` clears) · `worst_case` all-`null`.
**Next mode:** the Amazon Devices Builder Tools MCP server (`related_docs[R-BUILDER-TOOLS]`), then `D3`. That reference did not exist in this set an hour ago and it is aimed precisely at the hypothesis that has blocked Phase 0 since 09-19.

---

## R11 · 2026-09-22 · claude-opus-5 (Claude Code) · D3 RESOLVED — Vega SDK installed, Virtual Device booted
**Read:** `_facts.yml` (850 lines, blob f6cfb18) · `docs/features/_profile.yml` (41 lines, blob 4f28845) · `_log.md` (through R10 end) · the Amazon Devices Builder Tools MCP docs and npm README · `install-vega-sdk.html` (raw HTML, because the read proxy strips the code fences and the installer command lives in one)
**Log read through:** R10
**Dispositions (R10 open items):** `D4` unchanged and still open — this round did not touch AWS. `AC20` unchanged. `D3` **resolves here**; `D2` and `D1` become testable for the first time and stay open.
**About to write (stub opened before editing, per protocol):** `defects[D3]` from `asserted` to `measured`, `alternatives[A4]` to discarded, `_profile.yml commands.build`/`device_log`/`force_stop` filled from real `--help` output, plus the doc 01 rows that priced `D3` as the most total risk in the set.
**Route in, and it did not exist in this set yesterday:** `related_docs[R-BUILDER-TOOLS]`, found by re-reading the resources page in R10. `npx -y @amazon-devices/amazon-devices-buildertools-mcp@latest init-context -a claude-code-cli -d -f` installed **15 Agent Skills** into `~/.claude/skills/`, live in-session without a restart. `-d` was deliberate: it skips the context document, so nothing could overwrite the user's own instructions — verified by checksumming `~/.claude/CLAUDE.md` before and after (`3d2ef7f…` unchanged). The MCP server itself is configured at **project scope** in `.mcp.json` rather than globally, and needs a session restart to load; the skills did not.
Three of the fifteen aim straight at open items: `amazon-devices-vega-setup-sdk` (used this round), `amazon-devices-vega-media-player` (W3C MSE/EME + the `VideoPlayer` component — `D2`, `D1`, `02c` Phase 7), `amazon-devices-vega-focus-management` (`TVFocusGuideView`, `FocusManager` — `AC2`, mobile-tv gap sweep F2). Also present and relevant: `vega-app-manifest` (**`manifest.toml` — a Vega requirement this spec never mentions; a real gap**), `vega-build-and-run`, `vega-developer-mode-init`.
**The installer was audited before it was run, not after.** `references/evidence.md` discipline applied to a third-party script: the documented path is `curl -fsSL https://sdk-installer.vega.labcollab.net/get_vvm.sh | bash` — a pipe-to-shell from a non-`amazon.com` domain. Downloaded instead, `sha256 0e5386581e5cf518202687213dd26d1b35e70242d1bd190cdea7096a99476ae0`, 58 KB, and read: no `sudo` anywhere; `rm -rf` only on its own temp dirs and install dir; network egress to `k-artifactory-external.labcollab.net` and `marketplace.visualstudio.com` only. Two things the user was told before consenting: **telemetry is on by default** (documented opt-out), and it **modifies five shell rc files**. Recorded so no later round re-audits the same bytes — re-audit only if the sha256 differs.
**Measured this round (every value from output):**
- `vega --version` → `Active SDK Version: 0.24.12112`, `Vega CLI Version: 1.3.4`
- `vega virtual-device start` → `Launching virtual device. Waiting for virtual device to boot. **Virtual device ready.**`
- `vega virtual-device status` → `{"running":true,"process_ids":{"qemu":68674}}`
- `vega device info` → `{"architecture":"aarch64","profile":"tv","product":"vvrp-tv-arm64","buildDescription":"OS 1.2 (TV Ship/102282480)","simulated":true,"inDeveloperMode":true}`
- `vega project list-templates` → `helloWorld` (**RN 0.83**), `helloWorld-rn72`, `basic-turbo-module`, `idl-turbo-module`, `vegaWebview`
- prerequisites before the install: macOS 26.7, Rosetta already present, Node v24.16.0; 5 of the 9 required Homebrew packages were missing (`gawk findutils grep jq gnu-sed`) and were installed
**`D3` → `basis: measured`, `status: resolved_partial`, and the "partial" is the point.** The claim is "the simulator installs and runs **and plays the demo asset**". The platform half is confirmed. The playback half is **not tested** — there is no app and no asset, so nothing has decoded video on this device yet; it closes with `AC1` in `02d` Phase 13. Rounding this up to a pass would let a later round skip the only test that proves the product can run at all. `alternatives[A4]` is discarded on the strength of `D3` and stays `basis: asserted`, because the measurement belongs to `D3` and not to it — the audit caught exactly that and it was corrected in-round.
**`_profile.yml` has no `null`s left in the commands that matter**, all read off real `--help` output: `build: "vega build"` · `device_log: "vega device start-log-stream | rg {log_tag}"` · `force_stop: "vega device terminate-app --appName {app_id}"`. Vega streams logs rather than exposing a filtered tail, so `{log_tag}` is applied by the pipe — recorded because it is not the shape the profile template assumes. **Every `Phase N verification:` line across `02`..`02e` now resolves.**
**Edits:** `_facts.yml` (880 lines, blob 9d0ddd6 — revisions v10; `defects[D3]` measured + resolved_partial; `alternatives[A4]` closed) · `01-master-plan.md` (281 lines, blob a9f6ece — changelog v10, §3.2 Phase 0 row, §7 checklist, §8 `D3` risk retired) · `docs/features/_profile.yml` (51 lines, blob b3f1d91) · `FRICTION-LOG.md` (73 lines, blob 3c7c458 — two more Amazon entries: the installer has no non-interactive mode and leaves a half-install when stdin is closed; and every command on the SDK install page is invisible to non-browser readers, with the documented URL a 404)
**Validation:** `yaml.safe_load` on the profile, `yaml.safe_load_all` on the registry, both ok · revision ordering corrected in-round (v10 had been inserted above v9) · `audit.py` → **0 contradictions, 0 drift, 3 polish**.
**Still open:** `D2` and `D1` — **testable for the first time**, and `amazon-devices-vega-media-player` plus `related_docs[R-VEGA-VIDEO]` mean both may be answerable by reading rather than by spiking · `D4` Bedrock, decide by **09-30** per `A5` · `AC20` participant, drop-dead **10-16** · `worst_case` all-`null` · **`manifest.toml` is a Vega requirement absent from `changes[]`** — a gap the new skills surfaced and the next round must close.
**Next mode:** `amazon-devices-vega-media-player` against `D2`/`D1`, then scaffold the app with `vega project generate` (`helloWorld`, RN 0.83) and close the playback half of `D3` with a real asset.

---

## R12 · 2026-09-22 · claude-opus-5 (Claude Code) · D1 RESOLVED FALSE, D2 re-aimed — by reading the API, not by spiking
**Read:** `_facts.yml` (880 lines, blob 9d0ddd6) · `_log.md` (through R11 end) · skill `amazon-devices-vega-media-player` · `@amazon-devices/react-native-w3cmedia@2.3.2` TypeScript declarations, downloaded with `npm pack` and read directly
**Log read through:** R11
**Dispositions (R11 open items):** `D3` stays `resolved_partial` — nothing here tests playback. `D4` untouched. `AC20` untouched. `D1` **resolves false here**; `D2` stays open but its design question is answered.
**About to write (stub opened before editing, per protocol):** `defects[D1]` to `measured` / false, `defects[D2]` re-aimed with the real API, a new `changes[]` entry for `manifest.toml`, and the measured Vega media API names that `02c` Phase 7 has to be rebuilt against.
**Method note, because it is the reusable part:** the skill says to read the docs through the MCP server, which needs a session restart. The types are better evidence than the prose anyway — **the `.d.ts` IS the API surface**, so a missing method in it is a measurement and not an opinion. `npm pack @amazon-devices/react-native-w3cmedia@2.3.2` and reading `dist/**/*.d.ts` answered in minutes what `01-master-plan.md` §3.2 had budgeted a device spike for.
**Measured this round — the `.d.ts` files, read directly:**
- **`D1` → FALSE.** The complete `VideoPlayer` surface is `initialize · deinitialize · deinitializeSync · setSurfaceHandle · clearSurfaceHandle · setMediaControlFocus · handleEvent · getVideoPlaybackQuality · videoWidth · videoHeight · width · height · poster · playsInline`. No frame accessor. A sweep of the whole package for `ArrayBuffer|Uint8|pixel|bitmap|capture|thumbnail` returns only EME key material and MSE `appendBuffer` — every one an **input**. The architecture explains it: `VideoPlayer` does not render itself; the app mounts a `KeplerVideoSurfaceView`, waits for `onSurfaceViewCreated`, and hands the handle to `setSurfaceHandle`. Pixels go decoder → native surface and are never in JS-reachable memory. **This is a property of the design, not a gap**, so it will not appear in a later SDK. `C11` moves from *pending a spike* to *permanently deferred for this build*, and its `reopens_when` is now known to be unsatisfiable on Vega. The diagnostic `log_line` was never emitted — the question died before it cost a device run, which is the cheapest possible outcome for a hypothesis the plan had budgeted a spike for.
- **`D2` → still open, but precise now.** Three things, none of which needed a device. (1) Ducking is W3C: `get volume()/set volume()` on `MediaPlayer`, so `limits.ad.duck_target_pct` is `player.volume = 0.25`. **But the setter is instantaneous — no ramp parameter exists anywhere in the surface** — so `limits.ad.duck_ramp_ms` must be a stepped fade in JS, and `02c` Phase 10 is wrong where it wrote `setVolumePct(pct, rampMs)` as though the platform ramped. (2) `AudioPlayer(audioType?, audioUsage?)` and `AudioUsageType.USAGE_ACCESSIBILITY = 5`, documented by the SDK as *"Audio Usage for Accessibility prompts"* — the platform has a first-class category for exactly this product. That does not prove concurrency, which is a runtime property, but it names the construction the test must use: testing under `USAGE_MEDIA` would test a different thing and could fail for the right reason. (3) `decisions.d2_fallback` is a **typed interface**, not a hope — `audioTracks: AudioTrackList`, `AudioTrack.enabled` (get/set). `D2` failing now costs per-cue granularity and nothing architectural.
**New scope:** `C17` `manifest.toml`, `kind: planned`. **Required by Vega and absent from this spec since R1.** The media stack reads services from `[wants]`, and a missing one causes *silent* playback failure — no video, no error. That is the worst failure shape this product can have, because silence is also what a broken description track looks like (`AC8`). Surfaced by the `amazon-devices-vega-media-player` skill; a gap sweep would not have found it, because nothing in the base or `mobile-tv` layer knows Vega has a manifest.
**New registry facts:** `limits.vega_media` (`basis: measured`) — package `@amazon-devices/react-native-w3cmedia@2.3.2`, the `VideoPlayer` and `MediaPlayer` member lists, the `AudioPlayer` construction, `USAGE_ACCESSIBILITY`, audio-track switching, the no-ramp finding, the component names (`KeplerVideoSurfaceView` + `onSurfaceViewCreated`), and the manifest requirement. All of it is what `02c` Phase 7 has to be rebuilt against.
**Audit corrections made in-round:** `defects[D1].evidence.cmd` used regex alternation (`(get |set )?`), which the one-symbol-per-scope-command rule forbids — replaced with a plain `cat` of the declaration file, which is unambiguous. `changes[C17]` was uncited until doc 01 §3.1 gained its row.
**Edits:** `_facts.yml` (995 lines, blob bf3779e — revisions v11) · `01-master-plan.md` (292 lines, blob 5635161 — changelog v11, §3.1 `C17` row, §7 `D1`/`D2` rows, §8 `D1` risk retired plus two new rows for the missing ramp and the silent-manifest failure)
**Validation:** `yaml.safe_load_all` ok · revision ordering corrected in-round again (v11 inserted above v10; same slip as R11 — **the insert anchor matches the newest tag, so prepending puts the new one first**; a future round should insert *after* the matched line, which is what both fixes did) · `audit.py` → **0 contradictions, 0 drift, 3 polish**.
**`02c` Phase 7 and Phase 10 are now STALE, and that is a scope change, not a data change.** `sync` cannot repair it — the skill is explicit that a changed plan is a changed shape. `MediaAdapter` was written against an invented interface while `D3` was open, which was right then; the real names are now in `limits.vega_media`. Re-entering `implement` for those phases needs `review` first, per SKILL.md §Re-entering implement after the plan moves.
**Still open:** `D2` concurrency — one device test, and the construction is now specified · `D4` Bedrock, decide by **09-30** per `A5` · `D3` playback half, closes with `AC1` · `AC20` participant, drop-dead **10-16** · `worst_case` all-`null`.
**Next mode:** `review interstice` over the moved scope (`C17` in, `C11` permanently out, `02c` Phases 7 and 10 stale), then regenerate those phases against `limits.vega_media`. Scaffolding the app with `vega project generate` can run in parallel — it needs none of that.

---

## R13 · 2026-09-22 · claude-opus-5 (Claude Code) · C7 run against a real film — premise holds, pipeline shape is wrong
**Read:** `_facts.yml` (995 lines, blob bf3779e) · `_log.md` (through R12 end) · `02-implementation-and-e2e.md` Phase 3
**Log read through:** R12
**Dispositions (R12 open items):** `D1` stays resolved false · `D2` stays open awaiting the runtime test · `D3` stays `resolved_partial` · `D4` untouched, decide-by 09-30 · `AC20` untouched.
**About to write (stub opened before editing, per protocol):** the measured gap structure of the demo asset, the asset decision itself, and two `limits.ad` entries the real data proved missing.
**What ran:** `pipeline/gaps.ts` (`C7`) extracted from `02` Phase 3 and compiled clean, then run against the real English subtitle track of *Tears of Steel* (`https://download.blender.org/demo/movies/ToS/subtitles/TOS-en.srt`, 4764 bytes, CC-BY). Nothing was mocked and no number below is estimated.
**Measured — the premise, on a real film:**
```
subtitle cues parsed      76
speech spans after merge  67   (9 overlaps merged — mergeSpeech fired, it was not decoration)
gaps >= 1500ms            38
dialogue                  136.2s  (18.6% of runtime)
describable               577.0s  (78.6% of runtime)
words @ standard          1250
```
Nearly four fifths of the film is silence this product can use. **The premise holds, and it is now evidence rather than a claim** — `01` §1 had asserted thin audio-description coverage and a workable gap structure since R1 with nothing behind it. `decisions.demo_asset_licensing` gains *Tears of Steel* as the chosen asset on that basis; *Elephants Dream* was not measured because ToS cleared the bar decisively and the comparison would have cost time and changed nothing.
Two things written speculatively in Phase 3 turned out to be load-bearing on the very first real file: the timestamp regex accepting both `,` and `.` (the Blender file is **SRT**, not WebVTT, and the plan had said WebVTT throughout), and `mergeSpeech` (**9 overlapping cues** — without it those become negative gaps that either crash or vanish silently under the `>=` filter, and the second is worse).
**R13-F1 `FUNCTIONAL`, and it changes the pipeline's shape: A GAP IS NOT A CUE.** Five of the 38 gaps run longer than 30 seconds and together carry **68% of all the words**; the longest is **167s with a 444-word ceiling**. One description covering 167 seconds is not a description, and `limits.ad.frames_per_gap_max: 3` means three frames for a minute and a half of film. The whole set had imagined a gap as a short interstice between two lines — the data says the words live in the long ones. New `limits.ad.max_cue_ms: 12000` splits a long gap into consecutive cue windows, each with its own frames and its own budget. Measured effect: **38 gaps → ~70 cues** (8 gaps split at 12s; the alternatives were 92 cues at 8s, 63 at 15s, 56 at 20s). `C7`, `C8`, `C9`, `C10` were every one written 1:1 and are re-scoped one-to-many in `changes[]`.
**R13-F2 `FUNCTIONAL`: some gaps are too short to say anything.** 13 of the 38 are 1.5–2.0s and yield **1–2 words** at concise verbosity. A two-word description costs a Bedrock call, a Polly call and an interruption, and delivers noise. New `limits.ad.min_useful_words: 3` drops the window instead. Consequence worth stating because it surprised me: **cue count now varies by verbosity level**, since concise drops more windows than detailed. `contracts.description_track` already carries `verbosity`, so a track legitimately declares what it contains — no contract change needed.
**R13-F3 `FUNCTIONAL`, open and assigned: the trailing gap is the credits.** Dialogue ends at 567s; the asset runs to ~734s; `C7` duly emits a 167-second gap over the credits with a 444-word ceiling. Describing credits is worse than useless. Recorded on `decisions.demo_asset_licensing` (it is a property of the asset, not of the pipeline) and due before Phase 1 closes — either an explicit content end or a rule that drops the trailing window.
**`worst_case` is no longer all-`null`**, which it had been since R1 with the note "none of them is guessable". The gap half is measured: 38 gaps, ~70 cues, **211 Bedrock calls** (70 × 3 levels + the cast pass). **The figure this set had been quoting was ~121** — it assumed one cue per gap and was low by 84%. `est_cost_usd` stays `null` and says why: `D4` means no call has ever been priced. `runtime_min: 12.2` is flagged **assumed, not measured** — `ffprobe` has run on nothing, and only the trailing gap depends on it.
**Edits:** `_facts.yml` (1070 lines, blob 2f56b5c — revisions v12; `limits.ad` +`max_cue_ms`/`min_useful_words` + a note explaining both from the data; `worst_case` measured; `decisions.demo_asset_licensing` chooses the asset and inherits the credits problem; `C7`..`C10` re-scoped) · `01-master-plan.md` (303 lines, blob 6ccd20c — changelog v12, §2 gains the gap-is-not-a-cue paragraph, §3.1 `C7`/`C8` rows, §6 cost corrected, §7 two asset items ticked, §8 new credits row) · `pipeline/gaps.ts` (109 lines, blob 0ddcc49 — extracted from `02` Phase 3, `tsc --noEmit` clean) · `assets/tears-of-steel.en.srt` (313 lines, blob 04a76fa — CC-BY, from download.blender.org)
**Validation:** `yaml.safe_load_all` ok · `npm run lint` exit 0 · `audit.py` → **0 contradictions, 0 drift, 3 polish**. Temporary analysis scripts were deleted rather than left in `pipeline/` — they are not in `changes[]` and an unregistered file in a scoped directory is the drift this set exists to prevent.
**Doc debt, now larger and stated rather than hidden:** `02` Phase 3 and `02b` Phases 4–6 join `02c` Phases 7 and 10 as stale. The pipeline ones are stale because the plan changed shape (1:1 → 1:many), the app ones because the platform API is now known. `sync` repairs neither. Per SKILL.md §Re-entering `implement`, this needs `review` first and then regeneration of those phases only.
**Still open:** `D2` concurrency, one device test with the construction specified · `D4` Bedrock, **decide by 09-30** · `D3` playback half, closes with `AC1` · credits bound on the asset, before Phase 1 closes · `AC20` participant, **drop-dead 10-16** · `est_cost_usd` and `runtime_min` unmeasured.
**Next mode:** scaffold with `vega project generate` (`helloWorld`, RN 0.83) — it needs none of the above and unblocks both `D2` and the `D3` playback half. Then `review` over the moved scope, then regenerate the stale phases against real paths.

---

## R14 · 2026-09-22 · claude-opus-5 (Claude Code) · app scaffolded, built, installed and RUNNING on the Vega Virtual Device
**Read:** `_facts.yml` (1070 lines, blob 2f56b5c) · `docs/features/_profile.yml` (51 lines, blob b3f1d91) · `_log.md` (through R13 end) · the generated `helloWorld` template
**Log read through:** R13
**Dispositions (R13 open items):** unchanged — `D2` awaits its runtime test (now possible), `D4` decide-by 09-30, credits bound open, `AC20` open. `D3`'s playback half advances but does not close.
**Method:** generated into the **scratchpad first**, not into the repo. That is what caught three profile errors before they were built on, and it is worth repeating: a generator that writes 19 files into your root is a generator you inspect somewhere else first.
**Measured — the app runs:**
```
npm run build   -> react-native build-vega --build-type Release
                   manifest.toml is valid, 0 errors
                   build/{x86_64,armv7,aarch64}-release/interstice_*.vpkg  (1.58 MB)
vega run-app    -> "Installed build/x86_64-release/interstice_x86_64.vpkg on emulator-5554"
                   "Successfully launched the app"
vega device is-app-running --appName com.cesarrivasp.interstice.main
                -> "com.cesarrivasp.interstice.main is running"
npm test        -> exit 0 · jest 4 passed (app) · vitest 6 passed (pipeline)
```
**THREE `_profile.yml` COMMANDS WRITTEN IN R11 WERE WRONG, and every one of them was read off `--help` rather than run.** This is the gap between a documented command and an executed one, and it is the reason the skill insists on the second:
- `build: "vega build"` → **`npm run build`**. `vega build` builds *native artifacts*; the React Native app is built by `react-native build-vega`. The SDK installer's own closing message said so and I read it as a synonym.
- `force_stop: "... --appName {app_id}"` → **`{component_id}`**. Device commands take the COMPONENT id, which is the package id plus `.main`. `--appName com.cesarrivasp.interstice` would have matched nothing and reported success-shaped silence. `_profile.yml` gains `component_id: com.cesarrivasp.interstice.main`, read off the generated manifest.
- `tests_expect: "Tests  6 passed (6)"` → **`"6 passed (6)"`**. `npm test` now runs two runners and jest prints first; the old string still matched but for the wrong reason.
**`C17` has its real shape, and one gap in it.** The generated `manifest.toml` is 25 lines: `schema-version = 1`; `[package]` with `id = "com.cesarrivasp.interstice"` (matches `decisions.product_name`); `[os.version] min = target = "1.2"` (matches the device's `OS 1.2`); `[needs]`/`[[needs.module]]` `/com.amazon.vega.os@IVega_1_2`; `[[components.interactive]]` with the `.main` id, `runtime-module` `react_native_kepler_4`, `launch-type = "singleton"`, `categories = ["com.amazon.category.main"]`. **It has no `[wants]` section** — which is exactly where the media services go, per `limits.vega_media.manifest_requirement`. Adding it is `C17`'s real work, and the failure it prevents is silent: no video, no error.
**Structural decision taken, and it is a registry-level one: THE VEGA APP OWNS THE REPOSITORY ROOT.** Metro, `react-native build-vega` and `manifest.toml` all assume it, and fighting that costs more than it buys. `pipeline/` stays beside it as Node code the app never imports — which is what the `02` preamble already required, now enforced by two tsconfigs rather than by intention. Consequences: `pipeline/tsconfig.json` is its own (`ES2022`, node types, `noEmit`); `vitest.config.ts` narrowed to `pipeline/__tests__` so it cannot collide with the app's `src/`; `npm test` = `test:app` (jest) + `test:pipeline` (vitest); `npm run lint` = eslint for the app + `tsc --noEmit` for the pipeline. **Two test runners in one repository is not an accident** — jest is the platform preset and maps `react-native` → `@amazon-devices/react-native-kepler`, so the app cannot be tested any other way; vitest is what the pipeline half already had green.
**TypeScript downgraded 5.9.3 → 5.8.3 deliberately.** The template pins it exactly and RN 0.83 is version-sensitive; the pipeline compiles clean on it. Also pinned by the template and now facts: **React 19.2.0, react-native 0.83.0, `@amazon-devices/react-native-kepler ~4.0.0`, node >= 20.**
**R14-F1 `SECURITY`, and I got it wrong once before getting it right — recorded because the wrong version is the tempting one.** `npm install` on the official Amazon template reports **27 vulnerabilities (14 moderate, 13 high)**. My first reading was "all devDependencies, none ship to the device". **That is false.** `@amazon-devices/react-native-kepler` — a production dependency — lists `@microsoft/api-extractor@7.47.0` under its own `dependencies`, not `devDependencies`, and `npm ls --omit=dev` shows **9 vulnerable packages in the production tree**: api-extractor, api-extractor-model, ajv ×2, minimatch ×2, lodash. `npm audit fix` fixes **none** of them; every remaining fix is marked breaking against the platform's own pins.
What is true: these are build- and documentation-time tools that metro would not bundle into the app package. What is also true: a judge who runs `npm audit` on a public repository sees 27, and `limits.hackathon.repo_must_be` guarantees they can. **This belongs in the README stated plainly, not left to be discovered** — and it is the strongest product-feedback entry this build has produced, because a documentation tool in a runtime dependency list is a packaging bug Amazon can actually fix.
**Still open:** `D2` concurrency — **now testable**, the app runs and the construction is specified (`AudioPlayer(CONTENT_TYPE_SPEECH, USAGE_ACCESSIBILITY)`) · `D3` playback half — the app runs but has decoded no video; `AC1` needs the asset on screen · `D4` Bedrock, **decide by 09-30** · credits bound on the asset · `AC20`, **drop-dead 10-16** · `[wants]` media services not yet in the manifest.
**Next mode:** add `[wants]` to `manifest.toml` (`C17`) and put the demo asset on screen with `VideoPlayer` + `KeplerVideoSurfaceView` — that closes `D3` completely and sets up the `D2` test in the same run.

---

## R15 · 2026-09-22 · claude-opus-5 (Claude Code) · redaction + repository setup for a public repo
**Read:** `_facts.yml` · `_log.md` (through R14 end) · `limits.hackathon.repo_must_be`
**Log read through:** R14
**Why this round exists:** the set was about to be committed and published. A grep for personal data first — before any commit, because git history preserves what a later deletion does not.
**Redacted, and this is a stated exception to the append-only rule.** Prior entries were edited, which R1 forbids. The rule protects *findings and their evidence* from being quietly rewritten; it is not a reason to publish someone's personal data. Nothing analytical was changed — every finding, disposition and measurement reads exactly as before:
- the **AWS account id** (3 occurrences across `_facts.yml` and `_log.md`) → `the entrant AWS account`. It identified a specific billable account in a repository the hackathon rules guarantee the judges can clone.
- the **billing-country hypothesis for `D4`** (2 occurrences) → `this account falls outside the region list that carries it`. The technical finding is unchanged and still falsifiable — Bedrock carries availability restrictions other AWS services do not, and this account is outside them. What is gone is the inference about where the owner lives. `AC20` already forbids PII in the repository for the validation participant; the same standard applies to the entrant.
- verified afterwards: `0` occurrences repo-wide, and `0` credentials, `0` email addresses, `0` key material anywhere outside `node_modules`.
**Repository decisions, taken against the measured rules rather than habit:**
- **Public, not private-and-shared.** `limits.hackathon.repo_must_be` allows either. Public wins on one argument that is not about convenience: **`AC11` claims the friction log was written during the build, and git history is the only corroboration a judge can check.** A single squashed commit at the deadline turns that criterion into an unverifiable assertion. Public also makes the license badge detectable in the GitHub About section, which the rules require in those words.
- **MIT**, not Apache-2.0. The patent grant buys nothing here and adds friction to `C12`, which exists to be installed.
- **One repository now; `C12` extracted in Phase 3 as planned.** No monorepo. The Open Source mini requires commits inside the window, not a long history — but `AC10` requires a clean-clone one-command run, which is the part that is actually hard and is tested by cloning into an empty directory, never in the working copy.
- **Commit cadence is scoring, not housekeeping.** Today's work is genuinely separable and lands as four commits dated today; from here, one commit per meaningful unit. The cadence is what backs `AC11`.
**Written:** `LICENSE` (MIT) · `README.md` (168 lines) carrying the three things a judge cannot infer — the `npm audit` disclosure from R14 stated plainly rather than left to be discovered, the **CC-BY attribution for *Tears of Steel*** which is a licence obligation and not a courtesy, and setup instructions that run from zero (a rules requirement in its own right). It also links `docs/features/interstice/` and names the three times running the code falsified the plan, because "technical implementation" and "quality of idea" are scored on exactly that.
**Verified before committing:** initial commit `f417edd` is dated **2026-09-16**, inside the submission window, so `New & Existing` is satisfied · `build/` and `node_modules/` ignored · `npm test` exit 0 · `audit.py` → 0 contradictions, 0 drift.
**Next mode:** unchanged from R14 — `[wants]` media services into `manifest.toml` (`C17`), then the demo asset on screen with `VideoPlayer` + `KeplerVideoSurfaceView`, which closes `D3` and sets up the `D2` test in one run.

---

## R16 · 2026-09-22 · claude-opus-5 (Claude Code) · C17 built and validated; playback wired but NOT yet confirmed
**Read:** `_facts.yml` · `_log.md` (through R15 end) · `vega-video-sample/manifest.toml` and `src/screens/PlayerScreen.tsx` (the Amazon reference app) · `@amazon-devices/react-native-w3cmedia@2.3.2` declarations
**Log read through:** R15
**`C17` is done and the service ids are copied, not invented.** `manifest.toml` rewritten from the reference app's own manifest, scoped to this product rather than its kitchen sink. Validates with **0 errors**; the app builds, installs and runs with it. What went in, and why each one:
- `com.amazon.media.server`, `com.amazon.mediametrics.service` — MediaPlayer/MediaTransform
- `com.amazon.media.playersession.service`, `com.amazon.mediabuffer.service`, `com.amazon.mediatransform.service` — MediaControls
- **`com.amazon.audio.stream`** — *the second concurrent stream that speaks the cues.* This is `D2`'s subject: without it there is nothing to duck under.
- **`com.amazon.audio.control`** — *volume and audio controls.* This is the ducking itself, `limits.ad.duck_target_pct`.
- `com.amazon.audio.system`, `com.amazon.gipc.uuid.*` — audio/video transport
- `com.amazon.inputd.service` — remote button events (`AC2`, `AC3`, `AC6`, `AC17`)
- `com.amazon.devconf.privilege.accessibility` — VoiceView (`AC15`), in an app for blind viewers
- `com.amazon.media.secureplayback` under `[needs]` (required, not optional)
- **DRM deliberately absent.** `com.amazon.drm.key` / `com.amazon.drm.crypto` are not declared: `decisions.demo_asset_licensing` chose an unencrypted openly licensed asset.
**The `[wants]` / `[needs]` distinction is load-bearing and was not in this spec before.** `[wants]` are OPTIONAL — the manifest's own documentation says the app must handle their absence gracefully. So a missing media service is not an error the platform raises; it is a capability that silently is not there. That is precisely the silent-failure shape `C17` exists to prevent, and it is the same shape `AC8` guards on the description side.
**Evidence the declarations take effect:** the device log shows `com.amazon.mediametrics.service` running inside this app's sandbox (`User::Pkg::f5b18843-…`). Before `C17` it was not there.
**Measured — the asset, with ffprobe on the real video:** `duration 734.166667s`, `h264 1280x534`, **audio codec `mp3`**. `worst_case.runtime_min` moves from *assumed* (R13) to measured, and the credits gap is now exact: dialogue ends 567.0s, asset 734.17s, **trailing gap 167.17s**. The mp3 detail is recorded because a player that accepts only AAC in MP4 would fail here and the failure would be easy to misread as `D2`. A 117 MB H.264/AAC transcode is what the device plays; the 372 MB source is gitignored and the README says how to fetch it.
**Written:** `src/screens/PlayerScreen.tsx` (133 lines), the first increment of `C2`, against the real API rather than the invented `MediaAdapter`: `new VideoPlayer()` → `initialize()` → mount `KeplerVideoSurfaceView` → `onSurfaceViewCreated(handle)` → `setSurfaceHandle(handle)` → `play()`, with `clearSurfaceHandle` on destroy and the `error`/`loadedmetadata`/`playing` listeners emitting the `INTERSTICE.*` convention. `tsc --noEmit` clean. The asset is pushed to the device with `vega device copy-to` rather than bundled — a 117 MB video inside a `.vpkg` is the wrong shape, and metro only bundles assets something `require()`s, which a URI string does not.
**R16-F1, and the round stops here honestly rather than claiming a pass: PLAYBACK IS NOT CONFIRMED.** What is established: the app runs (pid alive), the RN tree mounts (`MountingManager` reports `surfaceId=1 mutations=11 transactions=2`, which is this screen), and `w3cmedia` is in the bundle (70 references in `index.bundle`). What is missing: **not one `INTERSTICE.*` line reaches `vega device start-log-stream`.** The build is Release and Hermes strips `console.log` there, so the oracle this screen was instrumented with does not exist in the artifact being run. Without it there is no way to tell `initialize()` succeeding from the `file:///tmp/clip.mp4` URI failing to resolve inside the sandbox — two very different problems with the same appearance: a black screen.
**Consequence for `_profile.yml`:** `device_log: "vega device start-log-stream | rg {log_tag}"` is right for *native* logs and does not carry *JavaScript* logs from a Release build. The next round settles which channel does — `npm run build:debug` with Metro attached is the obvious candidate — and the profile entry gains whatever qualification is true. Recorded rather than left for someone to rediscover by staring at an empty grep.
**Still open:** `D3` playback half — wired, not proven · `D2` — its manifest prerequisites now exist, the test itself has not run · `D4`, **decide by 09-30** · credits bound (now exactly 167.17s) · `AC20`, **drop-dead 10-16**.
**Next mode:** debug build with Metro to recover the JS console, then read `INTERSTICE.player.*` and close `D3`. That single change also unblocks the `D2` test, which is instrumented the same way.

---

## R17 · 2026-09-22 · claude-opus-5 (Claude Code) · app test harness, and a platform rule ordinary npm practice breaks
**Read:** `_log.md` (through R16 end) · `jest.config.json` · `.eslintrc`
**Log read through:** R16
**Why:** R16 left `npm test` **red** — `test/App.spec.tsx` still asserted the template's tile grid, and importing the player blew up before any assertion with `Invariant Violation: TurboModuleRegistry.getEnforcing(...): 'KeplerW3CMediaTurboModule' could not be found`. Committing that would have shipped a broken verification command in a public repository whose README tells a judge to run it.
**`test/mocks/w3cmedia.tsx` — the app-side equivalent of `02e` §B.0.** The real package reaches a native TurboModule that exists only on a Vega device. The mock mirrors **only the measured surface** from `limits.vega_media` — `VideoPlayer` with `initialize`/`deinitialize`/`setSurfaceHandle`/`clearSurfaceHandle`/`load`/`play`/`pause`, the W3C properties, `addEventListener` plus an `emit` test helper, `KeplerVideoSurfaceView` capturing its surface callbacks, and the `AudioContentType`/`AudioUsageType` enums. **A mock richer than the real API is a trap**: it lets a test pass against a method the device does not have, and the spec set already carries two findings that are exactly that failure in another costume. Wired through `jest.config.json moduleNameMapper`, where it is visible, rather than a `jest.mock` buried in a setup file.
**`test/App.spec.tsx` rewritten** around what this screen must actually do. The load-bearing one carries its own `Fails if:`, per `references/implementable.md`: *playback cannot begin before the platform hands over the surface asynchronously* — a `PlayerScreen` that called `play()` on mount would pass a naive render test and produce **audio with no picture** on a real device. The test asserts a surface-created handler is registered. Another asserts the loading state is reachable by `accessibilityLabel`, not just visible — `AC8`'s direction, in an app whose users cannot see it.
**R17-F1, a platform constraint that ordinary npm practice violates.** `npm install @amazon-devices/react-native-w3cmedia@2.3.2` wrote `^2.3.2`, and the Kepler eslint plugin **fails the build** on it: *"Allowing minor or major version upgrades for system distributed libraries may result in unpredictable behavior or incompatibility with Vega devices in the field that have not upgraded. It is strongly recommended to specify patch versions only using `~` or `<`."* A **system distributed library** ships with the device OS, so the caret range every other npm dependency wants is wrong here — the version in the field is fixed and the app must not float past it. Corrected to `~2.3.2`, matching `@amazon-devices/react-native-kepler: ~4.0.0`, which the template had already pinned that way and which now reads as deliberate rather than incidental. **Worth its own finding because the default tool does the wrong thing silently and only the linter catches it** — and a hackathon entrant who never runs lint ships a package that can break on a device they do not own.
**Green, both halves, from the commands the README publishes:** `npm test` exit **0** — jest 6 passed (app), vitest 6 passed (pipeline) · `npm run lint` exit **0** (one informational warning: the same plugin noting that w3cmedia is a system distributed library, which is the intended state and not a defect) · `audit.py` → 0 contradictions, 0 drift.
**`tests_baseline` re-measured** to cover both runners, with a note that `npm test` runs each and fails if either does.
**Next mode:** unchanged from R16 — debug build with Metro to recover the JS console, read `INTERSTICE.player.*`, and close the playback half of `D3`.

---

## R18 · 2026-09-22 · claude-opus-5 (Claude Code) · built a diagnostic channel, then used it to isolate why playback fails
**Read:** `_facts.yml` · `_log.md` (through R17 end) · skill `amazon-devices-vega-build-and-run`
**Log read through:** R17
**The problem R16 left:** an app that runs but cannot report. Establishing that took three negatives worth recording, because each looks like the obvious answer:
- `console.log` in a **Debug** build does not reach `vega device start-log-stream` either. Debug was the obvious fix and is not one.
- Metro, with the device connected and the bundle served over reverse port forwarding, prints **"JavaScript logs have moved! They can now be viewed in React Native DevTools"** — React Native 0.73+ behaviour. So the JS console exists but only behind a browser.
- No screenshot path either: `vega device` has no capture command, `screencapture` returns *could not create image from display*, and `osascript` is denied assistive access. The screen could not be looked at.
**`tools/beacon-server.mjs` + `src/diagnostics.ts` — the channel that works.** The device already reverse-forwards to the host for Metro, so `log()` sends one GET per line to a host process that prints it. `console.log` is kept alongside for anyone who does attach DevTools. Marked TEMPORARY DIAGNOSTIC TRANSPORT, with removal gated on a platform logging API being confirmed **and** the `D2` runtime test having read its lines — `references/implementable.md` §Diagnostic log lines is explicit that removal is ordered after the last run that needs the oracle, not after the last code phase.
This is the most useful thing measured on this platform so far. **`D2`'s runtime test could not have reported its result without it**, and neither could anything else in `02c`.
**First lines ever received from the device, and they immediately paid for the channel:**
```
INTERSTICE.player.surface created handle=1     .788
INTERSTICE.player.init ok=true                 .814   <- 26 ms LATER
INTERSTICE.player.error code=4                 .826
```
**R18-F1 `FUNCTIONAL`, a bug in this set's own code, found the moment it could be seen.** `VideoPlayer.initialize()` and the platform handing over the surface are independent async signals **with no guaranteed order**, and on this device the surface won the race by 26 ms. The surface callback called `setSurfaceHandle` and `play()` on a player whose `src` had not been assigned yet — producing `MEDIA_ERR_SRC_NOT_SUPPORTED` (code 4), which reads exactly like an unsupported file and is not one. Fixed by tracking both readiness signals and letting whichever lands second start playback. Landed in `limits.vega_media.surface_races_init` so `02c` Phase 7 is regenerated against it. The app test written in R17 asserted the surface handler exists; it could not have caught the ordering, and now the registry states the rule the test cannot.
**R18-F2, and it is the one that matters: the media pipeline is a SEPARATE PROCESS with its own network path.** After the ordering fix the log reads `canPlayType_mp4=probably`, `src=set`, `play resolved` — and still `error code=4`, with the http server logging **no request from the player**. A probe added to discriminate settled it in one run:
```
INTERSTICE.probe.fetch ok status=200 type=video/mp4    <- JavaScript reaches the URL
INTERSTICE.player.error code=4                         <- the player rejects the same URL
```
JavaScript fetches the asset over the reverse port forwarding and gets a 200 with the right content type. `com.amazon.media.server` never asks for it. **Host-localhost forwarding works for the app process and not for playback, and from JavaScript the two are indistinguishable** — which is precisely the trap this would have been without a probe.
**Consequence for the plan, recorded in `limits.vega_media.media_process_is_separate`:** the demo asset must be reachable by the *media* process — bundled into the package, or served from a host the device genuinely routes to. The host's LAN address is not that host today: macOS blocks the inbound connection (`curl` to `192.168.1.216:8100` times out from the host itself), so opening it is a firewall decision for the owner, not a code change.
**Honest status:** `D3`'s playback half is **still open**, and that is the correct entry. But the failure is no longer a black screen with no explanation — it is characterised to one sentence, with the discriminating measurement attached. Three candidate causes were eliminated by measurement rather than argument: the format (`canPlayType` = `probably`), the ordering (fixed, error persisted), and the network reachability (JS proved the URL serves).
**Edits:** `_facts.yml` (+`limits.vega_media.no_js_console`, `.media_process_is_separate`, `.surface_races_init`) · `docs/features/_profile.yml` (`device_log` qualified as NATIVE-only, new `js_log` entry naming the beacon) · `src/screens/PlayerScreen.tsx` rewritten · `src/diagnostics.ts`, `tools/beacon-server.mjs`, `test/mocks/diagnostics.ts` new.
**Validation:** `npm test` exit 0 (jest 6 + vitest 6) · `npm run lint` exit 0 · `audit.py` → 0 contradictions, 0 drift.
**Next mode:** make the asset reachable by the media process. Cheapest first: `require()` the clip so metro bundles it into the package and reference the packaged path — the build already logs `cp .../rn-bundles/Release/assets/*` and fails because nothing requires an asset today, which is the same fact seen from the build side.

---

## R19 · 2026-09-22 · claude-opus-5 (Claude Code) · asset bundled; six causes eliminated; D5 raised and the debugging stopped
**Read:** `_facts.yml` · `_log.md` (through R18 end) · `@amazon-devices/react-native-w3cmedia@2.3.2` **source**, not only its declarations
**Log read through:** R18
**Done:** the asset now travels inside the package. `require('./assets/clip.mp4')` rather than a string URI — `mp4` is already in metro's default `assetExts`, and the build's `cp .../rn-bundles/Release/assets/*` step only had something to copy once an asset was actually required. The `cp: no such file or directory` R16 recorded was the same fact seen from the build side. The build now logs **"Done copying assets"**, the clip lands in the bundle, and it resolves on device to `file:///pkg/bundle/assets/src/assets/clip.mp4`.
**And it still fails.** `MEDIA_ERR_SRC_NOT_SUPPORTED`, every time.
**Six candidate causes eliminated by measurement rather than argument. The list is the deliverable of this round** — each is a test nobody has to run again:
1. **Format** — `canPlayType('video/mp4')` returns `probably`.
2. **Ordering** — the surface/init race was real (R18) and is fixed; the error survived the fix.
3. **Network reachability** — JavaScript fetched the same URL over the forwarded port and got `200 video/mp4`.
4. **Asset packaging** — bundled, `Done copying assets`, and JavaScript reads the packaged `file://` path successfully (`probe.fetch 200`).
5. **Codec profile** — re-encoded from High L3.1 to **Constrained Baseline L3.0**, yuv420p, AAC stereo. Identical failure.
6. **Empty src** — reading the package source found the *only* path in `MediaPlayer.js` that raises code 4 is an empty-URL check in the `src` setter. The URI is logged non-empty and `ready src=set` confirms it at play time; the error arrives ~300 ms later from the native TurboModule (`MediaPlayer.js:1049`, `W3CMediaTurboModule.getError`), not from that check.
The native error message, once logged, is **empty**. No media decode error appears in the device syslog either.
**R19-F1 → `defects[D5]`: the Virtual Device may not decode video at all.** Raised as a named hypothesis with a `falsified_by` rather than left as an unexplained failure, because an unnamed wall is the thing a later round burns a day rediscovering. **The next test is cheap and decisive and is not more of this app**: build and run Amazon's own `vega-video-sample` (`related_docs[R-VEGA-VIDEO]`) on this same device. If the reference player cannot play video here, the device is the answer and this app was never the problem.
**Why `D5` is a planning risk and not only a bug.** `limits.hackathon.firetv_runtime_requirement` accepts a demo video recorded on a real Fire TV device **or** on the simulator. If the Virtual Device cannot decode, `AC1` and `AC12` need **physical hardware** — a lead time and a cost, on the owner's clock, in the same class as `AC20` and `D4`. Named now, at day 4 of 34, instead of discovered in Phase 5.
**Judgment recorded, because stopping is a decision:** debugging stops here rather than continuing to iterate. Six eliminations is a well-characterised open problem; a seventh guess without a new information source is not diagnosis. The cheap decisive test is written down and belongs to the next round.
**Edits:** `_facts.yml` (`defects[D5]`) · `01-master-plan.md` (§7 checklist item, §8 risk row) · `src/App.tsx` (asset required and resolved) · `src/screens/PlayerScreen.tsx` (error listener logs the native message) · `src/assets/clip.mp4` re-encoded to Constrained Baseline.
**Validation:** `npm test` exit 0 · `npm run lint` exit 0 · `audit.py` → 0 contradictions, 0 drift.
**Still open:** `D5` **new, and it gates `D3`'s playback half** · `D3` playback · `D2` — its test cannot run until something plays · `D4` Bedrock, **decide by 09-30** · credits bound · `AC20`, **drop-dead 10-16**.
**Next mode:** run `vega-video-sample` on this Virtual Device. One answer, two outcomes: it plays and the fault is in this app, or it does not and the demo needs hardware. Either way the next step after it is unambiguous, which is why it comes before writing another line of player code.

---

## R20 · 2026-09-25 · claude-opus-5 (Claude Code) · D5 resolved FALSE, D3 closed, and the asset's content end bounded
**Read:** `_facts.yml` · `_log.md` (through R19 end) · `@amazon-devices/react-native-w3cmedia@2.3.2` source · the Vega community bug tracker
**Log read through:** R19

### The video plays.
`INTERSTICE.player.progress t=3.96 w=0 h=0 paused=false frames=253 dropped=0` — on the Virtual Device, from the packaged demo clip. `canplay` and `playing` both fired, the clock advances, **253 frames decoded and none dropped**. `defects[D5]` is resolved **FALSE**, `defects[D3]` closes its playback half after four rounds open, and no hardware purchase is needed for `AC1`/`AC12`.

**R20-F1 `FUNCTIONAL`, and it was never in this app: URL MODE IS BROKEN on this SDK.** Assigning any URL to `player.src` fails with `MEDIA_ERR_SRC_NOT_SUPPORTED` **before a single byte is requested** — remote URL, packaged `file://` path, `AudioPlayer` and `VideoPlayer` alike — with an empty native message and no `W3CMEDIA` log line at any priority. `canPlayType()` answers `"probably"` for the exact type the player then refuses. Handing the same bytes to the same player through a `MediaSource` plays them. Recorded as `limits.vega_media.url_mode_broken` and `.mse_path`.

**This explains why R19's six eliminations all held and none of them found it.** Every one assumed the fault was in the content or in the path to it — format, ordering, reachability, packaging, codec profile, empty src. The fault was on the other side of the assignment, in source handling that never ran. A seventh guess of the same kind would have failed too, which is exactly why R19 stopped instead of guessing again.

### How it was found, which is the part worth keeping.
**Not** by running `vega-video-sample`, the test R19 named. That test was run: the sample builds (after working around a `min-release-age` / `--before` conflict in its Shaka postinstall), installs and launches — and reaching a player needs D-pad navigation on a device this project cannot screenshot. Its own EPG task crashes with `SIGSEGV` on launch, which is a defect in Amazon's sample, not evidence about ours.

What resolved it was **reading the platform's bug tracker**: a developer on an identical stack (SDK 0.24, CLI 1.3.4, w3cmedia 2.3.2, RN 0.83, VVD OS 1.2) had already published the decisive three-way comparison — `AudioPlayer.src` fails with no HTTP request, `VideoPlayer.src` fails with no HTTP request, `MediaSource` + `appendBuffer` plays — same device, same session, same footage. Recorded as `related_docs[R-VEGA-MSE-THREAD]`. **The cheapest decisive test was not a test.** A day of this debugging had already been done by someone else and written down, and the set had no habit of looking there.

### Three platform facts that produce confident WRONG answers.
Each is now in `limits.vega_media`, because each one nearly cost a wrong conclusion in this round:
- **`video_width_unreported`** — `videoWidth`/`videoHeight` stay `0` through `loadedmetadata` and `playing`, and the platform's own `resize` event arrives carrying zeros. That is the exact signature of audio-only playback on a stream decoding 253 frames. `VideoPlayer.js:225` only assigns the value from a `resize` event, so it reports what the platform sent. **Gate on `getVideoPlaybackQuality().totalVideoFrames`, never on `videoWidth`.**
- **`run_cmd_is_sandboxed`** — `vega device run-cmd` runs as `uid=5000(app_user)` in an app context. `ps` lists two processes and `/dev/input` reports `No such file or directory` while key injection through that same shell demonstrably works. Any probe there that reports a resource **absent** has reported nothing.
- **`input_injection`** — `inputd-cli button_press KEY_ENTER` injects D-pad and remote keys, confirmed reaching the app. It is a binary on the device, not a CLI command, and it is the automation path for `AC2`. Screenshots are the opposite story: no path exists, host-side or device-side.

### The content end, and why both fixes the plan proposed were wrong.
`decisions.demo_asset_licensing` left one item open, due before Phase 1 closes: the 167-second trailing gap that is the credits. It offered an explicit `content_end_ms` or a rule dropping the trailing gap. **Measuring the asset killed both.** `blackdetect` plus a frame-by-frame read found credits from 588.0s **and a 21-second post-credits scene at 709.5s**. A scalar end or a drop-the-tail rule deletes it — real content, of exactly the kind a sighted viewer keeps and a blind viewer loses.

So the asset declares a **list** of describable windows (`worst_case.content_windows`, `basis: measured`) and `C7` gains `clipToContent`, which intersects gaps with them. Measured effect: **38 gaps become 39** — the trailing gap straddled the boundary and split into the film's tail plus the post-credits scene — describable time falls from 577.0s to **451.8s** (61.5% of the asset, 74.2% of its content), the longest gap from 167s to 62s, cues from 70 to **60**, and Bedrock calls from 211 to **181**. The count rising while the time falls is the whole shape of the finding.

A residual risk is stated rather than hidden: an asset with no measured windows is treated as content end to end, and describes its own credits. That is an asset-authoring gap, not a silent failure.

### Edits
`_facts.yml` — `defects[D5]` resolved false with evidence · `defects[D3]` resolved in full · `limits.vega_media` +`url_mode_broken` +`mse_path` +`video_width_unreported` +`run_cmd_is_sandboxed` +`input_injection` · `worst_case` re-measured (+`content_windows`, +`gaps_note`, +`describable_pct_note`) · `decisions.demo_asset_licensing` open item closed · `changes[C7]` extended · `related_docs` +`R-VEGA-MSE-THREAD` +`R-VEGA-ASSETS-THREAD` · `tests_baseline` re-measured · revisions v14, v15.
`01-master-plan.md` — §2 the D3 playback half and the content-end resolution, §5 cost figures, §7 two checklist items, §8 two risk rows retired.
`src/screens/PlayerScreen.tsx` rewritten onto MSE · `src/assets/clip.mp4` re-encoded fragmented · `pipeline/gaps.ts` +`clipToContent` · `pipeline/__tests__/gaps.test.ts` new · `test/mocks/w3cmedia.tsx` +`MediaSource`/`SourceBuffer`/instance registry · `test/App.spec.tsx` +2 · `FRICTION-LOG.md` +4 entries.

**Validation:** `npm test` exit 0 — jest **8 passed**, vitest **13 passed (2 files)** · `npm run lint` exit 0 (2 informational warnings) · `npm run build` exit 0 · app installed and playing on the Virtual Device · `audit.py` → see below.

**Revision ordering slipped a third time** — the insert anchor matches the newest tag, so prepending puts the new entry first. Fixed in-round again. It is now three rounds in a row and belongs in the skill, not in a reviewer's memory.

**Still open:** `D2` — its runtime test is unblocked for the first time, because something finally plays · `D4` Bedrock, **decide by 09-30** · `AC20`, **drop-dead 10-16** · `review` over the moved scope, then regenerate `02` Phase 3, `02b` Phases 4–6 and `02c` Phases 7/10, all of which were written against `.src` playback and a 1:1 gap-to-cue pipeline.

**Next mode:** `review`, then `implement` over the stale phases. The platform is no longer the unknown; the plan's shape is.

---

## R21 · 2026-09-25 · claude-opus-5 (Claude Code) · review over the moved scope; D6 raised and D2 closed, both TRUE
**Read:** `_facts.yml` (v15) · `_log.md` (through R20 end)
**Log read through:** R20
**Did:** the sweep, then two device measurements the sweep itself demanded. `references/gap-sweep.md` plus the `mobile-tv` layer. Swept scope: `C2`, which now owns byte delivery, and `C7`, which now clips against content windows. **Seven findings, all confirmed, none rejected.**

### The sweep

- **R21-F1 `FUNCTIONAL` — the app buffers the whole asset, and the real one is 117 MB.** `AC1` says the demo asset plays end to end. The first increment does `await response.arrayBuffer()` on the entire file: correct for a 2.6 MB clip, an OOM for a 12.24-minute transcode on a device `limits.clip_cache` already describes as a 32-bit process with a small heap — and `SourceBuffer` carries its own quota that raises `QuotaExceededError` regardless of the heap. Fixed as `limits.mse_buffer` (30 s ahead, 10 s behind, 1 MB chunks, `remove()` behind the playhead) and written into `C2`'s scope. **The three numbers are `basis: decided`, and `AC21` is what makes them measured** — inventing them and calling them measured is the failure this registry exists to prevent.
- **R21-F2 `FUNCTIONAL` — seeking became this app's problem and `AC6` was written as though it had not.** URL mode let the platform fetch byte ranges on seek. With app-owned delivery a seek outside the window has no bytes, and a fragmented MP4 has no index to find them with. `contracts.asset_manifest.byte_index` gives it one.
- **R21-F3 `FUNCTIONAL` — a stall is not an error, and nothing rendered it.** When bytes run short the player emits `waiting`/`stalled` and never `error`, so `PlayerScreen` stays in `playing` and a blind viewer gets a frozen picture and silence with no spoken state. `AC8` covers a failed *description track*; this is the *media* stream, one layer down, and had no criterion at all. `AC22` now covers it together with F2.
- **R21-F4 `FUNCTIONAL`, and it would otherwise have surfaced in Phase 4 — the description clips cannot be played by URL either.** `url_mode_broken` was measured for `AudioPlayer` as much as for `VideoPlayer`. So every cue must also go through a `MediaSource`, which constrains `C10`'s output container: Polly's default MP3 **cannot be appended to a SourceBuffer**, so C10 emits fragmented `audio/mp4` with `mp4a.40.2`. It also made `limits.clip_cache`'s "clips stream from disk" false as written; corrected in place. This finding is the reason `D6` exists.
- **R21-F5 `FUNCTIONAL` — `worst_case.content_windows` had no runtime home.** `clipToContent` needs windows and the registry is a spec, not a program input; only the test had them, hardcoded. An implementer following the spec literally inlines Tears of Steel's credits boundary into `gaps.ts`, where the next asset silently inherits it. Fixed with `contracts.asset_manifest`.
- **R21-F6 `FUNCTIONAL` (mobile-tv layer) — the loading state is now long, and it is not focusable.** Buffering is no longer instant, the D-pad has nothing to land on while it runs, and the in-flight `fetch` is never aborted on unmount. `C2` carries an `AbortController` and a focusable loading host.
- **R21-F7 `POLISH` — `AC19`'s timeline has a hole in it.** C7's output no longer covers 588–707 s, so a strip drawn from C7 alone shows an unexplained void over the credits. It labels non-content windows instead.

**Blind spot stated, per the sweep's own rule:** there is no layer for *"the app owns media byte delivery"* — the kind that F1/F2/F3 all belong to. They were swept on their own terms. That layer is worth writing; it will apply to any Vega media app for as long as `url_mode_broken` holds.

### Then the sweep's own finding was tested, because the device was warm

F4 raised a question nobody in this set had answered: MSE was measured working for **video, with a surface attached**. Audio-only is a different question, and every description cue is audio-only. Raised as **`defects[D6]`** — blocking, because if it were false the product would have no output path at all and no amount of pipeline work would matter.

Written as the first increment of `changes[C4]` rather than as a throwaway probe, because the real question is whether a cue plays *while the film plays*, which needs both players alive in one process.

**Both answers came in one run:**
```
13.548  INTERSTICE.cue.audio state=playing                                  <- second stream
15.452  INTERSTICE.player.progress t=3.93 paused=false frames=244 dropped=0  <- MID-CUE
18.077  INTERSTICE.cue.audio state=ended t=4.50                              <- full duration
18.102  INTERSTICE.cue.duck restored
```
**`D6` TRUE** — an `AudioPlayer` built `(CONTENT_TYPE_SPEECH, USAGE_ACCESSIBILITY)` took an audio-only `SourceBuffer`, 56368 bytes of fragmented AAC-LC, and played it whole, **with no video surface attached**. `C10`'s container constraint stands as written.

**`D2` TRUE** — the platform stops neither stream. The cue ran its full 4.50 s while the film kept decoding with `dropped=0`, sampled between the cue's start and end, main player ducked to `0.25` and restored. `decisions.d2_fallback` is not needed and is kept only for hardware, where it has not been retested.

**What is NOT measured, stated rather than glossed:** the audible level. There is no audio capture path off the Virtual Device any more than there is a screenshot path. Both pipelines ran and the volume property was applied — a listener hearing the film get quieter is not established, so `AC5` stays open and closes on hardware or during the `AC14` watch. `defects[D2].falsified_by` names both halves deliberately; this run settles one.

**Every open hypothesis in this set is now resolved except `D4`,** which is not ours to resolve — it waits on AWS Support or the organisers.

### Edits
`_facts.yml` — `limits.mse_buffer` new · `limits.clip_cache` corrected · `limits.vega_media.concurrent_streams` new · `changes[C2]`, `[C4]`, `[C6]`, `[C7]`, `[C10]` re-scoped · `contracts.asset_manifest` / `content_window` / `byte_index_entry` new · `AC21`, `AC22` added (appended, never renumbered) · `defects[D6]` raised and resolved TRUE · `defects[D2]` resolved TRUE · `decisions.d2_fallback` marked not-needed-but-kept · revision v16.
`01-master-plan.md` — §2 the D2/D6 result, §7 two checklist items flipped, §8 one risk row retired and two added.
`src/ad/DescriptionAudio.ts` new (C4 first increment) · `src/assets/cue.m4a` new · `src/App.tsx`, `src/screens/PlayerScreen.tsx` wire the cue · `jest.config.json` maps media assets · `test/mocks/mediaAsset.js` new.

**R21-F8, found while running the tests rather than by the sweep:** `require('./assets/cue.m4a')` made jest parse the raw bytes as JavaScript (`SyntaxError: Invalid or unexpected token`). The kepler preset maps the image extensions and not the media ones. `clip.mp4` had never been required from a file jest loads, so this was latent. Mapped through `moduleNameMapper`.

**Validation:** `npm test` exit 0 — jest 8, vitest 13 · `npm run lint` exit 0 (3 informational warnings) · `npm run build` exit 0 · measured on the Virtual Device as quoted above.

**Still open:** `D4` Bedrock, **decide by 09-30** · `AC20`, **drop-dead 10-16** · `AC5` audible ducking, on hardware · `AC21` the `limits.mse_buffer` numbers, on the worst device.

**Next mode:** `implement` over the stale phases — `02` Phase 3, `02b` Phases 4–6, `02c` Phases 7 and 10. All four were written against `.src` playback, a platform that seeks for you, and a 1:1 gap-to-cue pipeline. None of those three is true any more.

---

## R22 · 2026-09-25 · claude-opus-5 (Claude Code) · implement over the stale phases; code first, prose anchored to it
**Read:** `_facts.yml` (v16) · `_log.md` (through R21 end)
**Log read through:** R21
**Preconditions checked before starting, per the skill's three:** `review` ran in R21 and all seven findings carry a disposition (all `confirmed`) · `status: reviewed` · every `changes[]` entry carries a `kind:`.
**Did:** regenerated every phase written against a platform that no longer exists as described — `.src` playback, a player that seeks for you, a 1:1 gap-to-cue pipeline, and a volume ramp the platform does not have. `sync` could not have repaired any of it: it propagates values, and what changed is shape.

### Code written before the prose that describes it
Four phases were documenting modules that did not exist, and two were documenting modules that did. Writing the code first and anchoring the doc to it is the discipline that has held all round; it also surfaced three things prose alone would not have.

- **`limits.ad.max_cue_ms` and `min_useful_words` were in the registry since R13 and had never reached the code.** `AD` carried neither. The one-to-many rescope existed entirely on paper — `gaps.ts` still emitted gaps. Wired both, then wrote `splitIntoCues`.
- **`pipeline/manifest.ts` new (`R21-F5`)** — `contracts.asset_manifest` given a real parser, with two rejections worth their own tests: overlapping windows (they would double-describe the overlap, and nothing downstream could tell it was a manifest error) and a **missing** `content_windows` key, which is not the same as an empty one. `[]` is an author declaring the whole asset describable; absent is an author who forgot.
- **`CueWindow.part_index` / `part_count` added, and the reason is a bug the rescope would have shipped.** A window split out of the middle of a long gap has `before === null && after === null` — **identical to the gap that opens the film**. `C9`'s prompt branched on exactly that and would have told the model *"this silence opens the film"* for every middle window of every split gap. Nothing throws, every cue comes back, and the descriptions are subtly about the wrong thing. This is the shape of error a 1:1→1:many change makes, and it is why the phases had to be regenerated rather than patched.

### Two measurements that corrected numbers already in the registry
- **Cue counts are per level: 47 / 55 / 60** (concise / standard / detailed), 629 / 916 / 1127 words. Every earlier figure came from `ceil(duration / max_cue_ms)` and assumed 60 cues at all three levels. **Bedrock calls: 181 → 163.** The 181 was the last figure in this set derived by multiplying rather than running.
- **The cue sets NEST** — `concise ⊆ standard ⊆ detailed`, measured on the demo asset and pinned by a test. Window boundaries depend only on duration; verbosity decides only which windows fall under the useful-words floor, and that threshold is monotonic. So `C8` extracts frames **once** against the widest set and the narrower levels look theirs up by window key — a third of the ffmpeg work. Keyed by `start_ms-end_ms` and never by index, because indices renumber per level and an index join would pair a cue with another cue's frames while the frame count still looked right.

### What each regenerated phase now says
- **`02` Phase 3** — parse, merge, **clip**, **split**, plus the manifest and how to produce `content_windows` for any asset (`blackdetect` gives the cuts; a human looks at the frame either side, because no filter tells credits from a wordless scene).
- **`02b` Phase 4** — frames per **cue**, not per gap, plus the extract-once scheme above.
- **`02b` Phase 5** — `describeCue`, keyed by window, with the middle-window prompt branch; and a `D4` banner at the top, because this phase is written and **cannot be run**.
- **`02b2` Phase 6** (new file) — `C10` emits **fragmented `audio/mp4` AAC-LC**, not MP3. Polly cannot produce that container, so the shape is Polly → MP3 → ffmpeg → `.m4a`, and the intermediate is deleted so nobody references the file the app cannot play.
- **`02c` Phase 7** — the seam, with its justification **replaced rather than quietly kept**. It existed because `D3` was open and `A4` would reopen; both are settled, so that reason is gone. It is kept for a stronger one: `changes[C12]` is a published package called *react-native-tv-audio-description*, and `MediaAdapter` is its public API. `setVolumePct` lost its `rampMs` parameter (`no_volume_ramp` is measured) and gained `onStalled` (`R21-F3`).
- **`02c2` Phases 10–11** (new file) — `src/ad/duck.ts` holds the JS fade, **once**, so it cannot become three per-platform copies; `D2`'s fallback branch is marked as not running.
- **`02d` Phase 12** — `C2` owns byte delivery, with the four obligations that follow (`R21-F1/F2/F3/F6`) and a `stalled` screen state that is spoken, not just shown.
- **`02e`** — the Definition of Done grew two rows and a note.

### R22-F1, and it is a naming collision the audit could not see
`AC21` and `AC22` **already existed**: written in R3, retired in R5 with `C15`/`C16`, and `decisions.typesafe_judgment_layer` says they return **verbatim** if that decision reopens. R21 gave those ids to two brand-new criteria. Renumbered to `AC23`/`AC24`, with a comment in `acceptance[]` marking 21/22 reserved. A reopened criterion that silently means something else is worse than a gap in the numbering, and no mechanical check catches it — the retired ids live in prose, not in the registry.

### Splits
Both `02b` and `02c` passed 600 lines while being regenerated and were cut on phase boundaries per `references/doc-pattern.md`: `02b2-track-output.md` (Phase 6) and `02c2-audio-and-controls.md` (Phases 10–11). Registered in `docs[]`, continuation pointers updated, and the "set of N" line swept across all seven files. Nothing was summarised — a split that compresses loses exactly the paste-ready blocks the doc exists for.

**Edits:** `_facts.yml` (`worst_case` re-measured with `cues_by_verbosity` and `words_by_verbosity`; `bedrock_calls` 181 → 163; `AC21/22` → `AC23/24` plus the reserved note; `docs[]` +`02b2` +`02c2`; `tests_baseline` re-measured) · `_profile.yml` (`tests_expect`) · `02`, `02b`, `02b2`, `02c`, `02c2`, `02d`, `02e` · `pipeline/budget.ts` (+`MAX_CUE_MS`, `MIN_USEFUL_WORDS`) · `pipeline/gaps.ts` (+`splitIntoCues`, `CueWindow`) · `pipeline/manifest.ts` new · `assets/tears-of-steel.manifest.json` new · two test suites.

**Validation:** `npm test` exit 0 — jest **8**, vitest **30** across 3 files · `npm run lint` exit 0 · `audit.py` → **clean, every mechanized check passed**.

**Still open:** `D4` Bedrock, **decide by 09-30** · `AC20`, **drop-dead 10-16** · `AC5` audible ducking and `AC23` the memory bound, both on hardware.

**Next mode:** build. The plan and the platform finally describe the same thing, and `02` Phase 4 onward is now executable prose — except `02b` Phase 5, which is written and blocked on `D4`.

---

## R23 · 2026-09-25 · claude-opus-5 (Claude Code) · credits granted, D4 unchanged, and C10's output path measured end to end
**Read:** `_facts.yml` (v16) · `_log.md` (through R22 end)
**Log read through:** R22
**Did:** recorded the grant, re-measured `D4`, and then spent the live AWS session on something that was not blocked.

### `D4` is unchanged, and the prediction was made before the test
The credits were granted on 09-25. `InvokeModel` and `Converse` return **byte for byte the same** `ValidationException — Error 002: Access to Bedrock models is not allowed for this account`. The stub above stated the expectation before the retest rather than explaining it afterwards, which is the only reason this counts as a measurement of the hypothesis and not a rationalisation of a disappointment.

**Two new eliminations, and they are the ones a support case needs:**
- **The Bedrock CONTROL plane works.** `aws bedrock list-foundation-models` returns the full Nova catalogue — `nova-pro`, `nova-lite`, `nova-micro`, `nova-canvas`, `nova-reel`, `nova-2-lite`, `nova-2-sonic`, `nova-2-multimodal-embeddings`. So the account authenticates to Bedrock, is authorised to enumerate its models, and the models exist in the region. **Only the data plane refuses.**
- **Funding is not the variable.** A credit grant changed nothing. That kills the most natural wrong theory before anyone spends a day on it.

The refusal is now characterised in one sentence: **inference only, account scope, with credentials, region, service reachability, model existence and billing all eliminated by measurement.** That is what goes in the support case, and it is a much shorter case than the one available three days ago.

`decisions.hackathon_track` already said the AWS Builder mini takes any AWS service with a documented integration. Polly is that service, it works, and the credits now pay for it.

### The live session spent on something not blocked
Polly synthesised a real cue (neural, Joanna, 33 characters, 11996 bytes of `audio/mpeg`), and the whole of `02b2` Phase 6.1's output path ran with it, end to end, on the device:

```
Polly -> mp3 -> ffmpeg fragmented mp4 (ftyp/moov/moof/mdat) -> metro bundle
-> device fetch -> appendBuffer -> AudioPlayer -> ended t=2.02
```
```
INTERSTICE.cue.audio mse_supported=true bytes=25674 state=canplay
INTERSTICE.cue.duck main_volume=0.25
INTERSTICE.player.progress t=3.90 paused=false frames=235 dropped=0   <- mid-cue
INTERSTICE.cue.audio state=ended t=2.02
```

**Why this was worth doing rather than waiting for `D4`.** The `D6`/`D2` run in R21 used a clip synthesised with macOS `say`. This one is the real vendor output, and it came out of a **different encoder** — the container decision in `changes[C10]` was designed against a measurement of someone else's file. Now the exact chain `C10` will run is measured on the exact platform it has to play on. `C9` is blocked; `C10` never was, and the two were only entangled by habit.

**Edits:** `_facts.yml` (`limits.hackathon.aws_credits_granted`; `defects[D4]` evidence re-measured with `n: 2` and two new eliminations; `limits.polly.container_chain` new, `basis: measured`; revision v17) · `01-master-plan.md` (§7 checklist, §8 risk row) · `src/assets/cue.m4a` replaced with the Polly artefact.

**Validation:** `audit.py` → clean, every mechanized check passed · measured on the Virtual Device as quoted.

**Still open:** `D4` — **decide by 09-30**, and the support case is now cheap to write · `AC20`, **drop-dead 10-16** · `AC5` and `AC23` on hardware.

**Next mode:** ask the owner for the credit amount and expiry — a credit that lapses before 2026-10-23 buys nothing — then build `C8` onward, which is unblocked.

---

## R24 · 2026-09-25 · claude-opus-5 (Claude Code) · credit terms recorded; the code is not
**Read:** `_facts.yml` (v17) · `_log.md` (through R23 end)
**Log read through:** R23
**Did:** recorded the credit's terms and corrected `aws_credits_granted`, which R23 wrote as though the grant and the redemption were the same event. They are not: what was issued is a single-use code that has to be redeemed in the Billing console, and until it is, the balance is zero.

**The redemption code is deliberately absent from this registry, this log and this repository.** It is a single-use secret, the grant email says not to share it, and this repository is PUBLIC. `env_vars` already states the rule this follows — names in the registry, values never — and a credit code is the same class of thing as a key. The owner was told to redeem it immediately rather than leave it unclaimed.

**Terms, which remove a risk rather than add one:** USD 150, valid through **2028-08-31**. That is 22 months past the submission deadline, so there is no expiry pressure on this entry at all and `schedule.*` does not gain a date. Redemption requires a payment method on file — the account is the entrant's existing one, so this is a check rather than a task.

**Edits:** `_facts.yml` (`limits.hackathon.aws_credits_granted` corrected and split from redemption; `aws_credits_valid_through`; `aws_credits_usd` confirmed against the grant rather than the rules page).
**Validation:** `audit.py` → clean.
**Redeemed the same day** (`aws_credits_redeemed`), which closes the credit front entirely: the entitlement is a balance, the code is burned and worthless to anyone else, and there is no expiry to track. `worst_case.est_cost_usd` stays `null` — the credit pays for calls and `D4` means the calls that would price it have never run.
**Still open:** unchanged from R23 — `D4` **decide by 09-30** · `AC20` **10-16** · `AC5`, `AC23` on hardware.

---

## R25 · 2026-09-25 · claude-opus-5 (Claude Code) · built C8 — and the real run found what 12 green tests could not
**Read:** `_facts.yml` (v17) · `_log.md` (through R24 end) · `02b` Phase 4
**Log read through:** R24
**Did:** built `pipeline/frames.ts` (`changes[C8]`) against the phase regenerated in R22, with 12 tests, then ran it against the real asset — which is where the interesting part is.

### R25-F1 `FUNCTIONAL`: every unit test passed against code that could never have worked
`detectCuts` read `execFileSync`'s **return value** — stdout — with `stdio: ['ignore', 'ignore', 'pipe']`. ffmpeg writes `showinfo` to **stderr**. So every real call returned `null` and threw on `.toString()`, while **all twelve tests were green**.

The mock is why. It returned one buffer for any invocation, so a function reading either stream passed identically. **The test was asserting against the shape of the mock rather than the shape of ffmpeg** — and it had been written from the same wrong assumption as the code, which is the failure mode a mock written alongside its subject always risks.

Fixed with `spawnSync` and `result.stderr`. The mock now implements `spawnSync` with `stdout` and `stderr` as **separate fields**, so it can fail the way the real binary does; `execFileSync` in the mock returns an empty stdout, which is what ffmpeg actually puts there.

This is the second time in this set that `[MANUAL]` verification earned its place — the first was R13, running `C7` against real subtitles and discovering a gap is not a cue. The phase's own wording already said it: *"a test proves the bound holds; only an eye proves the frames are of the film."* It understated the case. A test could not prove the function ran at all.

### The real run
Longest content window `119000-131000` → **two frames**, `119955` (a detected cut) and `125000` (the midpoint), and they are **two different shots of the same scene**, which is exactly what cut detection is for. A post-credits window `709500-719917` → **one frame**, correctly, because it holds no cut. Opened all three: film, not black, not credits.

That also exercises the ceiling from both sides in one run — a window that needs padding does not get it (`limits.ad.frames_per_gap_max` is a ceiling, not a target), and a window with more cuts than the ceiling is truncated.

### Why this phase and not another
`defects[D4]` blocks `C9` and **only** `C9`. `C8` needs ffmpeg and nothing else — no AWS, no device. Waiting for Bedrock would have idled work that never depended on it, which is the same reasoning that put `C10`'s container chain on the device in R23 while `C9` sat blocked.

**Edits:** `pipeline/frames.ts` new · `pipeline/__tests__/frames.test.ts` new (12) · `02b` Phase 4 code block synced with the fix and carrying `R25-F1` · `_facts.yml` (`changes[C8].built`, `tests_baseline` re-measured) · `_profile.yml` (`tests_expect`).
**Validation:** `npm test` exit 0 — jest 8, vitest **42** across 4 files · `npm run lint` exit 0 · `tsc --noEmit` clean · `audit.py` → clean, every mechanized check passed · real-asset run as quoted.
**Still open:** `D4` **decide by 09-30** · `AC20` **10-16** · `AC5`, `AC23` on hardware.
**Next mode:** `C6` TrackLoader and `C3` CueScheduler — both pure logic against `contracts.description_track`, both testable with no AWS and no device, and both needed before anything can be heard in order.

---

## R26 · 2026-09-25 · claude-opus-5 (Claude Code) · built C6 and C3, and bound the registry to the code
**Read:** `_facts.yml` (v17) · `_log.md` (through R25 end) · `02c` Phases 8 and 9
**Log read through:** R25
**Did:** built `C6` (TrackLoader + ClipCache) and `C3` (CueScheduler + coalesce), 30 tests between them, plus one new kind of check.

### The R25 lesson applied: a check that binds the registry to the CODE
R25 showed a fake can encode the same wrong assumption as its subject. `C6`'s validator is exactly that risk in a worse place: it decides what counts as a valid track, and a fixture written beside it would agree with it by construction.

So `pipeline/__tests__/contract-parity.test.ts` reads `contracts.description_cue` and `contracts.description_track` **out of `_facts.yml` on every run** and asserts the validator's key lists equal them. Mutation-checked the same day: adding `mutation_probe` to `contracts.description_cue` turns it red, reverting turns it green.

**This is the first check in the set that binds the registry to the code.** `audit.py` check 3 compares `contracts.*` against the **prose**, so until now a field could be added to the registry and to all seven documents and still be missing from the validator — and the first symptom would be an undefined read inside the player, three phases away from the cause.

### R26-F1 `FUNCTIONAL`: the spec's test paths pointed somewhere jest never looks
`02c` Phases 8–11 and `02d` Phase 12 all named their suites `src/ad/__tests__/*.test.ts`. `jest.config.json` sets `testRegex: "/test/.*\.(test|spec)\.(ts|tsx|js)$"`. A suite at that path is **never discovered** — it does not fail, it does not run, and a green `npm test` says nothing about it. Found by building the first two and noticing the totals had not moved.

Corrected across `02c`, `02c2`, `02e`, with a note in `02e` §B.1 stating the rule and why it bites: silence is the worse of the two failure modes. The phase-verification lines also stopped quoting a specific file after `⟨commands.tests⟩` — the runner discovers its own files, and a path in the doc is a second place for one to drift.

### What the tests actually pin
`C6` — a `failed` cue must be **accepted** (the pipeline writes them on purpose, so a validator that refuses them turns one throttled description into none at all); a **missing** level falls back to `standard` while a **malformed** one does not (they are different answers and conflating them hides a producer bug); and `ClipCache` does not double-count a re-put uri, which would let it evict live entries while holding duplicates against a 32-bit heap.

`C3` — a cue whose window has closed is **dropped, never played late** (`AC4`: a late cue plays over the dialogue the window was measured to avoid); a forward seek fires **no backlog**, and a seek back into a window **re-arms** it; `end_ms` is exclusive; and `coalesce` acts once on the settled value rather than once per key event (`AC6`).

**Also:** `.eslintrc` gained `ignoreRestSiblings` for the test override. The `const { field: _dropped, ...without } = obj` idiom is how a test drops one contract field, and renaming variables to satisfy a linter would have been the wrong repair.

**Edits:** `src/ad/TrackLoader.ts`, `src/ad/CueScheduler.ts` new · `test/TrackLoader.spec.ts` (13), `test/CueScheduler.spec.ts` (17), `pipeline/__tests__/contract-parity.test.ts` (2) new · `02c`, `02c2`, `02e` test paths corrected · `.eslintrc` · `_facts.yml` (`changes[C3].built`, `[C6].built`, `tests_baseline` re-measured) · `_profile.yml`.
**Validation:** `npm test` exit 0 — jest **34**, vitest **44** across 5 files · `npm run lint` exit 0 · `audit.py` → clean, every mechanized check passed · parity test mutation-checked.
**Still open:** `D4` **decide by 09-30** · `AC20` **10-16** · `AC5`, `AC23` on hardware.
**Next mode:** `C5` ADControls, then wiring `C2`/`C1` against the `MediaAdapter` seam — the last pieces that do not need Bedrock.

---

## R27 · 2026-09-25 · claude-opus-5 (Claude Code) · built C5 — and found that what would verify it cannot be switched on
**Read:** `_facts.yml` (v17) · `_log.md` (through R26 end) · `02c2` Phase 11
**Log read through:** R26
**Did:** built `C5` with 14 tests, then went looking for the thing that would verify it — and found it is not there.

### The component
Every assertion goes through `announceForAccessibility`, not through rendered text, because the rendered half is the half these users do not receive. `stateMessage` is exported so the test asserts the **same string the component speaks**; two copies of that sentence is a test that passes while the app says something else.

Four that carry a `Fails if:`:
- **both failure sentences must say playback continues.** "No description track was found" alone reads as *this title is broken*, and a blind viewer has no way to check the picture is fine.
- **an unchanged state must not re-announce.** A re-render that speaks again talks over the film on the one channel these users have. Mutation-checked: removing the guard turns it red.
- **the level selector announces itself as `disabled` when description is off.** Pressing it otherwise produces no feedback at all — nothing plays, so nothing confirms the press.
- **the toggle reports the NEW value** and never touches the video (`AC3`).

### R27-F1 `FUNCTIONAL`, and it moves an acceptance criterion: VoiceView cannot be turned on here
`AC15` says the control surface is *exercised under VoiceView*. It cannot be, on this device, by any route available to a developer:

- the VVD's Settings app has **no Accessibility section** at all;
- the documented Back+Menu chord does not fire;
- `vdcm set "com.amazon.devconf/system/accessibility/VoiceViewEnabled" "ENABLED"` returns **`No permission for operation`** — from `vega device run-cmd` *and* from `vega device shell`, which `id` confirms are the same `uid=5000(app_user)` context (`limits.vega_media.run_cmd_is_sandboxed` again).

`vdcm get` on the same key reads `DISABLED` without complaint, so the key is right and **only the write is refused**. The first two routes match what another developer reported independently (`related_docs[R-VEGA-MSE-THREAD]`); the third is measured here.

**`AC15` therefore closes on physical hardware only**, joining `AC5` (audible ducking) and `AC23` (the memory bound). Three hardware-only criteria, all named on **day 7 of 34** instead of in `02d` Phase 16.3 — which is the difference between a purchase decision and a discovery.

**What it does not block:** `C5` ships its whole accessibility surface regardless. Those are React Native APIs and the suite tests what they announce. The gap is verification that VoiceView *consumes* them — a verification gap, not a build one, and it is stated as such rather than left implied by a green suite.

**Note on where the answer lived:** the working `vdcm` key is documented in a **0.22** WebView accessibility guide. This project targets 0.24, and the key appears on no 0.24 page reachable from the docs. 35 minutes, most of it spent guessing key names. Friction entry written.

**Edits:** `src/ad/ADControls.tsx` new · `test/ADControls.spec.tsx` (14) new · `_facts.yml` (`limits.vega_media.voiceview_not_enablable` new, `changes[C5].built`, `acceptance[AC15].closes_on`, `tests_baseline` re-measured) · `01-master-plan.md` (§8 risk row) · `FRICTION-LOG.md` (+1) · `_profile.yml`.
**Validation:** `npm test` exit 0 — jest **48**, vitest 44 · `npm run lint` exit 0 · `audit.py` → clean · the announce guard mutation-checked.
**Still open:** `D4` **decide by 09-30** · `AC20` **10-16** · `AC5`, `AC15`, `AC23` all hardware-only.
**Next mode:** the `MediaAdapter` seam (`02c` Phase 7) — extract what `PlayerScreen` and `DescriptionAudio` already do into `src/platform/vega/`, which is the last structural move before `C2`/`C1` wire the whole thing together.

---

## R28 · 2026-09-25 · claude-opus-5 (Claude Code) · the MediaAdapter seam, and three defects a fake could not show
**Read:** `_facts.yml` (v17) · `_log.md` (through R27 end) · `02c` Phase 7 · `02c2` Phase 10
**Log read through:** R27
**About to do:** build `src/platform/MediaAdapter.ts` and `src/platform/vega/index.ts` by EXTRACTING what `PlayerScreen` and `DescriptionAudio` already do, plus `src/ad/duck.ts` for the JS fade. The check that says it worked is structural and mechanical: `rg "@amazon-devices/react-native-w3cmedia" src/ --glob '!src/platform/**'` must return nothing, and it returns two files today.
**Scope stated before starting, so its absence is not read as an oversight:** the `limits.mse_buffer` WINDOW is NOT in this round. Windowed append needs `contracts.asset_manifest.byte_index` to serve a seek, and that is its own piece of work with its own acceptance criterion (`AC23`). This round keeps the whole-file append that works today and marks the seam where the window goes.
### Done
`src/platform/MediaAdapter.ts`, `src/platform/vega/index.tsx`, `src/ad/duck.ts`; `PlayerScreen`, `DescriptionAudio` and `App` rewired. **The seam holds, and it is now a test rather than a sentence** — `pipeline/__tests__/seam.test.ts` walks `src/` and fails if any file outside `src/platform/` names a platform package, or if anything but `App.tsx` chooses a platform. A check that lives only in a document runs when somebody remembers it, and this one decays silently: the first import added outside the seam costs nothing and breaks nothing, and by the time `changes[C12]` is packaged the seam is a comment.

The interface needed four things it did not have — `open`/`play`/`pause`/`destroy` (as first written it described observation and volume, and the screen still had to reach the platform to start anything), and `VideoSurface`, because mounting the surface **is** platform code and a screen importing it directly puts a platform symbol straight back where the seam removed it.

Tests above the seam now use a **fake adapter written against the interface**, not against Vega. `test/PlayerScreen.spec.tsx` loads no platform module at all, which is the behavioural half of the structural check.

### Three defects, and the third one is the reason this round ran on hardware
- **`R28-F1` — a cue in flight outlived the screen.** Unmount mid-cue and its `await` chain keeps going, then its `finally` ramps the volume of a player that has been destroyed, after `stop()` already restored it. Fixed with a generation counter, and `rampVolumePct` gained a cancellation check: **a fade is a loop that outlives the reason it started**, and one that has been superseded should stop rather than finish travelling toward a target nobody wants. Jest reported it as *"Cannot log after tests are done"*, which is the same defect wearing a smaller hat.
- **`R28-F2` — the cue's `setTimeout` was never cleared.** Leaving the screen within two seconds fired a cue at an adapter being torn down, and two seconds is exactly the window a viewer changes their mind in.
- **`R28-F3` — `waiting` fires during NORMAL startup**, 2 ms after `play()` resolved, on a clip that then played to the end. `stalled` was written as terminal, so the app announced *"Buffering"* over a film that was playing perfectly well — to a viewer who cannot see that it is. The seam gained `onPlaying` and the state became one playback can leave.

**`R28-F3` is the round's argument for itself.** No fake emits a spurious `waiting`; the fake emits what the interface says it may, and the interface was written from what the code already did. Only the device produced it. A refactor validated solely against a fake adapter — which is what a green suite invited here — would have shipped a permanent "Buffering" overlay and called the seam finished.

### Not built, stated rather than implied
The `limits.mse_buffer` **window**. Windowed append needs `contracts.asset_manifest.byte_index` to serve a seek, and it has its own criterion (`AC23`) measured on the worst device. The whole-file append that works today is kept and marked at the seam it belongs to. Anything feature-length still runs this process out of heap, which is a real limit and is written down where the code is rather than only in a plan.

**Edits:** `src/platform/MediaAdapter.ts`, `src/platform/vega/index.tsx`, `src/ad/duck.ts`, `test/fakes/adapter.tsx`, `test/PlayerScreen.spec.tsx`, `pipeline/__tests__/seam.test.ts` new · source media moved `assets/` → `media/` (+ `.gitignore`, manifest, README, two suites) · `src/screens/PlayerScreen.tsx`, `src/ad/DescriptionAudio.ts`, `src/App.tsx`, `test/App.spec.tsx` rewritten · `02c` Phase 7 interface synced · `_facts.yml` (`limits.vega_media.waiting_fires_at_start`, `changes[C2].built`, `[C4].built`, `tests_baseline`).
### R28-F4, found by eye while checking something else: the package was 497 MB
`react-native build-vega` copies the **entire project-root `assets/` directory** into the package, verbatim, whether or not anything references it. The demo film and its 720p source lived there for the offline pipeline, so a 372 MB `.mov` and a 117 MB `.mp4` were riding to the device on every install. Nothing in the build output says so, `install-app` reports plain `success`, and **the app ran normally the whole time**.

Source media moved to `media/`. Package: **497 MB → 2.68 MB**, 185× smaller. Recorded as `limits.vega_media.build_packages_assets_dir` with the rule stated plainly — *`assets/` at the project root is device space* — because the trap is silent and the next person to put a working file there will be me.

For a hackathon judged by people who clone and build, a half-gigabyte artifact is the first impression.

**Validation:** `npm test` exit 0 — jest **59**, vitest **46** across 6 files · `npm run lint` exit 0 · `tsc --noEmit` clean · seam check mechanical · **on the device**: `player.opened bytes=2628566` → `play resolved` → `player.stalled` → **`player.resumed from=stalled`** 1.4 s later → `cue.fire` → `cue.audio state=ended t=2.02`. The `resumed` line is instrumentation added for this round: the stall recovery had no log of its own, and a state change nobody can observe is a state change nobody can verify.
**Still open:** `D4` **decide by 09-30** · `AC20` **10-16** · `AC5`, `AC15`, `AC23` hardware-only · `limits.mse_buffer` unimplemented.
**Four defects this round, and three of them needed the device or the filesystem — none of the three could have come from a unit test.**
**Next mode:** `C1` App shell and navigation, then `02d` Phase 17 — removing the Phase 0 instrumentation, which is ordered after the last run that reads it rather than after the last code phase.

---

## R29 · 2026-09-26 · claude-opus-5 (Claude Code) · the shell, and the description layer wired before it has anything to load
**Read:** `_facts.yml` (v17) · `_log.md` (through R28 end) · `02d` Phase 13
**Log read through:** R28
**Did:** the shell, and then wired `C6`, `C3` and `C5` into the player — which was the round's real decision.

### Wiring the description layer BEFORE there is a track to load
`defects[D4]` blocks `C9`, so no track file exists or can exist yet. The tempting move is to leave the loader unwired until one does.

The opposite is better, and the device proved it: wire it now and the app enters the **`missing` state**, which is not a corner case — it is the state this app is genuinely in until `D4` clears, and it is exactly what `AC8` is about. Measured on the device:
```
INTERSTICE.controls.announce kind=missing
INTERSTICE.loader.miss path=/pkg/bundle/.../tears-of-steel.standard.track.json
INTERSTICE.scheduler.load cues=0
```
So `decisions.verbosity_levels`' lookup rule, `C6`'s missing-vs-malformed split and `AC8`'s spoken sentence are all exercised end to end on real hardware, with zero cue text in existence. The film plays; the app says the description is absent and that playback continues. That is the product behaving correctly under its current constraint rather than waiting for one.

### R29-F1: the whole `src/ad/` layer was invisible on the device
`TrackLoader`, `CueScheduler`, `ADControls` and `DescriptionAudio` all logged with `console.log`, which on this platform reaches nobody (`limits.vega_media.no_js_console`, measured in R18). Four components with careful diagnostics, none of them observable where it matters. Routed through the beacon, and the run above is what that bought.

One line was missing entirely: **`DescriptionAudio` never logged the volume RESTORE.** `AC5` asserts the main track returns to full, and an assertion nobody can observe on the device is an assertion that closes on trust. Now `INTERSTICE.audio.restored`, and the device shows it landing 0.5 s after the cue ends.

### R29-F2: `BackHandler` is real on Vega, and absent from the test environment
The jest preset's shim has no `BackHandler`, so a screen using it throws under test while working perfectly on the device. The platform ships `BackHandler.kepler.js`, which wires the standard interface to `UserInputManager`; there is also a Vega-specific `useKeplerBackHandler` for `exitApp`.

Filled the gap in `test/setup.ts` rather than mocking the module, so the distinction stays honest: **a hole in the test environment, not a missing platform capability**, and the component keeps importing the portable API. The kepler module exposes its exports as **getters**, so a plain assignment is a silent no-op — `Object.defineProperty` is what actually replaces it, and that cost a cycle to find.

### Verified with the remote, not by reasoning
`inputd-cli button_press KEY_ENTER` on the title list → `INTERSTICE.app.play id=tears-of-steel` → the player opens, plays, resumes from the startup stall, fires the probe cue, ducks and restores. Then `KEY_BACK` → `INTERSTICE.player.back from=playing`. `AC2`'s claim that BACK has a stated destination is now a thing that happened rather than a thing written down.

**Edits:** `src/App.tsx` rewritten (title list, navigation) · `src/screens/PlayerScreen.tsx` (loader, scheduler, controls, BACK, coalesced seek) · `src/ad/*` routed through the beacon, `DescriptionAudio` +restore log · `test/setup.ts` new · `test/App.spec.tsx` rewritten, `test/PlayerScreen.spec.tsx` +4 · `jest.config.json` (`setupFilesAfterEnv`) · `_facts.yml` (`changes[C1].built`, `[C5]` wired, `tests_baseline`) · `_profile.yml`.
**Validation:** `npm test` exit 0 — jest **65**, vitest 46 · `npm run lint` exit 0 · `audit.py` clean · package **2.69 MB** · device run quoted above.
**Still open:** `D4` **decide by 09-30 — four days** · `AC20` **10-16** · `AC5`, `AC15`, `AC23` hardware-only · `limits.mse_buffer` unimplemented.
**Next mode:** `D4` is the one with a date on it and it is not a coding task. Everything downstream of `C9` — the tracks, `AC7`, `AC14`, `AC18`, the cost figure — waits on an answer from AWS or the organisers, and the case is now one sentence long.

---

## R30 · 2026-09-26 · claude-opus-5 (Claude Code) · D4 re-measured after redemption; the last cheap discriminator named
**Read:** `_facts.yml` (v17) · `_log.md` (through R29 end)
**Log read through:** R29
**Did:** re-ran `defects[D4]` a third time, and found a hole in my own sequence. R23 tested Bedrock after the credits were **granted** but before they were **redeemed** — and redemption required a payment method on file, which is the one account-state change in this whole episode that could plausibly have mattered. Tested now, post-redemption: **byte-identical**, `authorizationStatus NOT_AUTHORIZED` beside three `AVAILABLE`s. `n: 3`, spread recorded.

**The owner pasted the retired model-access console page.** Its content was already eliminated in R10 — the page is retired, models auto-enable on first invoke, and the first invoke is what fails — and the two control mechanisms it names are both eliminated here: IAM identity policies do not apply to root, and the account is not in an Organization so there are no SCPs.

But it named one thing worth acting on: the **console playground**. Every measurement in this set is on the CLI path. The console invokes over a different path with a console session, and the two outcomes split cleanly:
- it fails identically → the account-scope conclusion is confirmed from a second independent route, and the support case gets shorter;
- it **succeeds** → the fault is in the API/credential path rather than the account, which is a different and far more fixable problem, and `D4` stops being a blocker.

Browser-only, so it belongs to the owner. Recorded in `defects[D4]` as NOT YET RUN rather than left as a suggestion in a chat log.

**Also drafted, and deliberately NOT committed:** an AWS support case and a message to the hackathon organisers. The support case carries the account id once filled in and this repository is public. The organisers' message asks the cheaper of the two questions — whether the AWS Builder mini challenge requires a specific service or any AWS service with a documented integration. `decisions.hackathon_track` already reads it as the latter, Polly works, and a one-line confirmation there turns `D4` from a blocker into the cost of one feature.

**Edits:** `_facts.yml` (`defects[D4]` evidence `n: 3` with the redemption spread; two additions to the eliminated list; the console-playground discriminator).
**Validation:** `audit.py` → clean.
**Still open:** `D4` **decide by 09-30 — four days** · `AC20` **10-16** · `AC5`, `AC15`, `AC23` hardware-only.
**Next mode:** the owner runs the playground test and sends the two messages; code continues on anything not downstream of `C9`.

---

## R31 · 2026-09-26 · claude-opus-5 (Claude Code) · D4 characterised as far as measurement can take it
**Read:** `_facts.yml` (v17) · `_log.md` (through R30 end)
**Log read through:** R30
**Did:** the owner ran the console-playground test R30 named. **It fails identically** — Nova Lite, us-east-1, from the browser with a console session rather than CLI credentials, same `ValidationException`, same `Error 002`, character for character.

**That closes the characterisation.** Two independent code paths, one answer. It is not the SDK, not request signing, not the CLI credentials and not the API shape. The refusal is at the account, and nothing this app or this repository can do changes it.

**`defects[D4]` is now `n: 4`** across four runs and three account states — before the credit grant, after the grant, after the redemption (which required a payment method on file), and from the console. Byte-identical every time. A defect measured four times through three state changes is not a flaky one.

**What remains is not a debugging step, and saying so is the point.** Every further hour spent on this inside the repository is an hour spent on a question the repository cannot answer. Two messages, drafted and on the owner's clock:
- an **AWS support case** asking why `authorizationStatus` is `NOT_AUTHORIZED` beside three `AVAILABLE`s, with the eight eliminations attached so nobody re-runs them;
- a **question to the organisers**, which is the cheaper of the two: `decisions.hackathon_track` already reads the AWS Builder mini challenge as satisfied by any AWS service with a documented integration, Polly works and is now paid for by the credits, and a one-line confirmation turns `D4` from a blocker into the cost of one feature.

Neither is committed. The support case carries the account id once filled in and this repository is public — the same rule that kept the credit code out of it.

**The seam is why waiting is cheap.** `C9` is one function behind one call (`invokeNova` in `pipeline/describe.ts`). `alternatives[A5]`'s third rung — a non-Bedrock vision provider for `C9` alone — touches that function and nothing in `C7`, `C8`, `C10` or `src/`. So there is no reason to spend build time on the swap before **09-30**: the decision is cheap to execute late precisely because the scope was isolated early.

**Edits:** `_facts.yml` (`defects[D4]` evidence `n: 4` with the console path in the spread; the discriminator moved from NOT YET RUN to RUN with its result; the remaining work restated as questions rather than as debugging).
**Validation:** `audit.py` → clean.
**Still open:** `D4` — **decide by 09-30, four days**, and no longer a technical question · `AC20` **10-16** · `AC5`, `AC15`, `AC23` hardware-only.
**Next mode:** `limits.mse_buffer` and `AC23` — the last large piece that does not depend on Bedrock.

---

## R32 · 2026-09-26 · claude-opus-5 (Claude Code) · support's hypothesis tested and disproven; a new one from a skill
**Read:** `_facts.yml` (v17) · `_log.md` (through R31 end) · skill `amazon-bedrock`
**Log read through:** R31
**Did:** AWS Support's first reply proposed that using the account **root** was itself the cause. The owner created an IAM user with explicit Bedrock permissions. Tested: **same `Error 002`**, character for character. `n: 5` — three identities, two code paths, one answer.

**The cleanest piece of evidence in this whole episode fell out of it.** With that same IAM user, minutes apart:
```
aws account get-contact-information --profile interstice   -> AccessDeniedException
aws bedrock-runtime invoke-model   --profile interstice ... -> ValidationException / Error 002
```
When that user lacks a permission, AWS says `AccessDeniedException`. When it **has** the permission — proven by `list-foundation-models` and `polly describe-voices` both succeeding on the same credentials — Bedrock says `ValidationException`. **A missing policy cannot produce a ValidationException.** Two error classes from one identity, and the difference is the argument.

This is the second time an outside diagnosis has been tested rather than argued with (the first was the credit grant in R23), and the second time the prediction was written down before the test. That is the only thing that makes either of them a measurement.

**A new hypothesis, and it did not come from reasoning harder.** The `amazon-bedrock` skill's troubleshooting table has **no entry for Error 002** — worth recording, because it means this is not a documented common failure. It does document `INVALID_PAYMENT_INSTRUMENT` as *"an account billing issue, not Bedrock"*, fixed by a default credit card or a **USD payment profile**. Different string, same shape: an account-level billing condition gating model access.

It fits every measurement — account scope, all regions, control plane unaffected because it bills nothing, Polly unaffected, credits irrelevant because a credit balance is not a payment instrument. **Not yet checked**; it lives in the Billing console and belongs to the owner. Recorded in `defects[D4]` as a named hypothesis rather than left as a hunch in a chat log.

**Second support reply drafted** (`scratchpad/d4-support-reply-2.txt`, not committed) leading with the disproof, then the `AccessDenied` vs `ValidationException` discriminator, then the billing question.

**Edits:** `_facts.yml` (`defects[D4]`: `n: 5`, the identity elimination with the discriminator, the billing-instrument hypothesis, and the note that the Bedrock skill documents no Error 002).
**Validation:** `audit.py` → clean.
**Still open:** `D4` — **decide by 09-30** · `AC20` **10-16** · `AC5`, `AC15`, `AC23` hardware-only.
**Also noted, unrelated to D4:** installing the AWS agent toolkit wrote an `aws-mcp` server into `~/.claude.json` **globally**, plus Codex, Cursor, Gemini CLI and OpenCode. The repo's own convention is per-project MCP with local scope, never global. Flagged to the owner; not changed without asking.

---

## R33 · 2026-09-26 · claude-opus-5 (Claude Code) · D4's cause found: a form nobody was told about
**Read:** `_facts.yml` (v17) · `_log.md` (through R32 end)
**Log read through:** R32
**Did:** found the cause of `defects[D4]`.

```
aws bedrock get-use-case-for-model-access --region us-east-1
-> ResourceNotFoundException: You have not filled out the request form.
   Fill out the form before getting access.
```

**The account had never submitted the Bedrock use-case request form.** That is all `Error 002` ever meant.

### How it was found, which is the part worth keeping
Not by reasoning. By a **permissions failure**. The owner signed into the Bedrock console as the narrowly-permissioned IAM user created in R32, and the console UI emitted a dozen `AccessDeniedException`s for actions it wanted and could not have. One of them was `bedrock:GetUseCaseForModelAccess` — **an API that no error message in four days had ever mentioned**. The console, failing, disclosed the existence of the check that was failing us.

Two rounds earlier the same IAM user had produced the discriminator that killed support's hypothesis. This is the second time that deliberately under-permissioned user taught us something a correctly-permissioned one would have hidden.

### Why six rounds, and why none of them was wasted
`Error 002` says *"Access to Bedrock models is not allowed for this account"* and never mentions a form. `get-foundation-model-availability` reports `NOT_AUTHORIZED` beside three `AVAILABLE`s and never mentions a form. The console playground fails and never mentions a form. AWS Support proposed the account root and was wrong.

Every hypothesis eliminated in R10, R23, R30, R31 and R32 was eliminated **correctly**. None of them could have been the answer, because the answer was a prerequisite nobody was told about. The eliminations are what made the remaining space small enough that an accidental clue was recognisable as a clue.

### Not closed
`defects[D4].status` is `resolved` on its **cause**, not on its effect. The form is submitted by the owner through the console: `put-use-case-for-model-access` takes an opaque blob of at least 1100 bytes, which is the serialised console form. **This set will not guess that schema or invent business details to send to a vendor on the owner's behalf.** `D4` closes when a Nova call returns a completion, which is also `alternatives[A5].falsified_by`.

### What unblocks the moment it clears
`C9` (`pipeline/describe.ts`), and behind it `AC7`, `AC14`, `AC18`, the three track files, and `worst_case.est_cost_usd` — which has been `null` since R13 because no call had ever been priced. `A5`'s ladder is not needed if the form works, and the **09-30** decide-by stops being a cliff.

**Edits:** `_facts.yml` (`defects[D4]` → `status: resolved`, `outcome` carrying the cause, the finding method and the reason it took six rounds) · `FRICTION-LOG.md` (+1, and it is the strongest entry in the file: the information exists inside the service and is withheld from the error that needs it).
**Validation:** `audit.py` → clean.
**Still open:** the form submission itself · `AC20` **10-16** · `AC5`, `AC15`, `AC23` hardware-only.
**Next mode:** owner submits the form; then re-run the Nova call and, if it returns, `C9` is unblocked and the pipeline can produce a real track for the first time.

---

## R34 · 2026-09-26 · claude-opus-5 (Claude Code) · AC23's design settled by a probe, not by a preference
**Read:** `_facts.yml` (v17) · `_log.md` (through R33 end) · `02d` Phase 12
**Log read through:** R33
**About to do:** `limits.mse_buffer` and `AC23` — the windowed append that lets `changes[C2]` play something longer than a 20-second clip.
**Measuring before designing, because the design forks on it:** a window needs to read PART of the asset, and there are two ways to get one. Byte-range requests over `fetch`, which needs the platform to honour a `Range` header on a packaged `file://` path — unknown, never tested here. Or splitting the asset into segments at build time, which always works and changes `contracts.asset_manifest` and the pipeline instead. Guessing which costs a rewrite; probing costs one build.
### R34-F1 `FUNCTIONAL`, and it decided the design: byte-range requests are not honoured
```
INTERSTICE.range.full    status=200 bytes=2628566
INTERSTICE.range.partial status=200 bytes=2628566 asked=65536 content_range=none honoured=false
```
Asking for the first 64 KB of a 2.6 MB packaged asset returns **status 200, the whole body, no `Content-Range`**.

**The failure mode is the dangerous kind — it looks like success.** A window built on byte ranges would appear to work, would pass every test written against a 20-second clip, and would silently hold the entire file in memory on a feature-length one. That is precisely the out-of-memory `AC23` exists to prevent, arriving through the mechanism meant to prevent it.

**The probe logged the byte LENGTH and not only the status, which is the only reason this was visible.** `status=200` alone reads as a working fetch, and a `Range` header that is ignored produces exactly that. Designing on the status would have been designing on a lie.

**So the window cannot be obtained by reading part of a file.** The asset is cut into whole segments at build time and the app appends whole segments. `limits.mse_buffer.chunk_bytes` is gone and `segment_s: 6` replaces it; `contracts.asset_manifest.byte_index` and `contracts.byte_index_entry` are replaced by `segments` and `contracts.media_segment`.

**Measuring before designing is the whole point of this round.** The two candidate designs differ by a build step and a contract, and choosing wrong costs a rewrite; the probe cost one build. The stub above said so before the answer was known, which is what makes this a measurement rather than a justification.

**Edits:** `_facts.yml` (`limits.vega_media.no_range_requests` new · `limits.mse_buffer` re-shaped to segments · `contracts.asset_manifest.segments` and `contracts.media_segment` replacing the byte-index pair) · `pipeline/manifest.ts` and its suite · `media/tears-of-steel.manifest.json` · `01-master-plan.md` §8 · `02d` Phase 12 · `src/platform/vega/rangeProbe.ts` new, marked TEMPORARY and tied to `02d` Phase 17.
**Validation:** `npm test` exit 0 · `npm run lint` exit 0 · `audit.py` clean · measured on the device as quoted.
**Still open:** the `AC23` window itself is NOT built — this round bought the fact it rests on · the Bedrock use-case form · `AC20` **10-16** · `AC5`, `AC15`, `AC23` hardware-only.
**Next mode:** the segmenter (`ffmpeg` fMP4 segments + an init segment, written into the manifest), then the windowed append in `src/platform/vega/`.

---

## R35 · 2026-09-26 · claude-opus-5 (Claude Code) · the segmenter and the window, with the half that is not proven named
**Read:** `_facts.yml` (v17) · `_log.md` (through R34 end)
**Log read through:** R34
**About to do:** `pipeline/segment.ts` — cut the asset into fMP4 segments plus an init segment, and write them into `contracts.asset_manifest.segments`. Then the windowed append in `src/platform/vega/`: init first, then whole segments, `ahead_s` forward and `SourceBuffer.remove()` behind. `AC23` is what measures the result, and it measures it on the worst device rather than here.
### Built
`pipeline/segment.ts` cuts the asset with ffmpeg into fragmented-MP4 segments plus an init segment, and `src/platform/vega/SegmentBuffer.ts` holds the window. `MediaAdapter.open` now takes an `AssetSource` instead of a URI.

**A whole-file asset is one segment covering the whole timeline**, so the short demo clip and a feature-length one take the *same* path. A separate "just append it" branch for short assets would mean the windowing code only ever runs on the asset nobody tests with.

### R35-F1: ffmpeg does not produce the segment length you ask for
`-hls_time 6` on the demo clip produced segments of **9.94s, 4.17s, 5.29s and 0.65s**, because it cuts on keyframes. Two consequences, both load-bearing:

- **Durations are read from the emitted playlist, never derived from the requested length.** A scheduler built on `index * 6000` would drift further from the picture with every segment, and `AC4` is about cues landing inside real dialogue gaps.
- **The window is measured in TIME, not in segment COUNT.** "Keep five segments" would mean anything between 3 and 50 seconds of media on this asset. That is not a memory bound, and a memory bound is the entire point of `limits.mse_buffer`. `segmentsForWindow` and `segmentsToEvict` both take milliseconds, and the test that pins it carries the arithmetic in its `Fails if:`.

The test fixture is the **real, uneven** playlist ffmpeg emitted, not a tidy one with 6.0s segments — the R25 lesson applied to a fixture instead of a mock: a fixture nobody's tool produces tests a file that does not exist.

### Two more platform facts, both cheap and both invisible until they bite
- **`m4s` is not in metro's default `assetExts`.** A required segment resolves as JavaScript and the bundler fails on the first byte. Added in `metro.config.js`.
- **`SourceBuffer` accepts exactly one operation at a time** — the package's own doc says *"Throw InvalidStateError if 'updating' is true"*, and on this platform that surfaces as a media error indistinguishable from a bad file. Every append and every `remove` is serialised behind one promise chain, and `ensure()` is safe to call on every `timeupdate` because of it.

`SegmentBuffer` types its target **structurally** — the five members it actually uses — rather than naming `SourceBufferImpl`. `addSourceBuffer` is typed as returning the W3C interface, which does not declare `addEventListener`, while the implementation behind it has one and R18 measured that it works. Binding to the concrete class would drag in two dozen internals this file never touches.

### On the device
```
INTERSTICE.asset.segments n=4 init=set
INTERSTICE.buffer.appended init bytes=1343 held=0
INTERSTICE.buffer.appended seg0 bytes=649534 held=0
INTERSTICE.buffer.appended seg1 bytes=1037183 held=1
INTERSTICE.buffer.appended seg2 bytes=856989 held=2
INTERSTICE.buffer.appended seg3 bytes=83877 held=3
INTERSTICE.buffer.complete segments=4
INTERSTICE.player.opened segments=4 init=yes
```
The whole chain, from `pipeline/segment.ts` output to a playing picture.

### What is NOT proven, said plainly
**Eviction.** A 20-second clip with a 30-second window never drops anything, so `evict()` has unit tests and **no device run**. That is exactly `AC23`, and `AC23` was always going to need a feature-length asset on the worst device in the matrix. `limits.mse_buffer.built` records the split rather than letting a green suite imply the whole thing was exercised.

**Edits:** `pipeline/segment.ts`, `pipeline/__tests__/segment.test.ts` (10), `src/platform/vega/SegmentBuffer.ts` new · `MediaAdapter` gains `AssetSource`/`AssetSegment`, `open` takes it · `src/platform/vega/index.tsx`, `src/screens/PlayerScreen.tsx`, `src/App.tsx`, `test/fakes/adapter.tsx`, `test/PlayerScreen.spec.tsx` threaded through · `metro.config.js` (`m4s`), `jest.config.json` (`m4s`), `.gitignore` (generated segments) · `_facts.yml` (`limits.mse_buffer.built` and `.segment_uneven`, `changes[C2].built`, `tests_baseline`).
**Validation:** `npm test` exit 0 — jest 65, vitest **56** across 7 files · `npm run lint` exit 0 · `audit.py` clean · device run quoted above.
**Still open:** `AC23`'s evict half, on hardware · the Bedrock use-case form · `AC20` **10-16** · `AC5`, `AC15` hardware-only.
**Next mode:** `C10` emitting segments and a manifest, so `src/App.tsx` stops hand-listing them.

---

## R36 · 2026-09-26 · claude-opus-5 (Claude Code) · the scope drift I introduced, and the check that stops it recurring
**Read:** `_facts.yml` (v17) · `_log.md` (through R35 end)
**Log read through:** R35
**Found, by comparing the tree against the registry rather than by an audit check:** EIGHT components built between R22 and R35 have no `changes[]` entry — `pipeline/budget.ts`, `pipeline/types.ts`, `pipeline/manifest.ts`, `pipeline/segment.ts`, `src/ad/duck.ts`, `src/diagnostics.ts`, `src/platform/MediaAdapter.ts`, `src/platform/vega/index.tsx`, `src/platform/vega/SegmentBuffer.ts`, `src/platform/vega/rangeProbe.ts`. `changes[]` IS the scope of this set, and it has been describing a smaller project than the one on disk for fifteen rounds.
**Why no check caught it:** audit check 7 (scope parity) is one of the human-pass checks. The script compares `changes[]` against the DOCS; nothing compared it against the TREE. This is the drift the skill exists to prevent, introduced by the agent that runs the skill.
**Also found:** `src/components/Tile.tsx` and `src/data/tiles.tsx` are `vega project generate` template leftovers that nothing imports — except `test/Tile.spec.tsx`, which keeps them green. A test whose only purpose is to stop dead code from being noticed is a small lie about coverage, in a repository a judge will clone and read.
**About to do:** register the real components, delete the dead ones, and add the tree-vs-registry comparison as a mechanical check so this cannot recur silently.
### R36-F1: the registry described a smaller project than the one on disk
Ten source files had no `changes[]` entry. Registered as `C18`–`C26`: the `MediaAdapter` seam, its Vega implementation, `SegmentBuffer`, `duck.ts`, `diagnostics.ts`, `types.ts`, `budget.ts`, `manifest.ts` and `segment.ts`.

**`changes[]` is what `review` sweeps, what `implement` writes phases against, and what anyone reading this project uses to know what it consists of.** A file the registry has never heard of is outside all three — so for fifteen rounds the gap sweep could not have found a hazard in `SegmentBuffer`, and a cold reader would have been handed a component list missing the platform seam.

**No check caught it, and the reason is worth recording.** `audit.py` check 7 is scope parity, it is a HUMAN-pass check, and it compares `changes[]` against the **documents**. Nothing compared it against the **tree**. So the whole apparatus was consistent with itself and wrong about the world — which is the exact failure this skill exists to prevent, produced by the agent running the skill.

Fixed mechanically as well as in data: `pipeline/__tests__/scope.test.ts` walks `src/` and `pipeline/` and fails if any source file is undeclared. Mutation-checked — an empty `src/unregistered_probe.ts` turns it red and removing it turns it green. The audit then caught the other half: four of the new entries were registered but cited in no document, so they are now cited where they belong (`02c` §7.3, `02d` Phase 12 and Phase 17, `02b2` Phase 6).

### R36-F2: two tests existed only to keep dead code green
`src/components/Tile.tsx` and `src/data/tiles.tsx` are `vega project generate` leftovers that **nothing imports** — except `test/Tile.spec.tsx`, which kept them passing. A test whose only purpose is to stop dead code from being noticed is a small lie about coverage, and this repository is one a judge clones and reads. All three deleted; the jest count fell from 65 to 63, and that fall is the honest direction.

Also deleted: `src/platform/vega/rangeProbe.ts`. It answered its question in R34 and the answer is in `limits.vega_media.no_range_requests`. A probe kept past its result is future confusion about whether it still measures something.

### Dependencies on the owner, since it was asked
Four, and none blocks any remaining code: the **Bedrock use-case form** (blocks `C9` and everything downstream of it), the **question to the organisers**, the **`AC20` participant** (drop-dead **10-16**), and **physical hardware** for `AC5`, `AC15` and `AC23`.

**Edits:** `_facts.yml` (`changes[C18..C26]`, `tests_baseline`) · `pipeline/__tests__/scope.test.ts` new · deleted `src/components/Tile.tsx`, `src/data/tiles.tsx`, `test/Tile.spec.tsx`, `src/platform/vega/rangeProbe.ts` · `02b2`, `02c`, `02d` citations · `_profile.yml`.
**Validation:** `npm test` exit 0 — jest **63**, vitest **58** across 8 files · `npm run lint` exit 0 · `npm run build` exit 0 · `audit.py` clean · scope check mutation-checked.
**Still open:** unchanged — the form, `AC20`, and the three hardware criteria.
**Next mode:** `C10` emitting segments and a manifest, so `src/App.tsx` stops hand-listing them.

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
