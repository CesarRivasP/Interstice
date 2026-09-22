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
