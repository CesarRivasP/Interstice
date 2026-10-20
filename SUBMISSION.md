# Submission package — Interstice

**What this file is.** The Devpost submission, drafted in the repository so every field has a
source and a date. It is `changes[C14]` in `docs/features/interstice/_facts.yml`, and `02d`
Phase 16 of the implementation spec says what it must hold. Every number below was measured
and lives in the registry; every claim about the hackathon rules was read from the rules
page on 2026-10-18 (`limits.hackathon`).

**How to use it on submission day (target 2026-10-22, deadline 2026-10-23 12:00 PT).**
Paste the blocks in §2 into the Devpost form field by field.

**The fork this file used to carry closed on 2026-10-19, on a third branch neither side
foresaw.** Amazon Bedrock still refuses every inference call (`Error 002`, `defects[D4]`; the
use-case form, submitted 2026-10-18, changed nothing). The vision call sits behind a
one-method provider interface (`pipeline/providers/`), so a Google Gemini implementation was
added beside the Bedrock one, and on 2026-10-19 the pipeline generated its first real track
on Gemini's free tier: **21 of the 55 standard-level cues** came back within budget before the
free tier's daily quota ran out (`_log.md` R49). The rest run after the quota resets.

**Still to fill, and by whom:** `[N]` in §2.2, the count of standard cues that came back `ok`
after the final run · the video URL (`[VIDEO URL]`, after upload on 10-22) · see §5 for what
has to happen on the device before the text in §2.2 is true of the demo.

---

## 1. Devpost field checklist

Every field the form asks for, per the rules page read 2026-10-18, and where its text comes
from. A box is ticked when the text exists in §2; **submitting is `AC13`** and happens once,
by hand, on the form.

| # | Devpost field | status | draft |
|---|---|---|---|
| 1 | Project name | ready | §2.1 |
| 2 | Tagline | ready | §2.1 |
| 3 | Description — *must name Vega OS, Fire TV, Amazon Bedrock, Amazon Polly explicitly* | ready, `[N]` to fill | §2.2 |
| 4 | Built With | ready | §2.3 |
| 5 | Repository URL(s) | ready | §2.4 |
| 6 | Demo video URL (YouTube or Vimeo, public, under 3 minutes, English) | **placeholder** — fill 10-22 | §2.4, script in §3 |
| 7 | Primary track | ready — Fire TV, on Vega OS | §2.5 |
| 8 | Mini challenge(s) | ready — AWS Builder and Open Source | §2.5 |
| 9 | Open Source block — contribution URL, repository URL, GitHub username, what / how / why | ready | §2.6 |
| 10 | AWS Builder block — which AWS services and how, inside the product feedback | ready | §2.7 |
| 11 | Product feedback — five questions per tool, API or SDK used (**required**) | ready | §2.8 |
| 12 | Feature requests with priority (optional) | ready | §2.9 |
| 13 | Friction log (optional, up to 10% bonus) | ready — `FRICTION-LOG.md`, 16 entries with severity | §2.10 |
| 14 | Image / thumbnail | ready — `docs/video/devpost-thumbnail.jpg`, 1500×1000 (3:2): the film frame at 3:40.0 with the generated cue `217000-223000` quoted verbatim, the tagline and the CC BY attribution | — |
| 15 | Team / Representative | the technical owner, solo entry (`owners.technical`) | — |

**Rules facts that shape the above** (`limits.hackathon`, re-read 2026-10-18):

- Friction-log entries must carry *"specific task attempted, steps taken, expected vs. actual result, severity rating, workaround used, and actionable suggestion"*. `FRICTION-LOG.md` was reshaped to that on 2026-10-18 without touching a dated word.
- Product feedback is **required** per tool: what it was used for, what worked, what needs work, onboarding from zero to hello world, and whether you would build with it again and why.
- Third-party media in the video must be content we have the rights to, properly attributed, and the video must primarily show our own project. The only third-party media is *Tears of Steel* (CC BY 3.0), played **inside the app** as the demo asset — it is the content the product describes, not background footage. Attribution line in §4.
- Devpost's submission-tips mail (2026-10-05): name the track tool explicitly in the description, in Built With and in the video; no API keys anywhere; treat the video as a pitch.
- AWS credit codes ran out on 2026-10-07. Ours was granted and redeemed on 2026-09-25, so nothing here depends on that.
- Office hours #2: Monday 2026-10-19, 9:00 PT — the last chance to ask the organisers anything before the form.

---

## 2. Paste-ready text, field by field

### 2.1 Name and tagline

**Project name:** Interstice

**Tagline:** AI audio description for Fire TV, spoken in the silences between dialogue.

### 2.2 Description

> **Interstice** generates audio description for films and plays it on **Fire TV**, on the
> television itself, with no second device.
>
> Most films ship without an audio description track. A blind or low-vision viewer gets the
> dialogue and the sound design, and nothing about what the camera is showing. Where
> description exists it was produced by hand, per title, which is why coverage is thin: the
> American Council of the Blind's Audio Description Project counted **13,109** titles with an
> English description track across cinema, DVD and more than twenty streaming services at
> the end of 2025 — against catalogues that run to tens of thousands of titles per service.
>
> **How it works.** The hard problem in audio description is timing: a description that runs
> past its gap talks over the next line, which is worse than no description at all.
> Interstice solves it with data that already ships with the film. The subtitle file gives
> the timing of every line of dialogue; every silence of at least 1.5 s between lines is a
> candidate; gaps longer than 12 s are split into cue windows. For each window the offline
> pipeline extracts up to three frames with ffmpeg, sends them with the surrounding
> dialogue, a cast list and the previous ten descriptions to a vision model — **Amazon
> Bedrock** by design, Google Gemini for the demo (below) — and bounds the answer to the
> words that fit the window at 160 words per minute.
> The bound is derived from the gap, not requested from the model. **Amazon Polly** speaks
> each cue; ffmpeg repackages the audio into fragmented MP4, because the device's player
> fetches nothing itself and only Media Source Extensions appends play. The output is one
> description track per verbosity level — concise, standard, detailed — with genuinely
> different cue counts (47 / 55 / 60 on the demo film).
>
> On the TV, a **React Native for Vega OS** app plays the film through the W3C media API,
> schedules each cue against playback position, fades the film to 25 %, plays the clip and
> restores. The remote toggles description without interrupting playback and switches
> verbosity levels mid-scene. Every state — loading, playing, stalled, error, track missing
> — has a focus host and a spoken sentence, because for this app's users a frozen picture and
> silence are the same thing.
>
> **Measured on a real film.** Against the English subtitles of *Tears of Steel* (Blender
> Foundation, CC BY 3.0): 76 subtitle cues, 67 speech spans, 39 usable gaps, 451.8 s of
> describable silence — 74 % of the film's content. Three quarters of a dialogue-driven short
> is time this product can use.
>
> **What is honest about this build.**
>
> The description track in the demo was generated by the pipeline, with no hand-written cue
> text: `[N]` of the 55 standard-level cues, each naming in `source_frames_ms` the frames it
> was written from, so any cue can be checked against the picture. A cue the model could not
> answer within its budget is marked `failed`, never written by hand.
>
> The model that wrote it is **not** the one the pipeline was designed around. Amazon Bedrock
> refuses every inference call on the entrant's AWS account (`Error 002: Access to Bedrock
> models is not allowed for this account`), measured on every attempt across four weeks,
> three regions, two APIs, three identities and the console playground, before and after the
> use-case form AWS documents for it was submitted. The vision call sits behind a one-method
> provider interface, so a Google Gemini implementation was added beside the Bedrock one and
> the track was generated on Gemini's free tier; the track's `model_id` field names the models
> that answered. Bedrock remains the default provider, unit-tested against a mocked
> `Converse`. Everything downstream of the model (synthesis with real Polly audio, the
> container chain, scheduling, ducking, the controls, every failure state) is verified on the
> Vega Virtual Device by a scripted end-to-end harness whose report is published from the
> repository.
>
> **Also true:** the TV-side layer is published as an open-source package,
> `react-native-tv-audio-description`, which this app installs from npm like any other
> consumer. VoiceView could not be enabled on the Vega Virtual Device by any documented
> route, and no physical Fire TV was available, so the screen reader is not shown. A
> validation session with a blind or low-vision viewer was planned, nobody was confirmed by
> the cut-off, and it was dropped rather than faked. Live description from the frame on
> screen was ruled out by measurement: Vega's `VideoPlayer` renders to a native surface and
> decoded pixels never reach JavaScript.

### 2.3 Built With

Paste as tags, in this order, so the track tools come first:

```
Vega OS · Fire TV · React Native for Vega (0.83) · Vega SDK 0.24 · Vega Virtual Device ·
@amazon-devices/react-native-w3cmedia · Media Source Extensions · Amazon Bedrock (Converse API,
Amazon Nova) · Amazon Polly (neural) · AWS SDK for JavaScript v3 · Google Gemini API ·
react-native-tv-audio-description ·
TypeScript · ffmpeg · Jest · Vitest · Amazon Devices Builder Tools (MCP server + Agent Skills)
```

**Status of the on-device demonstration on 2026-10-19**, so the coordinator can update it: the
harness report at <https://cesarrivasp.github.io/Interstice/e2e/> (`docs/e2e/index.html`) runs
the app through its scenarios on the Vega Virtual Device: 12 pass and 1 blocked (S17, seeking,
which the harness cannot drive on the device — e2e-harness `defects[D6]`). The two defects it
found earlier — reopening a title after BACK, and a corrupt track announced as missing
(`_log.md` R46-F1, R46-F2) — were fixed and re-verified on 2026-10-18. Those runs use the
labelled fixture track; §5 has the re-run on the generated one.

### 2.4 URLs

| field | value |
|---|---|
| Project repository | <https://github.com/CesarRivasP/Interstice> |
| Open-source contribution (new repository, MIT) | <https://github.com/CesarRivasP/react-native-tv-audio-description> |
| Package on npm | <https://www.npmjs.com/package/react-native-tv-audio-description> |
| Verification report (GitHub Pages, from `docs/e2e/index.html`) | <https://cesarrivasp.github.io/Interstice/e2e/> |
| Demo video | `[VIDEO URL]` — YouTube, public, filled on 10-22 |

### 2.5 Track and mini-challenge declarations

> **Primary track:** Fire TV — a React Native for Vega app running on Vega OS, demonstrated on
> the Vega Virtual Device.
>
> **Mini challenges:** AWS Builder (Amazon Polly and Amazon Bedrock in the offline pipeline;
> see the product feedback for exactly what answered and what did not) and Open Source
> (`react-native-tv-audio-description`, a new MIT repository with every commit inside the
> submission window).

### 2.6 Open Source mini challenge

> **Contribution URL:** https://github.com/CesarRivasP/react-native-tv-audio-description
> **Project repository URL:** https://github.com/CesarRivasP/Interstice
> **GitHub username:** CesarRivasP
>
> **What I did.** I extracted the TV-side audio-description layer of Interstice into a
> standalone, platform-agnostic React Native package and published it as
> `react-native-tv-audio-description` (MIT, now 0.2.0 on npm, 88 tests, a runnable Node example
> and a Vega example app). Interstice then deleted its own copies and installs the package from
> npm, so the submission is a real consumer of it rather than a mirror. 0.2.0 came from that
> consumer: the harness screenshots showed the controls' focus was invisible on a television,
> so the package gained a visible focus state and a `theme` prop, and the app moved to it.
>
> **How it works.** The package owns everything between a description track file and the
> television: `TrackLoader` reads and validates the track and falls back to the standard
> verbosity when a level is missing; `CueScheduler` fires each cue against playback position
> and coalesces seeks and held-key repeats so a scrub never fires a cue per key event;
> `DescriptionAudio` plays the clip while fading the main track to a target level and back —
> in JavaScript, because the platform volume setter is instantaneous; `ADControls` is the
> remote-driven toggle and verbosity switch with a spoken state for every condition. All of it
> talks to the player through one `MediaAdapter` interface, and the package ships the Vega
> adapter (`/vega`), built on `@amazon-devices/react-native-w3cmedia` and Media Source
> Extensions. Another platform supplies another adapter and keeps everything else.
>
> **Why it matters.** Audio description on a TV app is a scheduling and mixing problem that
> every app would otherwise solve again, badly, or not at all. Six of the defects the package
> fixes were found by running it on the Vega Virtual Device — among them that `sourceopen`
> re-fires, that a paused player never reaches `ended`, and that the URL mode of the player
> does not fetch — and each is now a test anyone installing it inherits.

### 2.7 AWS Builder mini challenge

> **Services used, and how.** Both are called only from the offline pipeline on the
> developer's machine; the television never calls AWS and the app bundle carries no
> credential.
>
> - **Amazon Polly** (`SynthesizeSpeech`, neural engine, voice Joanna) speaks every
>   description cue. Measured working on the entrant account from the first call; the output
>   is repackaged by ffmpeg into fragmented MP4 (AAC-LC) because that is the only container
>   the Vega player will append, and real Polly bytes were played over a running film on the
>   Vega Virtual Device with the main track ducked.
> - **Amazon Bedrock** (`Converse` API, Amazon Nova Pro / Nova Lite, multimodal) is the vision
>   model that writes each description from up to three frames, the surrounding dialogue, a
>   cast list and rolling context, bounded to the words that fit the gap.
>   **It has never answered this account.** Every inference call returns
>   `ValidationException — Error 002: Access to Bedrock models is not allowed for this
>   account`, identical in three regions, for `InvokeModel` and `Converse`, from the account
>   root, a dedicated IAM user and the console playground, before and after the AWS
>   promotional credit, and five minutes after the use-case form was submitted through
>   `PutUseCaseForModelAccess` on 2026-10-18. The control plane works and lists the full Nova
>   catalogue; Polly works on the same credentials. The integration is built and tested
>   against a mocked `Converse`; what is missing is an account that is allowed to call it.
>   Because the vision call is one interface, the demo track was generated through a Google
>   Gemini implementation of it instead — Polly still speaks every cue.
>
> The AWS Builder brief asks for AWS services with documented integrations; Polly satisfies
> it on its own and is what the demo actually uses. Bedrock is declared because the code is
> there and because the four-week account refusal is the most useful product feedback this
> project has to give.

### 2.8 Product feedback — per tool, the five questions

Format per the rules: *(1) used for · (2) what worked · (3) what needs work · (4) onboarding
zero-to-hello-world · (5) would you build with it again, and why.* Every "needs work" item
has a dated entry in `FRICTION-LOG.md`; the number in brackets is the entry's date.

#### Vega SDK 0.24.12112 and Vega CLI 1.3.4

> **(1)** Building, packaging, installing and launching the app on the Virtual Device;
> streaming native logs; forwarding a port for the diagnostics beacon; driving the device from
> scripts for the end-to-end harness.
> **(2)** The CLI is coherent and scriptable once installed: `vega virtual-device start`,
> `vega run-app`, `vega device is-app-running` and `start-log-stream` each do one thing and
> their output is parseable, which is what let a scripted harness run both of its suites
> unattended. The Virtual Device decoded the 1280×534 H.264 demo asset with zero
> dropped frames. `manifest.toml` validation errors are precise.
> **(3)** The installer has no non-interactive mode and reads `/dev/tty` directly, so no CI,
> container or coding agent can complete the one step the rest of the agent-oriented toolchain
> depends on [09-22]. `vega device run-cmd` runs as a sandboxed `app_user` and reports things it
> cannot see as absent — `ENOENT` where the truth is "not permitted" — which nearly produced a
> wrong root cause [09-25]. There is no `vega device screenshot`, `record` or `press`, although
> the emulator underneath can do all three over gRPC; the capability exists, the command does
> not [09-25, 10-04]. `build-vega` packages the whole project-root `assets/` directory
> silently — a 497 MB package shipped before anyone noticed [09-25] — and prints nothing about
> whether the Metro transform came from cache, so a build-time flag survived into the Release
> build in the direction that ships a test switch [10-04].
> **(4)** Hello world took one session once the install command was recovered: the SDK
> installation page describes every prompt but every command on it sits in a `<code>` element
> that text extraction drops, and the obvious URL is a 404. Three commands transcribed from
> `--help` were wrong and were only caught by running them. From a working install,
> `vega project generate` to a running app on the Virtual Device is minutes.
> **(5) Yes.** The platform is new and the surface is small enough to learn in a week, and
> the things that fought back were the tooling around the device, not the device. A
> `--non-interactive` installer flag and a screenshot command would remove most of the entries
> in the friction log.

#### `@amazon-devices/react-native-w3cmedia` 2.3.2

> **(1)** All media playback: the film through `VideoPlayer`, the description clips through
> `AudioPlayer`, ducking through `volume`, and byte delivery through Media Source Extensions.
> **(2)** Because it is the W3C media API, standard semantics apply and most of the design was
> answered by reading the `.d.ts` files rather than by a device spike: `volume` is a plain
> setter, `AudioPlayer` has a first-class `USAGE_ACCESSIBILITY` usage type, and two players
> run concurrently — a cue played for its full duration over a decoding film with zero dropped
> frames. MSE append-and-evict works as the spec says, including `SourceBuffer.remove()`
> behind the playhead.
> **(3)** URL mode is broken on the Virtual Device: `player.src = uri` fails with
> `MEDIA_ERR_SRC_NOT_SUPPORTED` before a single byte is requested, for remote URLs and packaged
> files alike, while `canPlayType()` answers `"probably"` for the same type — and the error is
> indistinguishable from an unsupported file, which cost four hours of looking at the asset
> [09-25]. `videoWidth`/`videoHeight` stay 0 on a stream that is demonstrably decoding, and the
> `resize` event carries 0×0 [09-25]. `sourceopen` re-fires, a paused player never reaches
> `ended`, timers are coarse, and the volume setter has no ramp — each of those is now a test in
> the open-source package. There is no way to get a frame out: `VideoPlayer` renders to a
> native surface handle, so live description from the picture is impossible on this platform
> and the docs should say so in one sentence.
> **(4)** Hello world was the hardest part of the whole project, because hello world for a
> media package is "play a file" and `src` does not. From the moment MSE was tried instead,
> every step worked. One line in the troubleshooting docs — *if URL playback fails, try the
> same bytes over MSE* — would turn the worst day of the build into an hour.
> **(5) Yes, with MSE as the base path from day one.** The API is standard, the concurrency
> and the accessibility usage type are exactly what this product needs, and everything that
> was wrong is documentable.

#### Vega Virtual Device (OS 1.2, `vvrp-tv-arm64`)

> **(1)** Every run of the app, every device measurement in the spec, and both suites of the
> end-to-end harness. No physical Fire TV was available.
> **(2)** Stable across four weeks of daily launches; the real H.264 decode path; the
> same `manifest.toml` service wiring as hardware, so a missing media service fails here
> before it fails there. Once its gRPC console is reachable it gives 1920×1080 frames and
> recordable audio, which is what made a screenshot-per-step harness report possible at all.
> **(3)** VoiceView cannot be enabled by any documented route — no Accessibility section in
> Settings, the chord does nothing, and the config write returns `No permission for
> operation` from the only shell a developer has [09-25]. For an accessibility product that
> means the screen reader is untestable until hardware, and the emulator's own page does not
> say so. The capture path is undocumented and was found through another entrant's wrapper
> [10-04]. The Virtual Device is an Android emulator that takes whatever console port is
> free, and no Vega command says which: with an Android TV emulator also running, capture
> silently photographed the other emulator while every scenario passed [10-19]. The device
> shell is an app sandbox, which the docs do not state [09-25].
> **(4)** `vega virtual-device start` and it is there; onboarding is the SDK's, not the
> device's.
> **(5) Yes.** It is the whole reason a solo entrant with no hardware could ship an app on
> this platform. Expose capture and key injection as `vega device` commands and let VoiceView
> be switched on, and it becomes sufficient for accessibility work too.

#### Amazon Devices Builder Tools (MCP server and Agent Skills)

> **(1)** `init-context` installed fifteen Agent Skills into the coding agent on day four;
> `amazon-devices-vega-setup-sdk`, `vega-media-player`, `vega-app-manifest`,
> `vega-build-and-run` and `vega-focus-management` were read while building; the MCP server's
> documentation search was configured at project scope.
> **(2)** The skills are the best Vega documentation this project found. `vega-app-manifest`
> surfaced that `manifest.toml` is a hard requirement with silent playback failure when a media
> service is missing from `[wants]` — the spec had not mentioned the file. `vega-media-player`
> pointed straight at the W3C surface and the MSE/EME path. The installer flag that skips the
> context document (`-d`) let the skills land without touching the agent's own instructions.
> **(3)** The MCP server needs a session restart to load, so the first round used the package's
> `.d.ts` files instead and never went back; the skills' prose describes URL-mode playback as
> the normal path, which does not work on the Virtual Device. Neither the skills nor the MCP
> documentation mention the installer's lack of a non-interactive mode — the one step an
> agent cannot do.
> **(4)** One `npx` command; the skills were usable in the same session. Fastest onboarding of
> any tool in this project.
> **(5) Yes.** Agent-readable documentation for a new platform is the right idea, and it
> shortened the first week. Add a known-issues skill for the Virtual Device and keep the skill
> text as honest as the friction log.

#### Amazon Bedrock

> **(1)** The vision model (`Converse` API, Amazon Nova Pro or Nova Lite, image input) that
> writes each description from frames and context. Built, bounded, retried on throttle, and
> tested against a mocked `Converse`. When it refused, a second implementation of the same
> provider interface (Google Gemini) generated the demo track; Bedrock stays the default.
> **(2)** The control plane: `list-foundation-models` and
> `get-foundation-model-availability` answer precisely, name which Nova models accept image
> input and which need an inference profile, and the Converse request shape is clean to code
> against. The `amazon-bedrock` skill's troubleshooting table is good for the errors it
> covers.
> **(3)** The account was refused for the entire hackathon and nothing in the service said
> why. `Error 002: Access to Bedrock models is not allowed for this account` carries no
> reason, no remediation and no link; `authorizationStatus: NOT_AUTHORIZED` sits beside three
> `AVAILABLE`s and names nothing; the one API that knows about the use-case form
> (`GetUseCaseForModelAccess`) was discovered through an `AccessDeniedException` in the
> console, and the form itself was unreachable until its `PutUseCaseForModelAccess` schema
> was documented weeks later [09-22, 09-26]. Submitting it changed nothing, and the
> documentation's next step for a persistent `Error 002` is "contact AWS Sales", which is
> not a path a developer in a four-week hackathon can take [10-18]. An AWS support case
> proposed a wrong cause. The use-case form is documented as applying to Anthropic models
> only, yet the refusal gates Amazon's own Nova.
> **(4)** Zero to hello world did not happen: four weeks of attempts, nothing
> returned. The code path from credentials to a Converse call is an hour; the account path is
> unbounded.
> **(5) Not from this account, and not for a deadline.** The API is good and the model
> catalogue is right for the task, but a service that can refuse an account for a reason it
> will not state is one a time-boxed project cannot depend on. With an account that answers,
> yes — the integration is already written.

#### Amazon Polly

> **(1)** Speaking every description cue (`SynthesizeSpeech`, neural, Joanna), one request per
> cue, offline.
> **(2)** Worked on the first call on the same credentials Bedrock refuses, which is also what
> proved the Bedrock problem was Bedrock's. `describe-voices` lists the neural en-US voices
> plainly; a 33-character cue returned 11,996 bytes of MP3; the neutral,
> articulate voices are exactly what audio-description convention asks for.
> **(3)** Nothing in the service. The only work was ours: the output has to be repackaged into
> fragmented MP4 for the Vega player, which is a platform constraint rather than a Polly one.
> An `ogg`/`mp4` fragmented output option would remove the ffmpeg step for TV targets.
> **(4)** One CLI call, one SDK call, hello world in ten minutes.
> **(5) Yes, without reservation.**

#### Devpost (the submission platform)

> **(1)** Rules, FAQ, updates, the submission form and the friction-log and product-feedback
> requirements.
> **(2)** The rules page is specific about what each block must contain, the FAQ answered the
> licensed-footage question before it was asked, and the updates carried the office-hours
> schedule and the submission tips.
> **(3)** Every page is behind a browser check that returns 403 or an empty body to any
> non-browser client, so no fact from the rules can be re-verified by a script; this project's
> registry had to carry them as "read by hand" for three weeks. Two different credit-form URLs
> on two pages. No contact address is published for the organisers.
> **(4)** Immediate.
> **(5) Yes** — it is where the hackathon is.

### 2.9 Feature requests (optional), with priority

| priority | tool | request |
|---|---|---|
| **Critical** | Amazon Bedrock | `Error 002` names the failing condition and the remedy, and distinguishes *form not submitted* from *account not eligible*. |
| **Critical** | Vega Virtual Device | a way to enable VoiceView, or one sentence on the device's page saying it cannot be. |
| **Important** | Vega CLI | `vega device screenshot`, `record` and `press` — the emulator already has all three over gRPC — and `vega device info` printing the Virtual Device's console and gRPC ports. |
| **Important** | Vega SDK installer | `--non-interactive` / `--yes` and `--install-dir`. |
| **Important** | `react-native-w3cmedia` | `canPlayType()` and `src` agree, or the docs say URL mode is unsupported on the Virtual Device and point at MSE. |
| **Important** | `react-native-w3cmedia` | `videoWidth`/`videoHeight` populated from the decoder, not from a `resize` event carrying zeros. |
| **Nice-to-have** | `build-vega` | print the package size and the top contributors, and whether the Metro transform came from cache. |
| **Nice-to-have** | `@amazon-devices/react-native-kepler` | move `@microsoft/api-extractor` out of `dependencies`; it drags nine audit findings into every consumer's production tree. |
| **Nice-to-have** | Amazon Polly | a fragmented-MP4 / AAC output format for MSE-based players. |

### 2.10 Friction log

> `FRICTION-LOG.md` in the repository: 16 dated entries written between 2026-09-22 and
> 2026-10-19 as things broke, each committed the day it is dated, plus a dated 2026-10-18
> update on the Bedrock entry — 14 on Amazon tools (Vega SDK and CLI, the Virtual Device,
> `react-native-w3cmedia`, `build-vega`, Bedrock, the AWS CLI) and 2 on the general toolchain.
> Each carries tool, steps, expected, happened, workaround, time lost, severity and what
> would have helped. Severity count: 2 Critical, 4 High, 4 Medium, 6 Low.

### 2.11 The impact figure (`AC16`) and the dropped validation session (`AC20`)

**Figure, with its source**, entered in the registry (`acceptance[AC16]`) before this prose:

> At the end of 2025 the American Council of the Blind's Audio Description Project counted
> **13,109 unique titles** available with an English audio description track across cinema,
> DVD, Spectrum Access and more than twenty streaming services, up 24 % on 2024 (Netflix
> +307 titles, Prime Video +597 in the year). — *ADP Webmaster Report 2025*,
> <https://adp.acb.org/node/315600>, read 2026-10-18.

Supporting, older and narrower: a 2021 analysis of Netflix UK found 25.4 % of titles carried
audio description (<https://www.lenstore.co.uk/research/the-accessibility-of-streaming/>).
Use the ACB figure in the form; the Netflix one only if a percentage is asked for, with its
date.

**The validation session was dropped, and the submission says so:**

> The plan included a 20–30 minute session with a blind or low-vision viewer, with and
> without description, consent on file, and an anonymized quote. Recruitment opened in the
> first week; nobody was confirmed by the 2026-10-16 cut-off the plan had set, so the session
> was dropped rather than the deadline moved — and rather than quoting anyone who was not
> there. The product's claims rest on measurement, not on a testimonial.

---

## 3. The demo video — script, under 3 minutes, English

Order per `02d` Phase 16.6, adjusted for what can be shown: the problem; the gap mechanism
visualized; the app with description on; the verbosity switch; the honest notes. Recorded
from the Vega Virtual Device through its gRPC capture (1920×1080 frames and the audio
stream), which is the same path the end-to-end harness uses. Total target **2:45**, leaving
15 s of slack under the 3-minute limit judges are not required to watch beyond.

Overlays in `[brackets]`. Every on-screen caption that names a tool names it in full the
first time: *Vega OS*, *Fire TV*, *Amazon Bedrock*, *Amazon Polly*.

| time | on screen | voice-over |
|---|---|---|
| 0:00–0:20 | Black. Then the opening of *Tears of Steel* playing with sound, no picture — the frame slowly revealed. `[Most films ship with no audio description.]` | "This is what a film is for a blind viewer: the dialogue, the sound, and nothing about what the camera shows. Audio description fixes that — and almost no title has it. At the end of 2025 the American Council of the Blind counted thirteen thousand described titles across every streaming service combined." |
| 0:20–0:50 | **The gap visualization.** A timeline strip of the whole film: dialogue blocks in one colour, silences in another, a marker on every cue window, the sub-threshold gaps greyed out. Zoom into one 30-second span. `[39 gaps · 451.8 s of describable silence · 74 % of the content]` | "Interstice finds the silences. The subtitle file already says when every line is spoken, so every gap between lines is a place a description can go — if it fits. Gaps longer than twelve seconds are split into windows; windows too short for three words are dropped. On this film that is thirty-nine gaps and seven and a half minutes of usable silence." |
| 0:50–1:10 | Split screen, the same 30 s: left, the film as shipped (silence in the gap); right, the film ducked to 25 % with a description spoken in the gap, the waveform visible. `[same scene · silence vs. ducking + description]` | "Each window gets a description bounded to the words that fit at a hundred and sixty words a minute. The film ducks, the cue plays, the film comes back — before the next line." |
| 1:10–1:35 | The pipeline terminal running to the Bedrock call and the refusal, verbatim: `Error 002: Access to Bedrock models is not allowed for this account`. Then the same command with `DESCRIPTION_PROVIDER=gemini`: frames extracted, a cue going to the model, the answer bounded, Amazon Polly speaking it. `[Amazon Bedrock refused this account for four weeks · same interface, Google Gemini answered · Amazon Polly speaks every cue]` | "Offline, the pipeline sends up to three frames per window, the surrounding dialogue and a cast list to a vision model. It was built for Amazon Bedrock, which refused this account for the whole hackathon — the error is on screen — so the same interface ran on Google Gemini. The answer is bounded to its window, and Amazon Polly speaks it. Nothing in the track is hand-written; every cue records the frames it was written from." |
| 1:35–2:25 | **The app on Vega OS**, captured from the Vega Virtual Device, playing the **generated** standard track: the title list with focus; ENTER; the film playing; the description toggle focused; a cue arrives — the film ducks, the description plays, the film restores; the next line of dialogue lands clean. Then a second cue, a different scene. `[React Native for Vega OS · Fire TV · Vega Virtual Device · every word you hear was generated from the frames]` | "On the television — a React Native app on Vega OS, running on the Vega Virtual Device. Description on. The cue plays in the gap, the film comes back, and the next line is untouched. The toggle never pauses the film. Every word you hear was written by the model from the frames on screen; none of it by hand." |
| 2:25–2:30 | **The verbosity control**: focus moving across concise, standard, detailed; no level switched audibly. `[concise 47 · standard 55 · detailed 60 windows — timing computed from the gaps; text generated for standard]` | "Three verbosity levels with different budgets, so different cue counts — the timing comes from the gaps, not from the model." |
| 2:30–2:45 | The track file renamed; relaunch; the app says, out loud and on screen, that no description track was found while the film plays. Then a still of the open-source package README. `[every failure state is spoken · react-native-tv-audio-description on npm]` | "When the track is missing, the app says so — out loud — and the film still plays. The whole TV-side layer is open source on npm; this app installs it like anyone else would." |
| 2:45–2:55 | Two honest captions over the paused app, no music. `[VoiceView cannot be enabled on the Vega Virtual Device and no physical Fire TV was available — the screen reader is not shown.]` `[A validation session with a blind viewer was planned; nobody was confirmed by the cut-off, so it was dropped, not faked.]` | "Two things this video does not show, on purpose: VoiceView — it cannot be switched on inside the Virtual Device and I had no physical Fire TV — and a session with a blind viewer, which was planned and dropped when nobody was confirmed in time. Everything you did see is in the repository, with the measurements behind it." |
| 2:55–3:00 | Attribution card (§4), repository URL. | — |

**Recording checklist (10-22):** the app build is the Release package without the e2e flag
(read the `INTERSTICE.app.mode` line) · no terminal in frame shows an environment variable's
value, `GEMINI_API_KEY` least of all · the Bedrock error is shown verbatim, not paraphrased ·
the track on the device is the generated one, and any fixture track still heard (§5) is
labelled on screen in the same shot · upload public on YouTube, English title, the
attribution line in the description too.

---

## 4. Attribution — to show in the video and paste in the video description

> Film: *Tears of Steel* © 2012 Blender Foundation · mango.blender.org · licensed under
> Creative Commons Attribution 3.0 (CC BY 3.0). Played inside the app as the demonstration
> asset; English subtitles from download.blender.org. No other third-party media appears.

Short form for the on-screen card: **Tears of Steel (CC BY 3.0) — Blender Foundation, mango.blender.org**

---

## 5. Open before submission

| item | owner | by |
|---|---|---|
| Finish the standard track after the Gemini free-tier reset (00:00 PT); fill `[N]` in §2.2 | coordinator | 10-20 |
| Load the generated standard track on the Virtual Device, re-run both harness suites on it, republish the report | coordinator | 10-20 |
| Only the standard level is generated: the free tier yields about 21 cues a day (`_log.md` R49), and concise + detailed are 107 more. Decided 2026-10-19 (R54): the quota goes to standard and its AC14 regenerations; §3 shows the verbosity control for 5 s with the computed window counts and spends the time saved on the generated track playing. Generate concise/detailed only if standard is complete with quota to spare | owner | — |
| Record, edit and upload the video; fill `[VIDEO URL]` in §2.4 and the registry `acceptance[AC12]` | owner | 10-22 |
| ~~Ask at office hours #2 (10-19, 9:00 PT) whether an in-app CC BY asset needs anything beyond attribution~~ — **not asked; closed 2026-10-19.** CC BY 3.0 grants any use on attribution, and the rule asks for rights plus attribution: the attribution is in the video (§4 card), its description and the thumbnail | owner | closed |
| Submit every field; declare Fire TV, AWS Builder, Open Source; mark `acceptance[AC13]` executed with the confirmation | owner | 10-22, deadline 10-23 12:00 PT |
