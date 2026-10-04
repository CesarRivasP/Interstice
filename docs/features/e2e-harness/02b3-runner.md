# Implementation (4 of 5) — E2E harness — the runner

> Complements `01-master-plan.md`. Phase 13. Continues from `02b2-scenarios.md` and continues in `02c-report-and-delivery.md`.

- **Date:** 2026-10-04
- **Branch:** `main`
- **Test baseline:** `npm test` exit 0 — jest: Tests 24 passed, 24 total · vitest: Test Files 10 passed (10), Tests 70 passed (70) (`_facts.yml tests_baseline`)

> **The preamble of `02-implementation.md` governs this file too** — the `⟨commands.*⟩` notation, the logging convention, the two repositories of facts, the ground rules. It is not repeated here.
> Split per `references/doc-pattern.md` §Splitting an oversized doc. No technical content differs from a single-file version.

> **The code below is written against the tree of 2026-10-04 and has not been run.**

---

## Changelog

### 2026-10-04 — v4: build R6 — the harness is built and both suites ran on the Virtual Device: ten scenarios pass, one is blocked, and two fail on defects in the app (D8, D9); the report is generated into docs/e2e; fixture audio falls back to the host voice when Polly is unreachable

Built. The code blocks in the implementation halves are the files as they stand after the first device runs, not as first written.

### 2026-10-04 — v2: review R2 dispositions and owner confirmation — a launch id on the wire, fixtures addressed by collector state not by URL, a 60 s fixture asset so a stall can happen, the device restored to the Release package after a VARIANT run, published paths made relative; status draft -> reviewed

Split out on a phase boundary. The runner is the only module that touches every other one.

---

## Part A — Implementation plan (continued)

### Phase 13 — `C1` `e2e/run.ts`

**File:** `e2e/run.ts` `(new)`
**Anchor:** new file, full content below.

**What changes:** the runner. Canary first, then each scenario from a terminated app; the verdict from the trace; the Release package back on the device when a VARIANT suite ends.

**Code:**

```ts
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCapture } from './capture.js';
import { createCollector, type Collector } from './collector.js';
import * as device from './device.js';
import { INPUT_ROUTE, pressAll } from './input.js';
import { SUITES, type Scenario } from './scenarios/index.js';
import { canFail } from './selftest.js';
import { spokenFrom } from './spoken.js';
import { evaluate, integrity, ordered, type AssertionResult, type TraceEvent } from './trace.js';

const PORT = Number(process.env.BEACON_PORT ?? 8099);
const WAIT = 15_000; // limits.timing.wait_for_line_ms
const SCENARIO_TIMEOUT = 90_000; // limits.timing.scenario_timeout_ms

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? undefined : process.argv[i + 1];
};
const suite = (arg('suite') ?? 'release') as 'release' | 'variant';
const only = arg('only');
const noBuild = process.argv.includes('--no-build');

/** contracts.scenario_result */
interface Result {
  id: string; name: string; suite: 'release' | 'variant'; use_case: string; covers: string[];
  fixture: boolean; verdict: 'pass' | 'fail' | 'blocked' | 'skipped';
  reason: string | null; blocked_by: string | null;
  steps: { at_ms: number; action: string; detail: string }[];
  assertions: AssertionResult[]; spoken: string[];
  artifacts: { kind: 'screenshot' | 'clip'; path: string; at_seq: number | null; caption: string }[];
  trace_path: string; duration_ms: number;
  windows_ms?: [number, number][]; cannot_show?: string;
}

const capture = createCapture();

async function runScenario(s: Scenario, collector: Collector, dir: string): Promise<{ result: Result; events: TraceEvent[] }> {
  const base: Result = {
    id: s.id, name: s.name, suite: s.suite, use_case: s.use_case, covers: s.covers, fixture: s.fixture,
    verdict: 'blocked', reason: null, blocked_by: s.blocked_by ?? null, steps: [], assertions: [], spoken: [],
    artifacts: [], trace_path: `traces/${s.id}.jsonl`, duration_ms: 0,
    windows_ms: s.windows_ms, cannot_show: s.cannot_show,
  };
  if (s.blocked_by) return { result: { ...base, reason: `blocked by ${s.blocked_by}` }, events: [] };

  const started = Date.now();
  const deadline = started + SCENARIO_TIMEOUT;
  const at = () => Date.now() - started;
  let stepFailure: string | null = null;

  device.terminate();
  collector.arm(s.faults ?? []);
  const from = collector.mark();
  // Waits are SEQUENTIAL: each looks only at what arrived after the event the
  // previous wait matched, or after the last key press. Without this, "wait for
  // player.opened" after a second ENTER is satisfied by the first open, and
  // "wait for the stall" is satisfied by the stall every playback starts with —
  // both happened on the first device runs.
  let cursor = from;
  device.launch();

  for (const step of s.steps) {
    if (Date.now() > deadline) {
      stepFailure = `scenario timeout after ${SCENARIO_TIMEOUT} ms`;
      break;
    }
    if (step.do === 'keys') {
      cursor = collector.mark();
      await pressAll(step.keys);
      base.steps.push({ at_ms: at(), action: 'keys', detail: step.keys.join(' ') });
    } else if (step.do === 'wait') {
      const hit = await collector.waitFor(step.for, Math.min(step.timeout_ms ?? WAIT, deadline - Date.now()), cursor);
      base.steps.push({ at_ms: at(), action: 'wait', detail: `${step.for.name}${hit ? '' : ' — NOT SEEN'}` });
      if (!hit) {
        stepFailure = `waited for ${step.for.name} and it did not arrive`;
        break;
      }
      cursor = collector.after(hit);
    } else if (step.do === 'shot') {
      const path = `shots/${s.id}-${base.artifacts.length}.jpg`;
      if (await capture.screenshot(join(dir, path))) {
        const seen = collector.events();
        base.artifacts.push({ kind: 'screenshot', path, at_seq: seen[seen.length - 1]?.seq ?? null, caption: step.caption });
      }
      base.steps.push({ at_ms: at(), action: 'shot', detail: step.caption });
    } else if (step.do === 'clip_start') {
      await capture.startClip(join(dir, `clips/${s.id}.mp4`), step.seconds);
    } else if (step.do === 'clip_stop') {
      if (await capture.stopClip()) {
        base.artifacts.push({ kind: 'clip', path: `clips/${s.id}.mp4`, at_seq: null, caption: step.caption });
      }
    } else if (step.do === 'release') {
      collector.release();
      base.steps.push({ at_ms: at(), action: 'release', detail: 'held fixture requests answered' });
    }
  }

  await capture.stopClip();
  device.terminate();
  collector.disarm();

  // This scenario's launch only: the launch ids that STARTED since the mark.
  const mine = collector.bootsSince(from);
  const events = ordered(collector.events().filter((e) => mine.has(e.boot)));
  writeFileSync(join(dir, base.trace_path), events.map((e) => JSON.stringify(e)).join('\n') + '\n');

  base.assertions = s.assertions.map((a) => evaluate(a, events));
  base.spoken = spokenFrom(events);
  base.duration_ms = at();

  // One scenario, one launch. A second launch id starting inside a scenario is
  // either the app restarting on its own or a line that did not come from it;
  // neither is a trace a verdict may rest on.
  const broken =
    mine.size > 1 ? `${mine.size} launches started during the scenario, expected 1` : integrity(events);
  const failed = base.assertions.find((a) => !a.ok);
  if (broken) return { result: { ...base, verdict: 'fail', reason: `trace_incomplete — ${broken}` }, events };
  if (failed) return { result: { ...base, verdict: 'fail', reason: `assertion failed: ${failed.expect}` }, events };
  if (stepFailure) return { result: { ...base, verdict: 'fail', reason: stepFailure }, events };
  return { result: { ...base, verdict: 'pass' }, events };
}

async function main(): Promise<void> {
  if (!device.virtualDeviceRunning()) throw new Error('the Vega Virtual Device is not running — `vega virtual-device start`');
  if (suite === 'variant' && !existsSync('e2e/out/fixtures/asset.json')) throw new Error('no fixtures — `npm run e2e:fixtures`');

  const started_at = new Date().toISOString();
  const run_id = `${started_at.replace(/[:.]/g, '-')}-${suite}`;
  const dir = join('e2e/out', run_id);
  for (const sub of ['traces', 'shots', 'clips']) mkdirSync(join(dir, sub), { recursive: true });

  if (!noBuild) device.buildPackages(suite);
  const collector = await createCollector({ port: PORT, fixtureRoot: 'e2e/out/fixtures' });
  try {
    capture.prepare();
  } catch (err) {
    console.error(`capture unavailable, continuing without pictures: ${(err as Error).message}`);
  }
  device.reverseForward(PORT);
  device.install(device.PKG[suite]);

  const scenarios = SUITES[suite].filter((s) => !only || s.id === only);
  const results: Result[] = [];
  const traces = new Map<string, TraceEvent[]>();
  let restored: boolean | null = null;

  try {
    // The canary. Its seq 0 must arrive before any scenario may run, so that a
    // missing seq 0 later is never "forwarding was not up yet" (limits.trace).
    device.terminate();
    const mark = collector.mark();
    device.launch();
    const canary = await collector.waitFor({ name: 'app.mode' }, WAIT, mark);
    device.terminate();

    for (const s of scenarios) {
      if (!canary) {
        results.push((await runScenario({ ...s, blocked_by: 'no line from the device reached the collector — port forwarding or the beacon' }, collector, dir)).result);
        continue;
      }
      const { result, events } = await runScenario(s, collector, dir);
      results.push(result);
      traces.set(s.id, events);
      console.log(`${result.verdict.toUpperCase().padEnd(8)} ${s.id} ${s.name}${result.reason ? ` — ${result.reason}` : ''}`);
    }
  } finally {
    if (suite === 'variant') {
      // AC15: never leave the test build on the device, pass or fail.
      device.install(device.PKG.release);
      const mark = collector.mark();
      device.launch();
      restored = (await collector.waitFor({ name: 'app.mode', where: { e2e: 'false' } }, WAIT, mark)) !== null;
      device.terminate();
    }
    await collector.close();
  }

  const passed = results.filter((r) => r.verdict === 'pass');
  const pkg = JSON.parse(readFileSync('node_modules/react-native-tv-audio-description/package.json', 'utf8')) as { version: string };

  /** contracts.run_record */
  const record = {
    run_id,
    started_at,
    suite,
    conditions: {
      target_platform: device.describeDevice(),
      build: `Release aarch64${suite === 'variant' ? ' + INTERSTICE_E2E' : ''}, SDK ${device.sdkVersion()}`,
      content_asset: suite === 'variant' ? 'e2e-fixture: first 60 s of Tears of Steel, host-served' : 'clip: 20 s of Tears of Steel, 4 segments, packaged',
    },
    app_commit: execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(),
    package_version: pkg.version,
    capture_rung: capture.rung,
    input_route: INPUT_ROUTE,
    selftest: {
      ran: true,
      scenarios_that_can_fail: passed.filter((r) => canFail(scenarios.find((s) => s.id === r.id)!, traces.get(r.id)!)).length,
      of: passed.length,
    },
    restored_release: restored,
    results,
  };
  writeFileSync(join(dir, 'run.json'), JSON.stringify(record, null, 2) + '\n');
  console.log(`\nrun record: ${join(dir, 'run.json')}`);

  if (results.some((r) => r.verdict === 'fail') || restored === false) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

`e2e/selftest.ts` (`canFail`) and `e2e/spoken.ts` (`spokenFrom`) are imported here and written in `02c` Phase 14 and `02c` Phase 16. Build this phase after those two, or stub both to compile.

**Simplify one thing when building it:** the line that computes `mine` selects this scenario's launch by host arrival time. If `02` Phase 0 shows launches are cleanly separated by `collector.mark()`, replace it with the boots seen in `received.slice(from)` and expose that from the collector — it is the same set with one less clock in it.

**Contracts implemented:** `contracts.run_record`, `contracts.scenario_result`, `decisions.verdict_vocabulary`, `limits.timing` (`wait_for_line_ms`, `scenario_timeout_ms`), `limits.trace` `consequence` (the canary), `AC2`, `AC5`, `AC6`, `AC15`.

**Phase 13 verification:** the `e2e:release` script (`C17`) → exit 0 and five `PASS` lines; `02e-tests-and-e2e.md` §C.5. Then the `e2e:variant` script → `02e-tests-and-e2e.md` §C.6.


---

## Continues in `02c-report-and-delivery.md`

Phases 14–18: the selftest (`C10`), the fixtures (`C8`), the report (`C9`), publication (`C11`, `C20`, `C22`) and the friction log (`C21`).
