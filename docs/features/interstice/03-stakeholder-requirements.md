# Requirements for the external readers — Interstice — AI audio description in the gaps between dialogue, on Fire TV

> Document for the readers outside the build. It lists what they receive, what we need from them, and how each claim is checked.

- **Date:** 2026-09-19
- **Full context:** `01-master-plan.md`
- **Scope:** `C1` `src/App.tsx` · `C2` `src/screens/PlayerScreen.tsx` · `C3` `src/ad/CueScheduler.ts` · `C4` `src/ad/DescriptionAudio.ts` · `C5` `src/ad/ADControls.tsx` · `C6` `src/ad/TrackLoader.ts` · `C7` `pipeline/gaps.ts` · `C8` `pipeline/frames.ts` · `C9` `pipeline/describe.ts` · `C10` `pipeline/synthesize.ts` · `C12` `github.com/CesarRivasP/react-native-tv-audio-description` *(external)* · `C13` `FRICTION-LOG.md` · `C14` `SUBMISSION.md`. Deferred and **not** part of what is handed over: `C11` `src/ad/LiveCapture.ts`, `C15` `pipeline/normalize_cast.ts`, `C16` `pipeline/subtitle_guard.ts`.

> Shared data comes from `_facts.yml`. **The contracts below are copied from the registry's `contracts.*`, not from another document** — mirroring doc 01 or doc 02 would create a second copy with no source of truth, which is exactly what this spec set exists to prevent. That they also match `01-master-plan.md` §4 and `02e-tests-and-done.md` §B.2 is a consequence of all three coming from the same place, not something to verify document against document.
> Written by `implement` (stage 2), alongside `02` and `02b`.

> **Two external readers, and they are not the same person.** `_facts.yml docs[] 03` records that this set has no external owner in the usual sense — it is a solo entry — and that the reader of this document is **the judging panel**: what the submission hands over and how it is checked. But `_facts.yml owners.external` also names a real external person: the blind or low-vision **validation participant** for `AC20`, who is outside this team and runs on their own clock (`tracking.blocked_by`). They are the one party with an actual ask. This document therefore addresses both, separated at every section: **§A** for the judging panel, **§B** for the validation participant. Nothing in §A is an ask; everything in §B is.

---

## Changelog

Same tag + date spine as `01-master-plan.md` (`_facts.yml dates.revisions[]`), showing only what changes the external side.

### 2026-09-21 — v7: doc 03 written

`implement` round R8. Written alongside the five files of doc 02. §A.4 comes from `contracts.*`, §B.6 from `acceptance[]`, both read out of the registry.

### 2026-09-19 — v6: owner confirmed — `status: draft -> reviewed`

Doc 03 comes into scope.

### 2026-09-19 — v5: review R5 dispositions

`AC20` was promoted from an invisible assumption to a **named external dependency**: `owners.external`, `tracking.blocked_by`, recruitment opening in Phase 0 rather than Phase 5, and a drop-dead date of **10-16**. §B of this document exists because of that finding. The contracts in §4 were corrected in the same round — `source_frames_ms` is an array and `verbosity` is a field.

### 2026-09-19 — v3: user validation, gap visualization, verbosity

`decisions.user_validation` created the session §B describes. `decisions.gap_visualization` and `decisions.verbosity_levels` changed what the panel sees in the video.

---

# §A — For the judging panel

## A.1 Idea in one sentence

Most films ship with no audio description, so a blind viewer gets the dialogue and none of the picture — **Interstice** watches the film with a vision model, writes a description of what is on screen, and speaks it in the natural silences between lines of dialogue, on the television itself.

## A.2 What we provide (our side)

The submission hands over five things. Each is a deliverable in `_facts.yml changes[]`, not a promise.

| what | where | registry |
|---|---|---|
| **The app** — runs on Vega OS, plays a film, speaks generated descriptions in the gaps, toggled and tuned from the remote | the public repository | `C1`..`C6` |
| **The pipeline** — turns a film plus its subtitle file into a description track: gaps, frames, model calls, synthesis | the same repository, `pipeline/` | `C7`..`C10` |
| **The open-source package** — `react-native-tv-audio-description`, the TV-side description layer as a standalone installable project with a runnable example | `github.com/CesarRivasP/react-native-tv-audio-description` | `C12` |
| **The friction log** — dated entries written while building, covering Vega OS, Bedrock and Polly | `FRICTION-LOG.md` | `C13` |
| **The submission package** — demo video under 3 minutes, gap visualization, product feedback, validation quote, Devpost fields | `SUBMISSION.md` | `C14` |

**Declared entries** (`decisions.hackathon_track`): **Fire TV** as the primary track, on **Vega OS**, with **both** mini challenges stacked on top — **AWS Builder** (Bedrock and Polly) and **Open Source** (`C12`). A submission may win at most one track prize and one mini-challenge prize.

**How it works, in the order it happens:**

1. The subtitle file gives the timing of every line of dialogue. The silences between them are the gaps. Only gaps of at least **1500 ms** (`limits.ad.min_gap_ms`) are usable — anything shorter cannot hold a sentence.
2. For each gap, up to **3** frames are extracted (`limits.ad.frames_per_gap_max`): the midpoint, plus one per shot when the gap spans a cut, because one frame misdescribes a gap that crosses one.
3. One pass over the opening frames builds a cast list (`decisions.dramatis_personae`), so the same character is named the same way from the first cue to the last.
4. Each gap's frames, its surrounding dialogue, the cast list and the previous **10** descriptions (`limits.ad.rolling_context_cues`) go to a vision model on Bedrock, which returns a description **bounded to what fits in that gap** at **160 words per minute** (`limits.ad.speaking_rate_wpm`). The bound is derived from the gap, not requested from the model.
5. Polly speaks each description. The output is a track file plus its audio clips.
6. On the television, the app schedules each cue against playback position, ducks the film to **25%** (`limits.ad.duck_target_pct`) over **200 ms**, plays the clip, and restores. The remote toggles description and switches between three verbosity levels.

**What this deliberately does not do**, and why it is not an omission:

- **It does not describe live, from the frame currently on screen.** That layer (`C11`) is `kind: deferred`: whether Vega OS exposes the rendered frame to JavaScript is an unverified hypothesis (`defects[D1]`), and `decisions.hybrid_ad_path` records the choice to make the guaranteed path the one that ships. A demo that runs beats a live path that does not.
- **It does not send anything from the television to a cloud service at runtime.** Every model call happens offline, on the developer's machine, against a film that is already public. The device reads a generated file. If `C11` ever ships, it is off by default and names its destination before the first send (`decisions.privacy_optin`).
- **It does not use a third-party judgment vendor.** `C15`/`C16` were designed against TypeSafe and then deferred (`decisions.typesafe_judgment_layer`) — a non-Amazon vendor adds an API key and a setup step to a repository the panel has to run, and the problems it addressed already carry mitigations.

## A.3 What we ask of the panel

Nothing to build. Three things to check, each of which the sections below make runnable.

1. **Run the open-source package's example from a clean clone** (§A.5). It is the mini-challenge entry and the claim is that it works from nothing, in one command.
2. **Read the friction log as a record, not as a pitch.** The dates are spread across the build because the entries were written as things broke (`decisions.friction_log_shape`). That is the only form of the document worth reading.
3. **Watch the gap visualization before the app demo.** A gap is silence, and silence does not read on video. The timeline strip in the first thirty seconds is what makes the rest of the demo legible (`decisions.gap_visualization`).

## A.4 The interface you receive (reference)

The one contract in the system is the **description track** — the file the pipeline writes and the app reads. It is the interface between the offline half and the device, and it is the artifact to inspect if the question is "was this really generated?".

Copied from `_facts.yml contracts.description_track`:

```json
{
  "version": "string",
  "asset_id": "string",
  "generated_at": "string",
  "source_subtitles": "string",
  "verbosity": "concise | standard | detailed",
  "model_id": "string",
  "cues": "array<description_cue>"
}
```

Each cue, from `_facts.yml contracts.description_cue`:

```json
{
  "id": "string",
  "start_ms": "int",
  "end_ms": "int",
  "words": "int",
  "text": "string",
  "audio_uri": "string",
  "source_frames_ms": "array<int>",
  "status": "ok | failed"
}
```

**Three fields worth a sentence each, because they are where the design is visible:**

- **`source_frames_ms`** is a list, not a number. A gap that spans a cut is described from up to `limits.ad.frames_per_gap_max` frames, and the track records **which ones** — so any cue can be checked against the picture afterwards by seeking to those exact timestamps. A track that cannot be audited against its source is a track nobody can dispute.
- **`status: failed`** exists so a throttled or rejected cue does not break the track. The cue is emitted with no text and the app skips it; the film still plays. A pipeline that aborts on one bad response is a pipeline that produces nothing on a bad afternoon.
- **`verbosity`** is what lets the app know which of the three generated tracks it loaded. The files are named `<asset_id>.<verbosity>.track.json` beside the asset, and a level switch resolves by that name, falling back to `standard` (`decisions.verbosity_levels`).

**Endpoints** (`_facts.yml endpoints`), both AWS, both called only from the offline pipeline:

```http
bedrock-runtime.{AWS_REGION}.amazonaws.com InvokeModel
polly.{AWS_REGION}.amazonaws.com SynthesizeSpeech
```

A third endpoint is registered and **not called**: `api.typesafe.ai/v1/systemone POST (Authorization: Bearer TYPESAFE_API_KEY)`. It stays in the registry so `C15`/`C16` would reopen against a verified endpoint rather than a remembered one. No code in the submission reaches it.

Configuration is by environment variable — **names only, never values**, and no credential is in the app bundle: `AWS_REGION`, `BEDROCK_MODEL_ID`, `POLLY_VOICE_ID`, `DEMO_ASSET_PATH`, `DEMO_SUBTITLES_PATH`, `TYPESAFE_API_KEY`.

## A.5 Checklist for the panel

Each item is verifiable by the panel alone, without us.

- [ ] **The repository is public, open-source licensed, and has setup instructions** — `limits.hackathon.repo_must_be`. Clone it into an empty directory and follow the README from the top.
- [ ] **The open-source package runs from a clean clone in one command** (`AC10`). `git clone`, `npm install`, `npm run example`. Not from our working copy — from nothing.
- [ ] **The package's commits land inside the submission window** (`AC10`). `git log` on `react-native-tv-audio-description`. A repository whose history predates the hackathon is not a hackathon entry.
- [ ] **No cue text is hand-written** (`AC7`). Open any `*.track.json`, pick a cue, seek the film to any timestamp in its `source_frames_ms`, and compare. Then re-run the pipeline and confirm the text changes — a hand-written track does not.
- [ ] **No description overruns its gap** (`AC4`). For every cue, `words` against `end_ms - start_ms` at 160 wpm. This is the constraint the whole design is built around and it is checkable with one script over the track file.
- [ ] **The three verbosity levels are genuinely different** (`AC17`). The three track files have the same cue count and different word totals. If two files are identical, the feature is a slider that does nothing.
- [ ] **The friction log was written during the build, not after** (`AC11`). Dates spread across phases rather than clustered on one day.
- [ ] **The demo video is under 3 minutes, in English, on the target platform** (`AC12`) and shows the app under **VoiceView** (`AC15`) — an accessibility product whose own controls are unusable by its users is not the product it claims to be.
- [ ] **The impact claim carries a source** (`AC16`). The figure on audio-description coverage cites where it came from.
- [ ] **No unauthorized copyrighted material** (`decisions.demo_asset_licensing`). The demo plays an openly licensed Blender Foundation open movie, chosen for carrying **substantial dialogue** — a near-dialogue-free film would collapse the gap structure into one continuous gap and there would be no mechanism to demonstrate. The license and source are recorded in the README.

## A.6 What the panel sees demonstrated, and how each claim is checked

Derived from `_facts.yml acceptance[]` — the criteria that need an external reader to be worth anything are the ones below. The full twenty, with the phase that closes each, are in `02e-tests-and-done.md` §Acceptance criteria.

| claim | how the panel sees it checked |
|---|---|
| The gaps are real, and found in the data (`AC4`) | the timeline strip in the video: dialogue blocks, gaps, cue markers, and the sub-threshold gaps visibly rejected (`AC19`) |
| The descriptions are generated, not written (`AC7`) | the track file, its `model_id` and `generated_at`, and `source_frames_ms` pointing at frames anyone can seek to |
| Descriptions never talk over dialogue (`AC4`) | the split-screen before/after in the video, plus `words` against gap length in any track file |
| Playback is never interrupted by the controls (`AC3`) | the video: the toggle is pressed mid-scene and the film does not pause |
| The three levels are a feature, not a checkbox (`AC17`) | the video switches all three mid-playback; the three track files differ |
| The app works for the people it is for (`AC15`) | the VoiceView segment of the video |
| It works for a real viewer, not a hypothesis (`AC20`) | the quote from the validation session in §B, in the video and in `SUBMISSION.md` |
| The failure modes were designed, not discovered (`AC8`) | rename the track file and launch: the app says what happened, out loud, and the film still plays |

**One criterion is deliberately not demonstrated.** `AC9` covers the live-capture layer, which is `kind: deferred` (`C11`) and does not ship. It is listed here rather than quietly dropped, because a criterion that disappears between the plan and the submission is the thing a careful reader notices.

---

# §B — For the `AC20` validation participant

> This is the only section of this document that asks anyone for anything. It addresses the blind or low-vision viewer named in `_facts.yml owners.external`, recruited in Phase 0 (`02-implementation-and-e2e.md` Phase 0.5) for a session in Phase 5.

## B.1 The ask, in one sentence

Watch about twenty minutes of a short film on a television with this description turned on, and tell us honestly whether it helped — where it was useful, where it got in the way, and where it was simply wrong.

## B.2 What we provide

- The television, the app and the film, already set up. Nothing to install, nothing to configure.
- The film is *Tears of Steel* or *Elephants Dream* — an openly licensed short, not something you need to have seen.
- A session of **20–30 minutes** at a time you choose, remote or in person, whichever suits you.
- The same scenes played **with** description and **without**, so the comparison is yours to make rather than ours to claim.

## B.3 What we need from you

1. **Consent, recorded before anything starts.** What the session is for, what is kept, and what is published. You can stop at any point and you can withdraw afterwards.
2. **Twenty to thirty minutes of watching**, with the description on for some scenes and off for others.
3. **Your reaction, unfiltered** — particularly the negative parts. A description that arrives too late, talks over a line, names someone wrongly, or states something obvious is more useful to us than one that worked.
4. **Permission — or refusal — for one short anonymized quote.** If you agree, one sentence of yours appears in the submission write-up and possibly in a 3-minute video. Refusing costs nothing and changes nothing else about the session.

## B.4 What we do with it

- **No personal information enters the repository.** Not a name, not a contact, not a recording (`decisions.user_validation`). The repository is public and stays that way.
- The quote, if you allow one, is **anonymized** — no name, no identifying detail.
- Your reaction changes the product before submission, not after: cues rated poorly in the session are regenerated (`AC14`, `limits.ad.quality_gate`).

## B.5 Checklist for you

- [ ] The consent has been read and agreed **before** the session starts
- [ ] The session ran **20–30 minutes**, with and without description
- [ ] You said where it helped **and** where it did not
- [ ] You have said yes or no to the anonymized quote, and either answer is final

## B.6 How we test together

From `_facts.yml acceptance[]` — `AC20`, the one criterion that cannot be closed without you:

> at least one blind/low-vision viewer validates the track before Phase 5 (20–30 min, with/without comparison, consent on file); anonymized quote retained for SUBMISSION.md/video

The session runs in this order, and the comparison comes before the discussion so the first impression is not led:

1. A scene with description **off** — what comes through from dialogue and sound alone.
2. The same scene with description **on** — what changes.
3. Fifteen minutes of continuous watching with description on.
4. The three verbosity levels (`concise`, `standard`, `detailed`) on the same scene — which one you would actually keep.
5. Open discussion. The questions in §B.7.

## B.7 Questions to close

For the participant, asked at the end of the session:

1. Did any description arrive **late** — on top of a line of dialogue rather than in the silence before it? That is the single failure mode this whole design exists to avoid, and it is the one you would notice first.
2. Was anyone **named inconsistently** across the film — the same character described one way and then another?
3. Was any description **obvious** — telling you something the dialogue or the sound had already made clear?
4. Which verbosity level would you keep, and would you have wanted a fourth, shorter or longer?
5. Is there something you expected to be described that never was?

For the panel, and the honest ones:

6. **Would this belong on a real television?** The submission argues the television should do this alone rather than asking the viewer to hold a second device. That premise is worth disputing.
7. **Is the deferred live-capture layer the right call?** `decisions.hybrid_ad_path` chose the guaranteed path over the impressive one. In a hackathon scored partly on technical ambition, that is a trade, and it was made deliberately.

## Annex A — reference: the three-level word budget

Included because it is the part of the design most easily mistaken for a slider that does nothing.

A cue's length is not chosen by the model. It is derived from the gap it has to fit in, at `limits.ad.speaking_rate_wpm` (**160 wpm**):

```
ceiling      = floor((gap_ms - 300) / 1000 * 160 / 60)   # limits.ad.max_words_per_cue
cue target   = floor(ceiling × scale)                     # limits.ad.verbosity_scales
```

with the scales `concise` ×**0.6**, `standard` ×**0.85**, `detailed` ×**1.0**.

The `- 300` is the duck ramp (`limits.ad.duck_ramp_ms`, 200 ms) plus 100 ms of margin: the film takes that long to duck and to come back, and the time is not available for speech.

**The ceiling does not vary by level, and that is the point.** The gap is a physical bound — a level that asked for *more* words than fit would simply overrun into the next line of dialogue, which is what `AC4` forbids and what the whole design exists to prevent. So the levels are targets *under* one ceiling rather than multipliers of it: `detailed` spends the whole gap, `standard` leaves a little room, `concise` says the minimum that carries the shot. They come out strictly different at every gap size from 1500 ms up — which is the check in §A.5 and the thing `AC17` is scored on.
