# Friction log — Interstice

Kept **during** the build, not reconstructed at the end. Shape per the spec
(`docs/features/interstice/_facts.yml decisions.friction_log_shape`):

```
tool | expected | happened | workaround | time_lost
```

The entries that matter to the Amazon Developer Hackathon are the ones on
**Vega OS / the Vega SDK, Bedrock and Polly**. They begin when Phase 0 runs.
Entries on the general toolchain are kept below them, separately, so the
Amazon feedback is not diluted by things Amazon cannot act on.

---

## Amazon developer tools

### 2026-09-22 — the Vega SDK installer cannot be automated, and fails halfway when it is

- **tool:** Vega SDK installer (`get_vvm.sh`), Vega CLI 1.3.4
- **expected:** a scripted install, or at least a documented non-interactive flag. The docs describe three prompts whose answers are all "press Enter for the default", which is exactly the shape a `--yes` flag exists for.
- **happened:** the installer has no non-interactive mode. Run with stdin closed it installs the CLI, then dies at the first prompt with `Error: failed to get SDK path: failed to read input: EOF` and `[X] Vega CLI not set up`, leaving a half-installed CLI with no SDK. Feeding it blank lines gets further, but later confirmations are read from `/dev/tty` directly, printing `get_vvm.sh: line 520: /dev/tty: Device not configured` twice and defaulting through them. The install completed, but only because every default happened to be the right answer.
- **workaround:** `yes '' | bash get_vvm.sh`. Fragile by construction — it answers every future prompt with the default too.
- **time_lost:** 25 min
- **what would have helped:** a `--yes` / `--non-interactive` flag and an `--install-dir` option. CI, containers and AI coding agents all lack a TTY — and Amazon ships an MCP server and Agent Skills specifically so agents can drive this toolchain, which makes the installer the one step in that toolchain an agent cannot complete.

### 2026-09-22 — the install command is invisible to any documentation reader that is not a browser

- **tool:** Amazon Vega documentation (`developer.amazon.com/docs/vega/0.24/`)
- **expected:** find the installer command on the SDK installation page.
- **happened:** the prose describes everything around the command — prerequisites, prompts, what gets installed — but every actual command sits in a `<code>` element that text extraction drops. The page reads as a complete set of instructions with the instructions missing. The obvious URL `set-up-sdk.html` is also a 404; the real page is `install-vega-sdk.html`, reachable only by following a link out of `run-apps.html`.
- **workaround:** fetched the raw HTML and parsed the `<code>` elements to recover `curl -fsSL https://sdk-installer.vega.labcollab.net/get_vvm.sh | bash`.
- **time_lost:** 20 min
- **what would have helped:** those commands are the payload of the page. A plain-text or Markdown view of the docs fixes this whole class of problem — the same class the Builder Tools MCP server exists to solve, which suggests Amazon already knows.

### 2026-09-22 — Bedrock is unreachable from this account, and nothing says why

- **tool:** Amazon Bedrock (`bedrock-runtime`, AWS CLI v2.36.50)
- **expected:** the console's Model access page now says serverless foundation models "are automatically enabled across all AWS commercial regions when first invoked", so the first `InvokeModel` should just work.
- **happened:** every call fails with `ValidationException — Error 002: Access to Bedrock models is not allowed for this account`. Identical in `us-east-1`, `us-west-2` and `eu-west-1`, and identical for `InvokeModel` and `Converse`. `get-foundation-model-availability` returns `regionAvailability AVAILABLE`, `entitlementAvailability AVAILABLE`, `agreementAvailability AVAILABLE` and `authorizationStatus NOT_AUTHORIZED` — it names the state but never the reason. `get-use-case-for-model-access` answers `You have not filled out the request form`, pointing at a console page that has been retired. Polly succeeds on the same credentials in the same region, so this is Bedrock-specific rather than an account or credentials problem.
- **workaround:** none found from the API. The error names no cause, no remediation and no link; the one API that sounds like the fix (`put-use-case-for-model-access`) takes an undocumented `--form-data` blob. Escalating to AWS Support, and designing a provider fallback for the one pipeline stage that needs vision.
- **time_lost:** 70 min
- **what would have helped:** `Error 002` should say which condition failed and where to resolve it. `authorizationStatus: NOT_AUTHORIZED` is the right field to carry a reason code and it carries none. The retired Model-access page should not still be referenced by a live API error string.

### 2026-09-22 — `aws login` failed with an HTTP 400 and no diagnosis

- **tool:** AWS CLI v2 `aws login`
- **expected:** with an active Management Console session in the browser, `aws login` acquires temporary credentials.
- **happened:** the CLI prompted for a region, then the browser leg returned a bare `400 Bad Request — You may have typed the address incorrectly or you may have used an outdated link. Please clear your cookies and try the request again.` No indication of which identity it expected or what was stale. A partial session row was left behind in `~/.aws/cli/cache/session.db` while no `~/.aws/config` was written.
- **workaround:** deleted `~/.aws/cli/cache`, wrote the region into `~/.aws/config` by hand, signed into the AWS console in a clean browser context and re-ran `aws login`. It then worked.
- **time_lost:** 20 min
- **what would have helped:** the 400 page is a generic Amazon sign-in error with nothing tying it back to the CLI handshake. Saying "you are signed in to a different Amazon identity than the AWS console" would have taken this from twenty minutes to one.

### 2026-09-25 — W3C `src` playback is broken on the Virtual Device, and every signal points at your file

- **tool:** `@amazon-devices/react-native-w3cmedia` 2.3.2, Vega SDK 0.24, VVD OS 1.2
- **expected:** `player.src = <uri>` loads the media, per the W3C Media API the package implements and the platform's own URL-mode documentation.
- **happened:** `MEDIA_ERR_SRC_NOT_SUPPORTED` (code 4) **before a single byte is requested** — verified against a host access log that recorded zero requests. Empty native message, no `W3CMEDIA` log line at any priority. The same failure for a remote URL, for a packaged `file://` path, and for `AudioPlayer` as well as `VideoPlayer`. `canPlayType()` returned `"probably"` for the exact type the player then refused.
- **workaround:** fetch the bytes in JavaScript and hand them to the same player through a `MediaSource` — `srcObject`, not `src`, and a **fragmented** MP4. Same device, same session, same footage: `.src` fails, MSE plays 253 frames with 0 dropped.
- **time_lost:** ~4 hours across four sessions
- **what would have helped:** three things, each small. (1) `canPlayType()` exists precisely so an app can avoid this call, and it answered `"probably"` — that disagreement is a bug in its own right. (2) The error is indistinguishable from a genuinely unsupported file, so all six of our eliminations went looking at the asset: format, container, codec profile, packaging, path, byte-reachability. Any diagnostic that said *rejected before fetch* would have redirected us in one run. (3) One line in the media troubleshooting docs — *if URL playback fails, try the same content over MSE to isolate source handling from the pipeline* — would have saved all of it.

### 2026-09-25 — `videoWidth` reports 0 on a video that is demonstrably decoding

- **tool:** `@amazon-devices/react-native-w3cmedia` 2.3.2
- **expected:** after `loadedmetadata`, `videoWidth`/`videoHeight` carry the frame size.
- **happened:** both stay `0` through `loadedmetadata`, `playing` and beyond — and the platform's own `resize` event arrives carrying `w=0 h=0`. That is the exact signature of audio-only playback, on a stream that was decoding 253 video frames with none dropped.
- **workaround:** gate on `getVideoPlaybackQuality().totalVideoFrames` instead. Reading the package source explains the zeros: `VideoPlayer.js:225` only assigns `videoWidth_` from a `resize` event, so it reports whatever the platform sent, and the platform sent zero.
- **time_lost:** 25 min
- **what would have helped:** a `resize` event with real dimensions. Failing that, a documented note that `videoWidth` is unreliable on the Virtual Device — it is the first thing anyone checks when a video does not appear.

### 2026-09-25 — `vega device run-cmd` is a sandboxed app context, and says a resource is absent when it simply cannot see it

- **tool:** Vega CLI 1.3.4
- **expected:** a device shell for inspecting the device.
- **happened:** it runs as `uid=5000(app_user)` inside an app context. `ps` lists two processes — itself and `dev_shell_app` — so the entire system is invisible, and `/dev/input` reports `No such file or directory` while key injection through that same shell works. Every probe run from there that reports something **absent** has reported nothing at all.
- **workaround:** stop concluding anything negative from it. Positive results are still trustworthy; that is how `inputd-cli` was found.
- **time_lost:** 30 min, and it nearly produced a wrong root cause — the same trap another developer reported publicly, concluding the device had no audio hardware while its boot chime was audible.
- **what would have helped:** a permission-denied path that says so instead of reporting the resource as missing. `ENOENT` and *you are not allowed to see this* are different answers and only one of them is true.

### 2026-09-25 — no screenshot path for the Virtual Device

- **tool:** Vega CLI 1.3.4 / VVD
- **expected:** some way to see what the device is showing, to verify a UI or debug a black screen.
- **happened:** `vega device` has no capture command. On-device, `screenshooter` fails at dbus marshalling (`null value passed for arg 1`) and `gwsi-tool-screenshooter` needs `com.amazon.dev.shell.service`, which is not running. Host-side, the QEMU window cannot be captured without granting Screen Recording permission, and `osascript` is denied assistive access.
- **workaround:** none for pixels. Everything in this build is verified through log lines and decoded-frame counts instead, which is why an HTTP beacon exists in this repo at all.
- **time_lost:** 45 min across two sessions
- **what would have helped:** `vega device screenshot`. It is the single most useful missing command for a TV platform, where the whole product is what is on the screen.

---

## Toolchain

### 2026-09-22 — the scaffold's pinned test runner ships a critical advisory

- **tool:** npm / vitest
- **expected:** `vitest ^2.0.0`, as pinned in the implementation spec, installs cleanly.
- **happened:** `npm audit` reported **5 vulnerabilities (3 moderate, 1 high, 1 critical)** — a path-traversal / arbitrary-file-read advisory reaching `vitest` through `@vitest/mocker`, plus an `esbuild` dev-server advisory through `vite`. The submission repository has to be public and the judges clone and run it; shipping that is not an option.
- **workaround:** bumped to `vitest ^5.0.1` and `@types/node ^24.0.0`, wiped `node_modules` and the lockfile, reinstalled → `found 0 vulnerabilities`. The spec's Phase 1 now runs `npm audit` as a step rather than as a courtesy.
- **time_lost:** 10 min

### 2026-09-22 — the test baseline could not be measured from an empty repository

- **tool:** vitest
- **expected:** running the test command on a fresh scaffold reports zero tests and exits 0, giving a pass line to record as the project's baseline.
- **happened:** `vitest run` with no test files prints `No test files found, exiting with code 1` and exits **1**. There is no pass line, so the baseline had nothing to measure against.
- **workaround:** wrote the first real test (the verbosity word-budget suite) before closing the scaffold step, so the baseline is measured against a run that actually asserts something. Rejected `--passWithNoTests`: it produces a green line that proves nothing, which is a worse oracle than none.
- **time_lost:** 15 min
