# Friction log — Interstice

Kept **during** the build, not reconstructed at the end. Shape per the spec
(`docs/features/interstice/_facts.yml decisions.friction_log_shape`):

```
tool | expected | happened | workaround | time_lost
```

**Close-out, 2026-10-18.** The rules page (re-read that day) lists what a friction-log
entry must contain: *"specific task attempted, steps taken, expected vs. actual result,
severity rating, workaround used, and actionable suggestion"*. The shape above covers all
of it except the severity rating and, in some entries, an explicit list of steps. Each entry
therefore gained a **`severity:`** line and, where the steps were only implicit in the
prose, a **`steps:`** line — both added at close-out and marked so. **Nothing else was
touched:** every date, every quoted error and every *what would have helped* line stands as
it was written on the day. `expected` / `happened` are the rules' *expected vs. actual*;
`what would have helped` is the *actionable suggestion*.

**Severity scale** (one meaning each, applied by impact on this project rather than by
how the tool felt about it):

| severity | meaning |
|---|---|
| **Critical** | blocks a deliverable outright, and no workaround exists inside the toolchain |
| **High** | a workaround exists, but it changed the architecture, cost hours, or would have shipped a wrong artifact unnoticed |
| **Medium** | under an hour lost, or it nearly produced a wrong conclusion; a workaround exists |
| **Low** | minutes lost, or a documentation gap with an easy route around it |

The entries that matter to the Amazon Developer Hackathon are the ones on
**Vega OS / the Vega SDK, Bedrock and Polly**. They begin when Phase 0 runs.
Entries on the general toolchain are kept below them, separately, so the
Amazon feedback is not diluted by things Amazon cannot act on.

---

## Amazon developer tools

### 2026-09-22 — the Vega SDK installer cannot be automated, and fails halfway when it is

- **tool:** Vega SDK installer (`get_vvm.sh`), Vega CLI 1.3.4
- **steps** *(added 2026-10-18)*: ran `get_vvm.sh` with stdin closed; re-ran feeding blank lines; read the script to find the `/dev/tty` reads; re-ran as `yes '' | bash get_vvm.sh`.
- **expected:** a scripted install, or at least a documented non-interactive flag. The docs describe three prompts whose answers are all "press Enter for the default", which is exactly the shape a `--yes` flag exists for.
- **happened:** the installer has no non-interactive mode. Run with stdin closed it installs the CLI, then dies at the first prompt with `Error: failed to get SDK path: failed to read input: EOF` and `[X] Vega CLI not set up`, leaving a half-installed CLI with no SDK. Feeding it blank lines gets further, but later confirmations are read from `/dev/tty` directly, printing `get_vvm.sh: line 520: /dev/tty: Device not configured` twice and defaulting through them. The install completed, but only because every default happened to be the right answer.
- **workaround:** `yes '' | bash get_vvm.sh`. Fragile by construction — it answers every future prompt with the default too.
- **time_lost:** 25 min
- **severity** *(added 2026-10-18)*: **Medium**
- **what would have helped:** a `--yes` / `--non-interactive` flag and an `--install-dir` option. CI, containers and AI coding agents all lack a TTY — and Amazon ships an MCP server and Agent Skills specifically so agents can drive this toolchain, which makes the installer the one step in that toolchain an agent cannot complete.

### 2026-09-22 — the install command is invisible to any documentation reader that is not a browser

- **tool:** Amazon Vega documentation (`developer.amazon.com/docs/vega/0.24/`)
- **steps** *(added 2026-10-18)*: opened `set-up-sdk.html` (404); followed `run-apps.html` to `install-vega-sdk.html`; read the text extraction, which held no command; fetched the raw HTML and parsed the `<code>` elements.
- **expected:** find the installer command on the SDK installation page.
- **happened:** the prose describes everything around the command — prerequisites, prompts, what gets installed — but every actual command sits in a `<code>` element that text extraction drops. The page reads as a complete set of instructions with the instructions missing. The obvious URL `set-up-sdk.html` is also a 404; the real page is `install-vega-sdk.html`, reachable only by following a link out of `run-apps.html`.
- **workaround:** fetched the raw HTML and parsed the `<code>` elements to recover `curl -fsSL https://sdk-installer.vega.labcollab.net/get_vvm.sh | bash`.
- **time_lost:** 20 min
- **severity** *(added 2026-10-18)*: **Low**
- **what would have helped:** those commands are the payload of the page. A plain-text or Markdown view of the docs fixes this whole class of problem — the same class the Builder Tools MCP server exists to solve, which suggests Amazon already knows.

### 2026-09-22 — Bedrock is unreachable from this account, and nothing says why

- **tool:** Amazon Bedrock (`bedrock-runtime`, AWS CLI v2.36.50)
- **steps** *(added 2026-10-18)*: `aws bedrock-runtime converse` and `invoke-model` against `amazon.nova-lite-v1:0` in us-east-1, us-west-2 and eu-west-1; `aws bedrock get-foundation-model-availability`; `aws bedrock get-use-case-for-model-access`; `aws polly synthesize-speech` on the same credentials as the control.
- **expected:** the console's Model access page now says serverless foundation models "are automatically enabled across all AWS commercial regions when first invoked", so the first `InvokeModel` should just work.
- **happened:** every call fails with `ValidationException — Error 002: Access to Bedrock models is not allowed for this account`. Identical in `us-east-1`, `us-west-2` and `eu-west-1`, and identical for `InvokeModel` and `Converse`. `get-foundation-model-availability` returns `regionAvailability AVAILABLE`, `entitlementAvailability AVAILABLE`, `agreementAvailability AVAILABLE` and `authorizationStatus NOT_AUTHORIZED` — it names the state but never the reason. `get-use-case-for-model-access` answers `You have not filled out the request form`, pointing at a console page that has been retired. Polly succeeds on the same credentials in the same region, so this is Bedrock-specific rather than an account or credentials problem.
- **workaround:** none found from the API. The error names no cause, no remediation and no link; the one API that sounds like the fix (`put-use-case-for-model-access`) takes an undocumented `--form-data` blob. Escalating to AWS Support, and designing a provider fallback for the one pipeline stage that needs vision.
- **time_lost:** 70 min
- **severity** *(added 2026-10-18)*: **Critical**
- **what would have helped:** `Error 002` should say which condition failed and where to resolve it. `authorizationStatus: NOT_AUTHORIZED` is the right field to carry a reason code and it carries none. The retired Model-access page should not still be referenced by a live API error string.
- **follow-up:** the 2026-09-26 entry below records the cause found, and its 2026-10-18 update records that submitting the form changed nothing.

### 2026-09-22 — `aws login` failed with an HTTP 400 and no diagnosis

- **tool:** AWS CLI v2 `aws login`
- **steps** *(added 2026-10-18)*: ran `aws login` with a console session open; read the browser's 400 page; inspected `~/.aws/cli/cache/session.db` and `~/.aws/config`; cleared the cache, wrote the region, signed in again in a clean browser context, re-ran.
- **expected:** with an active Management Console session in the browser, `aws login` acquires temporary credentials.
- **happened:** the CLI prompted for a region, then the browser leg returned a bare `400 Bad Request — You may have typed the address incorrectly or you may have used an outdated link. Please clear your cookies and try the request again.` No indication of which identity it expected or what was stale. A partial session row was left behind in `~/.aws/cli/cache/session.db` while no `~/.aws/config` was written.
- **workaround:** deleted `~/.aws/cli/cache`, wrote the region into `~/.aws/config` by hand, signed into the AWS console in a clean browser context and re-ran `aws login`. It then worked.
- **time_lost:** 20 min
- **severity** *(added 2026-10-18)*: **Low**
- **what would have helped:** the 400 page is a generic Amazon sign-in error with nothing tying it back to the CLI handshake. Saying "you are signed in to a different Amazon identity than the AWS console" would have taken this from twenty minutes to one.

### 2026-09-25 — W3C `src` playback is broken on the Virtual Device, and every signal points at your file

- **tool:** `@amazon-devices/react-native-w3cmedia` 2.3.2, Vega SDK 0.24, VVD OS 1.2
- **steps** *(added 2026-10-18)*: set `player.src` to a remote URL, then to a packaged `file://` path, on `VideoPlayer` and `AudioPlayer`; checked `canPlayType()`; watched the host access log for the request that never came; re-encoded the asset six ways (format, container, codec profile, packaging, path, reachability); then fed the same bytes through `MediaSource` / `srcObject` as a fragmented MP4.
- **expected:** `player.src = <uri>` loads the media, per the W3C Media API the package implements and the platform's own URL-mode documentation.
- **happened:** `MEDIA_ERR_SRC_NOT_SUPPORTED` (code 4) **before a single byte is requested** — verified against a host access log that recorded zero requests. Empty native message, no `W3CMEDIA` log line at any priority. The same failure for a remote URL, for a packaged `file://` path, and for `AudioPlayer` as well as `VideoPlayer`. `canPlayType()` returned `"probably"` for the exact type the player then refused.
- **workaround:** fetch the bytes in JavaScript and hand them to the same player through a `MediaSource` — `srcObject`, not `src`, and a **fragmented** MP4. Same device, same session, same footage: `.src` fails, MSE plays 253 frames with 0 dropped.
- **time_lost:** ~4 hours across four sessions
- **severity** *(added 2026-10-18)*: **High**
- **what would have helped:** three things, each small. (1) `canPlayType()` exists precisely so an app can avoid this call, and it answered `"probably"` — that disagreement is a bug in its own right. (2) The error is indistinguishable from a genuinely unsupported file, so all six of our eliminations went looking at the asset: format, container, codec profile, packaging, path, byte-reachability. Any diagnostic that said *rejected before fetch* would have redirected us in one run. (3) One line in the media troubleshooting docs — *if URL playback fails, try the same content over MSE to isolate source handling from the pipeline* — would have saved all of it.

### 2026-09-25 — `videoWidth` reports 0 on a video that is demonstrably decoding

- **tool:** `@amazon-devices/react-native-w3cmedia` 2.3.2
- **steps** *(added 2026-10-18)*: logged `videoWidth` / `videoHeight` at `loadedmetadata`, `playing` and on `resize`; compared with `getVideoPlaybackQuality().totalVideoFrames`; read `VideoPlayer.js` in the package to find where `videoWidth_` is assigned.
- **expected:** after `loadedmetadata`, `videoWidth`/`videoHeight` carry the frame size.
- **happened:** both stay `0` through `loadedmetadata`, `playing` and beyond — and the platform's own `resize` event arrives carrying `w=0 h=0`. That is the exact signature of audio-only playback, on a stream that was decoding 253 video frames with none dropped.
- **workaround:** gate on `getVideoPlaybackQuality().totalVideoFrames` instead. Reading the package source explains the zeros: `VideoPlayer.js:225` only assigns `videoWidth_` from a `resize` event, so it reports whatever the platform sent, and the platform sent zero.
- **time_lost:** 25 min
- **severity** *(added 2026-10-18)*: **Low**
- **what would have helped:** a `resize` event with real dimensions. Failing that, a documented note that `videoWidth` is unreliable on the Virtual Device — it is the first thing anyone checks when a video does not appear.

### 2026-09-25 — `vega device run-cmd` is a sandboxed app context, and says a resource is absent when it simply cannot see it

- **tool:** Vega CLI 1.3.4
- **steps** *(added 2026-10-18)*: ran `id`, `ps` and `ls /dev/input` through `vega device run-cmd`; compared with key injection through the same shell, which worked; stopped drawing negative conclusions from it.
- **expected:** a device shell for inspecting the device.
- **happened:** it runs as `uid=5000(app_user)` inside an app context. `ps` lists two processes — itself and `dev_shell_app` — so the entire system is invisible, and `/dev/input` reports `No such file or directory` while key injection through that same shell works. Every probe run from there that reports something **absent** has reported nothing at all.
- **workaround:** stop concluding anything negative from it. Positive results are still trustworthy; that is how `inputd-cli` was found.
- **time_lost:** 30 min, and it nearly produced a wrong root cause — the same trap another developer reported publicly, concluding the device had no audio hardware while its boot chime was audible.
- **severity** *(added 2026-10-18)*: **Medium**
- **what would have helped:** a permission-denied path that says so instead of reporting the resource as missing. `ENOENT` and *you are not allowed to see this* are different answers and only one of them is true.

### 2026-09-25 — no screenshot path for the Virtual Device

- **tool:** Vega CLI 1.3.4 / VVD
- **steps** *(added 2026-10-18)*: searched `vega device --help` for a capture command; ran `screenshooter` and `gwsi-tool-screenshooter` on the device; tried capturing the QEMU window from the host and `osascript`; fell back to log lines and decoded-frame counts over the HTTP beacon.
- **expected:** some way to see what the device is showing, to verify a UI or debug a black screen.
- **happened:** `vega device` has no capture command. On-device, `screenshooter` fails at dbus marshalling (`null value passed for arg 1`) and `gwsi-tool-screenshooter` needs `com.amazon.dev.shell.service`, which is not running. Host-side, the QEMU window cannot be captured without granting Screen Recording permission, and `osascript` is denied assistive access.
- **workaround:** none for pixels. Everything in this build is verified through log lines and decoded-frame counts instead, which is why an HTTP beacon exists in this repo at all.
- **time_lost:** 45 min across two sessions
- **severity** *(added 2026-10-18)*: **Medium**
- **what would have helped:** `vega device screenshot`. It is the single most useful missing command for a TV platform, where the whole product is what is on the screen.

### 2026-09-25 — VoiceView cannot be enabled on the Virtual Device, and the documented command says so only after you find it

- **tool:** Vega CLI 1.3.4 / Vega Virtual Device, OS 1.2
- **steps** *(added 2026-10-18)*: looked for an Accessibility section in the VVD Settings app; tried the Back+Menu chord; searched the 0.24 docs for the config key, found it in the 0.22 WebView accessibility guide; ran `vdcm get` then `vdcm set` on `VoiceViewEnabled` from `run-cmd` and from `shell`.
- **expected:** one of the three documented routes turns VoiceView on, so an accessibility feature can be tested before touching hardware.
- **happened:** none of them works. The VVD's Settings app has **no Accessibility section**; the Back+Menu chord does not fire; and the documented `vdcm set "com.amazon.devconf/system/accessibility/VoiceViewEnabled" "ENABLED"` returns `No permission for operation` — from `vega device run-cmd` **and** from `vega device shell`, which turn out to be the same `uid=5000(app_user)` context. `vdcm get` on the same key reads back `DISABLED` happily, so the key is right and only the write is refused.
- **workaround:** none. The acceptance criterion that needs it moves to physical hardware.
- **time_lost:** 35 min, most of it guessing the key name before finding it in the WebView accessibility guide — a **0.22** document, while the project targets 0.24, and the key appears in no 0.24 page I could reach.
- **severity** *(added 2026-10-18)*: **High**
- **what would have helped:** two things. The permission error should say *what* would be permitted to set it, since "no permission" from the only shell a developer has reads as "you are holding it wrong" rather than "this is not available here". And an accessibility feature that cannot be enabled on the emulator deserves one line saying so on the emulator's own page — this is the one class of feature where testing on real hardware is least optional and the emulator is most likely to be all somebody has.

### 2026-09-25 — the build packages the whole project-root `assets/` directory, silently

- **tool:** `react-native build-vega`, Vega SDK 0.24.12112
- **steps** *(added 2026-10-18)*: noticed the `.vpkg` size while checking something else; listed the package contents; moved source media from `assets/` to `media/`; rebuilt and compared sizes.
- **expected:** the package holds what the app requires — the metro bundle and the assets reachable from it.
- **happened:** it also copies **everything under the project-root `assets/` directory**, verbatim, whether or not any code references it. A host-side pipeline that kept its source film there shipped a **372 MB `.mov` and a 117 MB `.mp4` to the device**: `interstice_aarch64.vpkg` was **497 MB**. Nothing in the build output says which files were added or how large the result is, and `install-app` reports plain `success`.
- **workaround:** move source media to a directory that is not `assets/` — here, `media/` — and keep `assets/` for things that genuinely belong on the device. Package dropped to **2.68 MB**, 185× smaller.
- **time_lost:** 25 min, and only because the size was noticed by eye while checking something else. The app worked the whole time.
- **severity** *(added 2026-10-18)*: **Medium**
- **what would have helped:** one line of build output stating the package size and the top few contributors. A 185× regression that changes nothing observable about the running app is exactly the kind that reaches an appstore submission — and for a hackathon judged by people who clone and build, a half-gigabyte artifact is the first impression.

### 2026-09-26 — `Error 002` never mentions the form that would fix it

- **tool:** Amazon Bedrock
- **steps** *(added 2026-10-18)*: re-ran the inference call before and after the credit grant and after its redemption; from a fresh IAM user; from the console playground; opened the Bedrock console as the narrow IAM user and read the `AccessDeniedException` list it emitted; ran `aws bedrock get-use-case-for-model-access`; searched the console for the form it names.
- **expected:** an error that names what is missing, or a console that offers the missing step.
- **happened:** every inference call on the account returned `ValidationException — Error 002: Access to Bedrock models is not allowed for this account`. Four days and six rounds of elimination: three regions, two APIs, two identities (root and a fresh IAM user), two code paths (CLI and the console playground), before and after an AWS credit grant, before and after its redemption. All identical. `get-foundation-model-availability` reported `regionAvailability`, `entitlementAvailability` and `agreementAvailability` all `AVAILABLE` beside `authorizationStatus: NOT_AUTHORIZED`, and named nothing.
  The actual cause: **the account had never filled out the Bedrock use-case request form.** One API says so in a single sentence — `aws bedrock get-use-case-for-model-access` → *"You have not filled out the request form. Fill out the form before getting access."*
- **workaround:** submit the form. The finding was accidental: the Bedrock console, loaded as a narrowly-permissioned IAM user, emitted `AccessDeniedException` for a dozen actions it wanted, and one of them was `bedrock:GetUseCaseForModelAccess` — an API no error message had ever mentioned. A permissions failure is what revealed the existence of the check.
- **time_lost:** ~4 hours across four days, plus an AWS support case that proposed the wrong cause (the account root) and was disproven by test.
- **severity** *(added 2026-10-18)*: **Critical**
- **and the form cannot be found.** The Model access page is retired and offers none. Invoking an Anthropic model — which is the only case the documentation says needs use-case details — returns the same `Error 002` and surfaces nothing. `put-use-case-for-model-access` exists in the CLI but takes an opaque blob of at least 1100 bytes. So the service knows a form is missing, will not say so in the error a developer actually sees, and provides no reachable way to submit it.
- **what would have helped:** one sentence. `Error 002` could say *"this account has not submitted the required use-case details"* and link the form, exactly as `GetUseCaseForModelAccess` already does. The information exists inside the service and is withheld from the error that needs it. Two further notes: `authorizationStatus: NOT_AUTHORIZED` beside three `AVAILABLE`s reads as an entitlement problem and is not one; and the retired Model access page mentions a use-case form only for *Anthropic* models, while the requirement here gated *every* model including Amazon's own Nova.
- **update 2026-10-18 — the form is submitted, and nothing changed.** AWS has since documented the `PutUseCaseForModelAccess` schema (`companyName`, `companyWebsite`, `industryOption`, `otherIndustryOption`, `intendedUsers`, `useCases`), so the opaque blob of 09-26 could be filled in and the form was submitted through the API. Five minutes later `Converse` returned the same `ValidationException — Error 002: Access to Bedrock models is not allowed for this account`, byte for byte. The AWS documentation says the use-case form applies to **Anthropic** models only, and that a *persistent* `Error 002` means **contact AWS Sales** — which is not a developer route, carries no timeline, and is not something a hackathon entrant can wait on. So the account state after four weeks is: control plane working, Polly working, every inference call refused, the only named prerequisite satisfied, and the next step a sales conversation. The pipeline stage that needs a vision model (`pipeline/describe.ts`) has still never run against this account; everything downstream of it has been verified on a fixture track, labelled as such.
- **what would have helped (2026-10-18):** an error that distinguishes *form missing* from *account not eligible* — the two have different remedies and today they share one string. And if the answer is "contact Sales", the error should say so on day one rather than after a form that, by the documentation's own account, was never the gate for this model.

### 2026-10-04 — a build-time flag survives into the next build, in the direction that hurts

- **tool:** `react-native build-vega` (Vega SDK 0.24.12112) with Metro
- **steps** *(added 2026-10-18)*: built with `INTERSTICE_E2E` set, then without; launched each and read the `INTERSTICE.app.mode` line; repeated four times alternating; added `cacheVersion` to `metro.config.js` keyed on the variable; repeated five times.
- **expected:** a constant compiled in from an environment variable by a Babel plugin reflects the environment of the build that is running. Two builds from one tree: `INTERSTICE_E2E=… build-vega` for a test package, plain `npm run build` for the one that ships.
- **happened:** the Release build made *after* the flagged one launched reporting the test host — `INTERSTICE.app.mode e2e=true host=http://localhost:8099`. Four alternating builds, four launches, all `e2e=true`. Metro's transform cache does not key on the environment, so every later build was served the transform compiled for the first. Each build exited 0 and printed `build-vega completed`; nothing distinguishes a package built from cache from one that was not.
- **workaround:** `cacheVersion` in `metro.config.js`, set from the same variable. Five alternating builds then came out right.
- **time_lost:** 3 min — only because the test plan already said "build flagged, then Release, clean nothing, and read the line". Without that step this is not a time cost: it is a submitted binary with a test switch in it.
- **severity** *(added 2026-10-18)*: **High**
- **what would have helped:** `build-vega` printing whether the bundle came from cache, and a documented `--reset-cache`. A note in the Vega build docs that environment-driven Babel transforms need a `cacheVersion` would cost one paragraph.

### 2026-10-04 — pixels and sound from the Virtual Device do exist, through a door Vega does not document

- **tool:** Vega Virtual Device (SDK 0.24.12112), Vega CLI 1.3.4
- **steps** *(added 2026-10-18)*: read the community thread and the wrapper's source; told the emulator console `grpc 8554`; called `getScreenshot` and recorded the audio stream; pressed six keys through `inputd-cli` and counted the trace lines.
- **expected:** following the 2026-09-25 entry above — no capture path at all, and (recorded in the spec) no way to hear the device, which is why audible ducking was parked as hardware-only.
- **happened:** the emulator under the Virtual Device has its own gRPC interface. Once its console is told `grpc 8554`, `getScreenshot` returns the real 1920x1080 frame, current after a key press, and the audio stream can be recorded: a 12 s clip came back with `mean_volume -14.4 dB`. Found through another entrant's open-source wrapper ([fortemate/vega-vvd-driver](https://github.com/fortemate/vega-vvd-driver), MIT) and their community thread — not through any Amazon page. Their notes say `inputd-cli` never reaches an app; here it does (`KEY_ENTER`, `KEY_BACK`, `KEY_DOWN`, six presses, six trace lines), on the same SDK and OS build. Two developers, one platform, opposite observations of the same binary.
- **workaround:** the wrapper, pinned to a commit, for capture; `vega device run-cmd -c 'inputd-cli button_press KEY_*'` for keys.
- **time_lost:** 15 min to find, read and verify — after 45 min on 2026-09-25 concluding it could not be done.
- **severity** *(added 2026-10-18)*: **Low**
- **what would have helped:** `vega device screenshot`, `vega device record` and `vega device press`, documented, for the Virtual Device and for devices in developer mode. The capability is already in the product; it is the command that is missing. Amazon staff have this as a feature request (community thread 29258).

### 2026-10-19 — the Virtual Device is an Android emulator, and answers on whatever port was left over

- **tool:** Vega Virtual Device (SDK 0.24.12112), its emulator gRPC interface, through the [fortemate/vega-vvd-driver](https://github.com/fortemate/vega-vvd-driver) wrapper of the 2026-10-04 entry
- **steps:** ran the release e2e suite with capture on; reviewed the screenshots before publishing; found them to be another app; listed the emulator processes and their listening ports with `pgrep` and `lsof`; re-ran with the device addressed by pid.
- **expected:** "the Virtual Device" is one addressable thing. `vega device list` names it; a screenshot of it is a screenshot of the Vega app under test.
- **happened:** the VVD binary (`vega-virtual-device -avd-arch arm64`, under `vvd/images/tv/vmtools/agent/qemu/`) is the Android emulator, and it takes the next free console port. With an Android TV emulator (`TV_1080_RELEASE`, a client project) started first, that emulator held console `5554` and gRPC `8554`, and the VVD came up on `5556`. Every capture tool that assumes the first emulator — the wrapper's defaults included — then talks to the Android one. A whole release run captured another app's screens, and every scenario still passed, because verdicts come from the app's trace lines, not from pixels. Nothing in the Vega CLI reports which console or gRPC port the Virtual Device holds.
- **workaround:** `e2e/capture.ts` finds the device by its own process (`pgrep -f 'vega-virtual-device -avd-arch'`), reads its console port from `lsof`, enables gRPC on the matching port and passes `--pid` to every capture command; no VVD process fails loudly. The wrong run was deleted unpublished, and the 11 published shots were checked one by one.
- **time_lost:** about 40 min, estimated — and only because the shots were looked at before publishing. Unlooked-at, this is a public test report illustrated with a different product.
- **severity:** **High**
- **what would have helped:** `vega device info` printing the Virtual Device's console and gRPC ports, or the `vega device screenshot` asked for in the 2026-10-04 entry, which would address the device by name and make the question disappear.

### 2026-10-22 — an `aws login` session expires under a running batch job, and the SDK error does not say which login

- **tool:** AWS CLI v2 `aws login` sessions, consumed by the AWS SDK for JavaScript v3 (`@aws-sdk/client-polly`)
- **steps:** ran the description pipeline (Gemini for the text, Polly for the voice) after the free-tier reset; Polly failed on the first cue that needed synthesis; re-ran `aws login`; the browser leg expired twice because the terminal that started it had moved on; finished it from a plain terminal; re-ran the pipeline.
- **expected:** a credential source the SDK resolves either lasts the length of a batch job or tells the job how to refresh it.
- **happened:** `SynthesizeSpeech` threw `Your session has expired. Please reauthenticate.` — no profile name, no credential source, no command. It happened on 2026-10-20 and again on 2026-10-22, both times mid-run (the descriptions were cached first, so nothing paid was lost). Restarting `aws login` from a non-interactive shell left the authorization pending until it expired: `The pending authorization to retrieve an SSO token has expired`, exit 255, twice.
- **workaround:** `aws login` from a regular terminal, then a re-run: the pipeline caches descriptions and re-synthesizes only what is missing, so the second run made zero model calls.
- **time_lost:** about 30 min across the two days
- **severity:** **Low**
- **what would have helped:** the expiry error naming its source and fix ("the `default` profile's `aws login` session expired — run `aws login`"), and the session lifetime printed when `aws login` succeeds, so a batch job can be started knowing whether it will outlive its credentials.

---

## Toolchain

### 2026-09-22 — the scaffold's pinned test runner ships a critical advisory

- **tool:** npm / vitest
- **steps** *(added 2026-10-18)*: ran `npm audit` after the scaffold install; bumped `vitest` and `@types/node`; removed `node_modules` and the lockfile; reinstalled and re-ran `npm audit`.
- **expected:** `vitest ^2.0.0`, as pinned in the implementation spec, installs cleanly.
- **happened:** `npm audit` reported **5 vulnerabilities (3 moderate, 1 high, 1 critical)** — a path-traversal / arbitrary-file-read advisory reaching `vitest` through `@vitest/mocker`, plus an `esbuild` dev-server advisory through `vite`. The submission repository has to be public and the judges clone and run it; shipping that is not an option.
- **workaround:** bumped to `vitest ^5.0.1` and `@types/node ^24.0.0`, wiped `node_modules` and the lockfile, reinstalled → `found 0 vulnerabilities`. The spec's Phase 1 now runs `npm audit` as a step rather than as a courtesy.
- **time_lost:** 10 min
- **severity** *(added 2026-10-18)*: **Low**

### 2026-09-22 — the test baseline could not be measured from an empty repository

- **tool:** vitest
- **steps** *(added 2026-10-18)*: ran `vitest run` on the empty scaffold and read the exit code; rejected `--passWithNoTests`; wrote the first real test and re-ran.
- **expected:** running the test command on a fresh scaffold reports zero tests and exits 0, giving a pass line to record as the project's baseline.
- **happened:** `vitest run` with no test files prints `No test files found, exiting with code 1` and exits **1**. There is no pass line, so the baseline had nothing to measure against.
- **workaround:** wrote the first real test (the verbosity word-budget suite) before closing the scaffold step, so the baseline is measured against a run that actually asserts something. Rejected `--passWithNoTests`: it produces a green line that proves nothing, which is a worse oracle than none.
- **time_lost:** 15 min
- **severity** *(added 2026-10-18)*: **Low**
