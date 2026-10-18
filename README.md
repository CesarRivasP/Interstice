# Interstice

**AI-generated audio description for Fire TV, spoken in the silences between dialogue.**

Most films ship with no audio description track. A blind or low-vision viewer gets the
dialogue and the sound design, and nothing about what the camera is showing — who entered
the room, what a character is holding, where the scene moved to. Where description does
exist it was produced by hand, per title, which is why coverage is thin and uneven.

Interstice generates it. A vision model reads the frames of a film, writes a description of
what is on screen, and speaks it in the natural gaps between lines of dialogue — on the
television itself, with no second device.

> Built for the **Build, Ship, Shape: Amazon Developer Hackathon** — **Fire TV** track, on
> **Vega OS**, with both mini challenges: **AWS Builder** and **Open Source**.
>
> **Open Source entry:** the TV-side description layer — cue scheduling, ducking, the
> remote controls and a Vega OS media adapter — is published as
> [`react-native-tv-audio-description`](https://github.com/CesarRivasP/react-native-tv-audio-description)
> ([npm](https://www.npmjs.com/package/react-native-tv-audio-description)), and this app
> consumes it from npm like any other would.

---

## How it works

The hard problem in audio description is timing: a description that runs past its gap talks
over the next line of dialogue, which is worse than no description at all. Interstice solves
it with data that already ships with the film.

1. **Find the silences.** The subtitle file gives the timing of every line of dialogue.
   Overlapping speech is merged first — two speakers otherwise manufacture negative gaps —
   and every remaining silence of at least **1500 ms** is a candidate.
2. **Split what is too long, drop what is too short.** A gap is not a cue. On the demo asset,
   five gaps run past 30 seconds and carry 68% of all the words; the longest is 167 seconds.
   Gaps longer than **12 s** are split into consecutive cue windows, each with its own frames
   and its own budget. Windows too short to carry three words are dropped rather than filled
   with noise.
3. **Look at the film.** Up to **3** frames per cue via ffmpeg — the midpoint, plus per-shot
   frames when the window spans a cut, because one midpoint frame misdescribes a gap that
   crosses one.
4. **Name the cast once.** A first pass builds a *dramatis personae* from the opening frames
   and subtitle speaker cues, fed into every later prompt so the same character is named the
   same way from the first cue to the last.
5. **Write to fit.** Each cue goes to a vision model on Amazon Bedrock with its frames, the
   surrounding dialogue, the cast list and the previous ten descriptions. The word budget is
   **derived from the gap** at 160 wpm — not requested from the model — and a response that
   exceeds it is rejected.
6. **Speak it.** Amazon Polly synthesises each cue. The output is a description track plus
   its audio clips, regenerated once per verbosity level.
7. **Play it on the TV.** The app schedules each cue against playback position, ducks the
   film to 25%, plays the clip, and restores. The remote toggles description on and off
   without interrupting playback and switches between three verbosity levels.

### Measured on a real film

Run against the English subtitle track of *Tears of Steel*:

| | |
|---|---|
| subtitle cues | 76 |
| speech spans after merging overlaps | 67 |
| gaps ≥ 1500 ms | **38** |
| cues after splitting long gaps | ~70 |
| dialogue | 136.2 s — 18.6% of runtime |
| **describable silence** | **577.0 s — 78.6% of runtime** |

Nearly four fifths of the film is silence this product can use.

---

## Verification

**[The verification report](https://cesarrivasp.github.io/Interstice/e2e/)** shows the app running through its use cases on the Vega Virtual Device: what was on screen, what the viewer was told, and the trace lines that decided each result — mapped to every acceptance criterion in `docs/features/interstice/`, including the ones it cannot close and the two it currently fails. The same page is in the repository at `docs/e2e/index.html`.

To re-run it: a booted Vega Virtual Device (SDK 0.24), Node 20+, `ffmpeg`, then

    npm run e2e:release     # the submitted build — five scenarios, no fixtures
    npm run e2e:report      # rebuilds the page from the committed run; needs no device

`npm run e2e:variant` runs a test build against a labelled fixture and injects faults; it additionally needs `media/tears-of-steel.mp4` and `npm run e2e:fixtures` once. How it is built, and what it cannot show: `docs/features/e2e-harness/`.

## Status

This is a hackathon build in progress. What is true today, and what is not, is tracked
honestly rather than implied:

- ✅ Vega SDK 0.24.12112, app builds and **runs on the Vega Virtual Device**
- ✅ Gap detection (`pipeline/gaps.ts`) measured against the real demo asset
- ✅ Word-budget model with three genuinely distinct verbosity levels, under test
- ✅ Cue scheduling, ducking and remote controls on the Virtual Device — through the
  published [`react-native-tv-audio-description`](https://www.npmjs.com/package/react-native-tv-audio-description)
- ✅ Frame extraction and speech synthesis built and tested
- ⏳ Description of the frames — blocked on Bedrock access for this AWS account (a
  use-case form), so no generated track has run end to end yet
- ❌ **Live frame capture is not possible on Vega and will not ship.** `VideoPlayer` renders
  to a native surface; decoded pixels never reach JavaScript. The prepared-track path was
  made the base path precisely because this was unverified, and it turned out false.

---

## Setup

**Prerequisites**

- **Node.js 20+** (this was built on v24.16.0)
- **Vega SDK 0.24+** — see [Install the Vega SDK](https://developer.amazon.com/docs/vega/0.24/install-vega-sdk.html)
- **ffmpeg and ffprobe** on `PATH` (pipeline only)
- AWS credentials with `bedrock:InvokeModel` and `polly:SynthesizeSpeech` (pipeline only —
  the app calls no AWS service at runtime)

**Install and verify**

```bash
npm install
npm test          # jest for the app, vitest for the pipeline
npm run lint
```

**Run on the Vega Virtual Device**

```bash
vega virtual-device start
npm run build
vega run-app build/x86_64-release/interstice_x86_64.vpkg com.cesarrivasp.interstice.main -d VirtualDevice
```

**Run the pipeline**

The asset manifest (`media/tears-of-steel.manifest.json`) names the media file, the
subtitles and the describable content windows. The media file itself is downloaded, never
committed. Output lands under `generated/<asset_id>/`: one `<asset_id>.<verbosity>.track.json`
per level, `audio/` with one fragmented-mp4 clip per cue, and `frames/` plus `cache/` so a
re-run pays only for what is missing or failed.

```bash
# No account, no network: a fake vision model and a fake Polly (ffmpeg silence),
# everything else real. Runs without the media file too (frames are stubbed then).
npm run pipeline -- --dry-run

# Bedrock for the descriptions (the default provider), Polly for the voice
export AWS_REGION=us-east-1
export BEDROCK_MODEL_ID=amazon.nova-pro-v1:0
export POLLY_VOICE_ID=Joanna
export DEMO_ASSET_MANIFEST=media/tears-of-steel.manifest.json
npm run pipeline

# Anthropic Messages API for the descriptions, Polly for the voice
export DESCRIPTION_PROVIDER=anthropic
export ANTHROPIC_API_KEY=...           # ANTHROPIC_MODEL_ID defaults to claude-sonnet-5-5
npm run pipeline

# Optional flags: --levels standard,concise  --limit 5  --out <dir>  --frames stub
```

If Bedrock answers with the account-level `Error 002` the run stops on its first call with
a message naming `DESCRIPTION_PROVIDER=anthropic`. The pipeline never switches providers on
its own. A throttle is retried with exponential backoff, five attempts, then that one cue is
written `status: failed` and the track still emits.

Environment variables carry **names only** — no credential is in the repository or in the
app bundle. The device reads a generated track file; it does not call AWS.

---

## Known issues

**`npm audit` reports vulnerabilities from the platform template.** A fresh install reports
27 (14 moderate, 13 high). Nine of them are in the *production* dependency tree, reached
through `@amazon-devices/react-native-kepler`, which lists `@microsoft/api-extractor` under
its own `dependencies` rather than `devDependencies` — pulling in `ajv`, `minimatch` and
`lodash` with it. They are build- and documentation-time tools that Metro does not bundle
into the app package, and `npm audit fix` resolves none of them: every remaining fix is
marked breaking against the platform's own version pins. Stated here rather than left to be
discovered. It is also filed as product feedback — a documentation tool in a runtime
dependency list is a packaging bug that can be fixed upstream.

---

## How this was built

The full specification set lives in [`docs/features/interstice/`](docs/features/interstice/):
a facts registry that is the single source of truth, a master plan, five implementation
documents, a stakeholder document, and an append-only handoff log.

Every claim in it declares its basis — `measured` with the command and output behind it,
`asserted` with the observation that would falsify it, or `decided`. Running the code
against real data repeatedly falsified the plan, and the log records each time:

- The three verbosity levels were **twice** designed so that two of them produced identical
  output. Running the arithmetic caught it the second time.
- The pipeline was written one-cue-per-gap. The real subtitle file showed 68% of the words
  live in gaps longer than 30 seconds, which forced a one-to-many redesign and corrected the
  model-call estimate by 84%.
- Three build commands written from `--help` output were wrong, and were only caught by
  running them.

A [friction log](FRICTION-LOG.md) records what fought back, with a *what would have helped*
line on each entry.

---

## Credits and licensing

The demo asset is **[*Tears of Steel*](https://mango.blender.org/)** © copyright Blender
Foundation, licensed **[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)**. English
subtitles from [download.blender.org](https://download.blender.org/demo/movies/ToS/subtitles/).
No commercial or personally recorded content appears anywhere in this project.

This project is licensed under the [MIT License](LICENSE).
