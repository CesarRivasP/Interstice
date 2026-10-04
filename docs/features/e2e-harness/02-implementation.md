# Implementation (1 of 5) — E2E harness — the spike gate and the app-side changes

> Complements `01-master-plan.md`. Code steps, file by file. This file holds the preamble and Phases 0–6; `02b-harness.md` holds Phases 7–10, `02b2-scenarios.md` Phases 11–12, `02b3-runner.md` Phase 13 and `02c-report-and-delivery.md` Phases 14–18; the test plan, the manual E2E and the Definition of Done live in `02e-tests-and-e2e.md`.
> Written by `implement` (stage 2), after `review` R2 ran, R3 dispositioned its findings, and the owner confirmed on 2026-10-04.

- **Date:** 2026-10-04
- **Branch:** `main`
- **Test baseline:** `npm test` exit 0 — jest: Tests 24 passed, 24 total · vitest: Test Files 10 passed (10), Tests 70 passed (70) (`_facts.yml tests_baseline`)

> Shared data comes from `_facts.yml`. Cross-refs to `01-master-plan.md §N` resolve to real sections.
> **This document is executable, not descriptive.** Its reader is whoever builds it — possibly a smaller model with none of the authoring conversation.
> The preamble below governs `02b-harness.md`, `02b2-scenarios.md`, `02b3-runner.md`, `02c-report-and-delivery.md` and `02e-tests-and-e2e.md` too.

**The set of eight:** `01` (the decision) · `02` (preamble, Phases 0–6) · `02b` (Phases 7–10) · `02b2` (Phases 11–12) · `02b3` (Phase 13) · `02c` (Phases 14–18) · `02e` (tests, manual E2E, Definition of Done) · `03` (what the judging panel receives).

---

## Changelog

### 2026-10-04 — v4: build R6 — the harness is built and both suites ran on the Virtual Device: ten scenarios pass, one is blocked, and two fail on defects in the app (D8, D9); the report is generated into docs/e2e; fixture audio falls back to the host voice when Polly is unreachable

Built. The code blocks in the implementation halves are the files as they stand after the first device runs, not as first written.

### 2026-10-04 — v3: verify R5 — Phase 0 ran on the Virtual Device: D1, D2, D3 and D5 hold; D4 is dead as written and fixed by keying the Metro cache on the flag (changes C24); the capture rung is grpc, the input route inputd-cli; status reviewed -> implementing

Phase 0 is done; its results are on `defects[D1]`–`[D5]`. Phase 4 gained `C24` (`metro.config.js`) and lost its fallback paragraph, which described a workaround for a failure that now has a measured fix. Phases 4 and 5 are **built**: they had to exist for `D4` and `D5` to be asked.

### 2026-10-04 — v2: review R2 dispositions and owner confirmation — a launch id on the wire, fixtures addressed by collector state not by URL, a 60 s fixture asset so a stall can happen, the device restored to the Release package after a VARIANT run, published paths made relative; status draft -> reviewed

Written for the first time, against the plan as `review` left it. Split in five from the start, each cut on a phase boundary: what changes inside the app, the harness modules on the host, the scenarios, the runner, and what turns a run into something published.

---

## Preamble

**Language and layout.** TypeScript, run with `tsx` (already a devDependency). Everything the harness owns lives under `e2e/`. Nothing under `e2e/` is imported by `src/`, and nothing under `e2e/` imports from `src/`.

**Command notation.** `⟨commands.X⟩` means the value of `commands.X` in `docs/features/_profile.yml`, with `{component_id}` and `{log_tag}` substituted. They are, today:

| notation | value |
|---|---|
| `⟨commands.tests⟩` | `npm test` — pass signal is exit 0 |
| `⟨commands.lint⟩` | `npm run lint` |
| `⟨commands.build⟩` | `npm run build` |
| `⟨commands.js_log⟩` | `node tools/beacon-server.mjs` plus reverse-forwarding port 8099 |
| `⟨commands.force_stop⟩` | `vega device terminate-app --appName com.cesarrivasp.interstice.main` |

A phase that creates a new `package.json` script names it as "the `e2e:release` script (`C17`)". Those scripts enter `_profile.yml` under `commands:` in Phase 6, the moment they exist, and not before.

**Two repositories of facts.** A bare `C4`, `D1`, `AC7` is this set's. The app's are always written `` `docs/features/interstice/_facts.yml` acceptance.AC5 ``.

**Logging convention.** The app's lines are `INTERSTICE.<area>.<event> key=value …`, sent by `src/diagnostics.ts`. A token without `=` continues the value before it, so `spoken=The video paused` is one field. The package's lines arrive without the prefix and `src/App.tsx` adds it.

**Ground rules.**
1. A verdict is computed from the trace. No phase adds a check that reads a pixel.
2. An assertion that something did **not** happen names the line that would have said it did, and requires a line emitted *after* the window in question, so silence is never mistaken for absence.
3. Every device run records `target_platform`, `build`, `content_asset` — the keys of `_profile.yml conditions_required`.
4. `src/` changes are registered in the app set in the same commit (`01-master-plan.md` §3.3), or `pipeline/__tests__/scope.test.ts` fails.

---

## Part A — Implementation plan

### Phase 0 — the spike gate `[MANUAL]`

**Verifies:** `AC1`. Nothing after this phase is built until its five answers are in `_facts.yml` as `basis: measured`.

**Setup, once.**
1. `vega virtual-device start` — wait for `vega virtual-device status` to report `"running":true`.
2. `⟨commands.build⟩`, then `vega device install-app --packagePath build/aarch64-release/interstice_aarch64.vpkg`.
3. `vega device start-port-forwarding --port 8099 --forward false`.
4. In a second terminal: `node tools/beacon-server.mjs`.
5. `vega device launch-app --appName com.cesarrivasp.interstice.main`. The beacon terminal prints `INTERSTICE.asset.segments n=4 init=set`. If it does not, stop: nothing below can be observed.

**0.1 — `D2`: do injected keys reach the app?**
1. With the title list on screen: `vega device run-cmd -c 'inputd-cli button_press KEY_ENTER'`.
2. **Observation:** the beacon prints `INTERSTICE.app.play id=tears-of-steel` within 15 s (`limits.timing` `wait_for_line_ms`).
3. Then `vega device run-cmd -c 'inputd-cli button_press KEY_BACK'` → `INTERSTICE.player.back from=playing`.
4. Record on `defects[D2]`: `basis: measured`, `evidence: { how: device, n: <runs>, cmd, date, value: <the line, or "no line in 15 s"> , conditions }`. Lines seen → `status: fixed` and `input_route` is `inputd-cli`. No line → `status: dead`, and 0.2 must also answer for `sendKey`.

**0.2 — `D1`: does the emulator gRPC interface return a current frame?**
1. Read `R-VVD-DRIVER`'s `LICENSE` and `README`. Record the license in `limits.capture.wrapper_license`. If it forbids use or has none, do not run it: go to step 5.
2. Clone it at its current commit into `e2e/out/spike/` (ignored by git) and note the commit hash.
3. Enable the interface as its README says, take a screenshot of the title list, press ENTER (by whichever route 0.1 left working, or the wrapper's own key command), wait for `INTERSTICE.app.play` in the beacon, take a second screenshot.
4. **Observation:** the two files are non-empty and differ, and the second shows the player. Take a third, two seconds later, with nothing pressed: it matches the second frame's screen, not the first's.
5. If the wrapper cannot be used: start Appium with the Vega driver per `R-APPIUM` and make the same three captures. Note that `limits.capture.host_node` is above the Node version the driver is reported to need.
6. Record on `defects[D1]` as in 0.1, and set `capture_rung` for the set: `grpc`, `appium`, or `none`. Record the gRPC port in `endpoints.emulator_grpc` if there is one.

**0.3 — `D3`: does a recorded clip carry sound?**
1. Only if 0.2 ended on `grpc`. Start a recording, select the title, wait for `INTERSTICE.audio.restored id=probe`, stop the recording.
2. `ffprobe -v error -show_streams <clip>` → is there an audio stream? `ffmpeg -i <clip> -af volumedetect -f null -` → is `mean_volume` above `-91 dB`?
3. **Observation:** an audio stream that is not digital silence. If so, also note the two beacon timestamps of `audio.duck` and `audio.restored` — `02c` Phase 16 uses them to cut the level measurement.
4. Record on `defects[D3]`. This one changes nothing if false.

**0.4 — `D4`: does the build flag reach the bundle, in both directions?**
1. Apply Phase 4 and the `app.mode` line of Phase 5 on a scratch branch.
2. `INTERSTICE_E2E=http://localhost:8099 npx react-native build-vega --build-type Release`, install, launch → the beacon must print `INTERSTICE.app.mode e2e=true host=http://localhost:8099`.
3. **Then, without cleaning anything:** `⟨commands.build⟩`, install, launch → `INTERSTICE.app.mode e2e=false host=none`.
4. Step 3 is the half that matters: a transform cache that keeps the previous build's constant would put the test host inside the package that gets submitted. If step 3 prints `e2e=true`, record `status: dead` and switch Phase 4 to the fallback written under it.
5. Record on `defects[D4]`.

**0.5 — `D5`: do host-served bytes play through `MediaSource`?**
1. Serve `src/assets/seg/` from the host on port 8099 under `/fx/` — any static server bound to `127.0.0.1` will do for the spike, with the beacon server stopped.
2. On the scratch branch, point `DEMO_ASSET`'s `initUri` and each segment `uri` at `http://localhost:8099/fx/<file>`. Build, install, launch, select.
3. **Observation:** the static server logs one request per file. Restart the beacon server on the same port afterwards and repeat to read the lines: `INTERSTICE.buffer.appended` once per segment and no `INTERSTICE.buffer.failed`. (Two processes cannot hold the port at once in the spike; the real collector of `02b` Phase 8 does both jobs.)
4. Record on `defects[D5]`. If false, fixtures travel inside the VARIANT package and `S15` is blocked.

**0.6 — close the gate.** Write the five results into `_facts.yml`, append the round to `_log.md`, and write one `FRICTION-LOG.md` entry per obstacle met (`02c` Phase 18). If `D1` and `D2` are both `dead`, the set stops here.

**Phase 0 verification:** `02e-tests-and-e2e.md` §C.1.

---

### Phase 1 — `C12` `src/diagnostics.ts`

**File:** `src/diagnostics.ts`
**Anchor:** `src/diagnostics.ts:19` — `export function log(line: string): void {`

**What changes:** each line carries a launch id, a sequence number within the launch, and the device clock. The launch id is what lets one collector session span many launches (`review` R2-F1).

**Code** — replace from line 17 (`const BEACON = …`) to the end of the file:

```ts
const BEACON = 'http://localhost:8099/';

// One id per launch. The sequence restarts at 0 with the module, and a
// collector session spans many launches: without this a lost line in one launch
// is hidden by the same number from the one before it.
const BOOT = Math.random().toString(36).slice(2, 8);
let seq = 0;

export function log(line: string): void {
  console.log(line);
  const s = seq++;
  try {
    void fetch(
      `${BEACON}?m=${encodeURIComponent(line)}&b=${BOOT}&s=${s}&t=${Date.now()}`,
    ).catch(() => {});
  } catch {
    // the beacon is diagnostic only: never let it break playback
  }
}
```

**Contracts implemented:** `contracts.beacon_query`, `endpoints.beacon`.

**Phase 1 verification:** `⟨commands.tests⟩` → exit 0; then `02e-tests-and-e2e.md` §C.2.

---

### Phase 2 — `C16` `tools/beacon-server.mjs`

**File:** `tools/beacon-server.mjs`
**Anchor:** `tools/beacon-server.mjs:22` — `const msg = url.searchParams.get('m');`

**What changes:** prints the launch id and sequence beside each line. Still zero dependencies, still the reader for a manual run.

**Code** — replace the body of the `if (msg) { … }` block:

```js
  if (msg) {
    const ts = new Date().toISOString().slice(11, 23);
    const boot = url.searchParams.get('b') ?? '------';
    const seq = (url.searchParams.get('s') ?? '').padStart(4, ' ');
    console.log(`${ts}  ${boot} ${seq}  ${msg}`);
  }
```

**Contracts implemented:** `contracts.beacon_query`.

**Phase 2 verification:** `02e-tests-and-e2e.md` §C.2.

---

### Phase 3 — `C15` `src/screens/PlayerScreen.tsx`

**File:** `src/screens/PlayerScreen.tsx`

**What changes:** three emitters, the ones `limits.trace` `new_lines` lists for this file. They exist because "the film kept playing" and "this is what was spoken" were unobservable (`limits.trace` `no_position_line`).

**Anchor 1:** `src/screens/PlayerScreen.tsx:82` — `const offPosition = media.video.onPosition(ms => scheduler.current?.tick(ms));`

**Code** — replace that one line with:

```tsx
    // At most one line per second. A stall stops positions arriving, so the
    // line stops too — which is exactly what makes "still playing" assertable.
    let lastProgress = -Infinity;
    const offPosition = media.video.onPosition(ms => {
      scheduler.current?.tick(ms);
      if (ms - lastProgress >= 1000 || ms < lastProgress) {
        lastProgress = ms;
        log(`INTERSTICE.player.progress pos_ms=${Math.round(ms)}`);
      }
    });
```

**Anchor 2:** `src/screens/PlayerScreen.tsx:195` — the line `  }, [status, onExit]);` that closes the BACK effect.

**Code** — insert directly after it:

```tsx

  // What the viewer is told, as it is told. The overlay's spoken sentence is an
  // accessibilityLabel and reaches no log on its own.
  useEffect(() => {
    const shown = overlayFor(status, detail);
    log(
      shown
        ? `INTERSTICE.overlay.shown status=${status} spoken=${shown.spoken}`
        : 'INTERSTICE.overlay.cleared',
    );
  }, [status, detail]);

  // The package logs the KIND it announced; the sentence depends on the rest.
  useEffect(() => {
    log(
      ad.kind === 'ready'
        ? `INTERSTICE.ad.state kind=ready enabled=${ad.enabled} verbosity=${ad.verbosity} cues=${ad.cues}`
        : `INTERSTICE.ad.state kind=${ad.kind}`,
    );
  }, [ad]);
```

**One sample line per emitter**, distinguishable at a glance:

```
INTERSTICE.player.progress pos_ms=7012
INTERSTICE.overlay.shown status=stalled spoken=The video paused while it loads more. Press back to return to the list.
INTERSTICE.overlay.cleared
INTERSTICE.ad.state kind=ready enabled=true verbosity=standard cues=3
INTERSTICE.ad.state kind=missing
```

**Contracts implemented:** `limits.trace` `new_lines` (`player_progress`, `overlay_shown`, `overlay_cleared`, `ad_state`), `limits.timing` `progress_interval_ms` (1000).

**Phase 3 verification:** `⟨commands.tests⟩` → exit 0. `test/PlayerScreen.spec.tsx` collects lines through `test/mocks/diagnostics.ts`; if a test there asserts an exact list of lines, extend the list — do not drop the emitter. Then `02e-tests-and-e2e.md` §C.2.

---

### Phase 4 — `C23` `babel.config.js` and `C13` `src/e2e.ts`

**File:** `babel.config.js`
**Anchor:** `babel.config.js:1` — `module.exports = {` (the whole file is three lines; replace it).

**What changes:** an inline plugin turns the identifier `__INTERSTICE_E2E__` into a string constant: the value of the `INTERSTICE_E2E` environment variable at build time, or the empty string.

**Code** — whole file:

```js
// decisions.two_suites (docs/features/e2e-harness): ONE source tree, two
// packages. The flag is a build-time constant so the Release package has no
// run-time input that could point it at a test host.
const e2eHost = process.env.INTERSTICE_E2E ?? '';

function defineE2E({types: t}) {
  return {
    name: 'interstice-define-e2e',
    visitor: {
      Identifier(path) {
        if (
          path.node.name === '__INTERSTICE_E2E__' &&
          path.isReferencedIdentifier()
        ) {
          path.replaceWith(t.stringLiteral(e2eHost));
        }
      },
    },
  };
}

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [defineE2E],
};
```

**File:** `src/e2e.ts` `(new)`
**Anchor:** new file, full content below.

**Code:**

```ts
/**
 * The ONLY place the build flag is read.
 *
 * `babel.config.js` replaces `__INTERSTICE_E2E__` with the value of the
 * INTERSTICE_E2E environment variable at build time, or with ''. A Release
 * build therefore compiles `E2E` to null and nothing at run time can change
 * that — see docs/features/e2e-harness/_facts.yml decisions.two_suites and
 * alternatives[A3] for why this is not a run-time switch.
 */
declare const __INTERSTICE_E2E__: string;

export interface E2EConfig {
  /** origin of the collector as the device sees it */
  host: string;
  asset_id: string;
  /** where track files resolve */
  asset_dir: string;
  /** where init and media segments resolve */
  segment_base: string;
}

const host: string = __INTERSTICE_E2E__;

export const E2E: E2EConfig | null = host
  ? {
      host,
      asset_id: 'e2e-fixture',
      asset_dir: `${host}/fx`,
      segment_base: `${host}/fx`,
    }
  : null;
```

**Same commit, in the app set:** add to `docs/features/interstice/_facts.yml changes[]`, on one line in the form its `scope.test.ts` parses:

```yaml
  - { id: C28, file: src/e2e.ts, kind: planned, where: repo, built: '2026-10-XX — owned by docs/features/e2e-harness as its C13; the build flag resolved to a config or null',
      change: 'reads the build-time flag; null in a Release build' }
```

Use the next free id there (check `rg -n "id: C2[0-9]" docs/features/interstice/_facts.yml`; `C27` is the highest on 2026-10-04) and the real date.

**File:** `metro.config.js` — `C24`
**Anchor:** the `const config = {` line of the root `metro.config.js`

**What changes:** the flag becomes part of Metro's cache version. **This is not optional.** Measured in Phase 0.4 on 2026-10-04: with the Babel plugin alone, four alternating builds all launched as `e2e=true` — the transform cache does not key on the environment, so a Release build made after a flagged one is served the flagged constant.

**Code** — insert as the first property of `config`:

```js
  // The transform cache does not key on the environment, so without this a
  // Release build made after a flagged one KEEPS the flagged constant — measured
  // on 2026-10-04: four alternating builds, all four reported e2e=true. The
  // flag babel.config.js compiles in is therefore part of the cache version.
  cacheVersion: `interstice-e2e:${process.env.INTERSTICE_E2E ?? ''}`,
```

**Contracts implemented:** `contracts.e2e_config`, `decisions.two_suites`, `limits.fixture` `asset_id`.

**Phase 4 verification:** `⟨commands.tests⟩` → exit 0 (jest runs through the same babel config, so `E2E` is null under test and `scope.test.ts` sees the new entry); `⟨commands.lint⟩` → exit 0. Then `02e-tests-and-e2e.md` §C.3.

---

### Phase 5 — `C14` `src/App.tsx`

**File:** `src/App.tsx`

**What changes:** one line in both builds saying which build this is; under the flag only, a second title whose media, track and cue audio come from the host.

**Anchor 1:** `src/App.tsx:6` — `import {log} from './diagnostics';`

**Code** — insert after it:

```tsx
import {E2E, type E2EConfig} from './e2e';
import type {AssetSource} from 'react-native-tv-audio-description';
```

**Anchor 2:** `src/App.tsx:74` — `setLogger(line => log(`INTERSTICE.${line}`));`

**Code** — insert after it:

```tsx

// Which build this is, in every launch of either build. S01 asserts e2e=false
// on the Release package, and AC15 asserts it again after a VARIANT run.
log(`INTERSTICE.app.mode e2e=${E2E !== null} host=${E2E?.host ?? 'none'}`);
```

**Anchor 3:** `src/App.tsx:86` — `const TITLES = [{id: 'tears-of-steel', label: 'Tears of Steel'}];`

**Code** — replace that line with:

```tsx
const TITLES = [
  {id: 'tears-of-steel', label: 'Tears of Steel'},
  // VARIANT build only. The label is limits.fixture.title_label, verbatim: if
  // this build is ever on screen when it should not be, it says so itself.
  ...(E2E ? [{id: E2E.asset_id, label: 'E2E FIXTURE — not a film'}] : []),
];
```

**Anchor 4:** `src/App.tsx:98` — the closing `}` of `async function readJson`.

**Code** — insert after it:

```tsx

type Playing = {id: string; asset: AssetSource; assetDir: string; cueUri: string};

/** contracts.fixture_asset, read from the host and resolved against it */
async function fixtureAsset(e2e: E2EConfig): Promise<AssetSource> {
  const layout = (await readJson(`${e2e.segment_base}/asset.json`)) as {
    init: string;
    segments: {index: number; start_ms: number; end_ms: number; uri: string}[];
  };
  return {
    initUri: `${e2e.segment_base}/${layout.init}`,
    segments: layout.segments.map(s => ({
      ...s,
      uri: `${e2e.segment_base}/${s.uri}`,
    })),
  };
}
```

**Anchor 5:** `src/App.tsx:100` — `export const App = () => {` through the end of the component's `return`.

**Code** — replace the component:

```tsx
export const App = () => {
  const [playing, setPlaying] = useState<Playing | null>(null);
  const exit = useCallback(() => setPlaying(null), []);

  const start = useCallback(async (id: string) => {
    log(`INTERSTICE.app.play id=${id}`);
    if (E2E && id === E2E.asset_id) {
      try {
        // no probe cue here: the only cues that fire are the fixture track's
        setPlaying({id, asset: await fixtureAsset(E2E), assetDir: E2E.asset_dir, cueUri: ''});
      } catch (err) {
        log(`INTERSTICE.app.fixture failed err=${(err as Error).message}`);
      }
      return;
    }
    setPlaying({
      id,
      asset: DEMO_ASSET,
      assetDir: '/pkg/bundle/assets/src/assets',
      cueUri: resolvedCue?.uri ?? '',
    });
  }, []);

  if (playing) {
    return (
      <PlayerScreen
        media={media}
        asset={playing.asset}
        cueUri={playing.cueUri}
        assetDir={playing.assetDir}
        assetId={playing.id}
        readJson={readJson}
        onExit={exit}
      />
    );
  }

  return (
    <View style={styles.list}>
      <Text style={styles.heading}>Interstice</Text>
      {TITLES.map((title, index) => (
        <Pressable
          key={title.id}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Play ${title.label}`}
          hasTVPreferredFocus={index === 0}
          onPress={() => void start(title.id)}>
          <Text style={styles.title}>{title.label}</Text>
        </Pressable>
      ))}
    </View>
  );
};
```

`INTERSTICE.app.play` moved from the `onPress` into `start`; it is still emitted once per press, before anything else.

**Contracts implemented:** `contracts.e2e_config`, `contracts.fixture_asset`, `limits.fixture` (`asset_id`, `title_label`), `limits.trace` `new_lines` `app_mode`.

**Phase 5 verification:** `⟨commands.tests⟩` → exit 0 (`test/App.spec.tsx` covers the list and BACK and must still pass unchanged); then `02e-tests-and-e2e.md` §C.3.

---

### Phase 6 — `C17` `package.json`, `C18` `vitest.config.ts`, `C19` `.gitignore`

**File:** `package.json`
**Anchor:** the last entry of `scripts` in the root `package.json` — `"pipeline": "tsx pipeline/run.ts"`

**Code** — add after it, inside `scripts` (and a comma on the anchor line):

```json
    "build:e2e": "INTERSTICE_E2E=http://localhost:8099 react-native build-vega --build-type Release",
    "e2e:fixtures": "tsx e2e/fixtures.ts",
    "e2e:release": "tsx e2e/run.ts --suite release",
    "e2e:variant": "tsx e2e/run.ts --suite variant",
    "e2e": "npm-run-all e2e:release e2e:variant",
    "e2e:selftest": "vitest run e2e/__tests__/selftest.test.ts",
    "e2e:report": "tsx e2e/report/build.ts",
    "e2e:publish": "tsx e2e/report/publish.ts",
    "lint:e2e": "tsc --noEmit -p e2e/tsconfig.json"
```

and change the existing `lint` script to `"npm-run-all lint:app lint:pipeline lint:e2e"`.

**File:** `e2e/tsconfig.json` `(new)` — configuration, not source: a copy of `pipeline/tsconfig.json`, unchanged.

**File:** `vitest.config.ts`
**Anchor:** `vitest.config.ts:9` — `include: ['pipeline/__tests__/**/*.test.ts'],`

**Code** — replace that line with:

```ts
    include: ['pipeline/__tests__/**/*.test.ts', 'e2e/__tests__/**/*.test.ts'],
```

**File:** `.gitignore`
**Anchor:** the line `build` under `# vega build output`.

**Code** — insert before that comment:

```
# e2e harness run output — the published run lives in docs/e2e/, by e2e:publish
e2e/out/
```

**Then, in `docs/features/_profile.yml` under `commands:`** — these exist now, so they are recorded now:

```yaml
  e2e_release:  "npm run e2e:release"
  e2e_variant:  "npm run e2e:variant"
  e2e_report:   "npm run e2e:report"
```

and re-measure `tests_expect` in the same edit: it still reads `63 passed, 63 total` (`01-master-plan.md` §3.3) and the count moves again when `02b` Phase 7 adds tests.

**Contracts implemented:** `env_vars` (`INTERSTICE_E2E`), `decisions.report_static_pages` (the ignore).

**Phase 6 verification:** `⟨commands.tests⟩` → exit 0; `⟨commands.lint⟩` → exit 0 once `02b` Phase 7 has put a first file under `e2e/`.

---

## Continues in `02b-harness.md`

Phases 7–10: the trace parser and assertions (`C6`), the collector (`C5`), the device and input modules (`C2`, `C3`). Then `02b2-scenarios.md`, Phases 11–12: capture (`C4`) and the scenarios (`C7`), and `02b3-runner.md`, Phase 13: the runner (`C1`). Then `02c-report-and-delivery.md`, Phases 14–18: the selftest (`C10`), the fixtures (`C8`), the report (`C9`), publication (`C11`, `C20`, `C22`) and the friction log (`C21`). Then `02e-tests-and-e2e.md`: Part B, Part C and the Definition of Done.
