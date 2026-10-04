# Implementation (2 of 5) — E2E harness — the harness on the host

> Complements `01-master-plan.md`. Phases 7–10. Continues from `02-implementation.md` (preamble, Phases 0–6) and continues in `02b2-scenarios.md` (Phases 11–12).

- **Date:** 2026-10-04
- **Branch:** `main`
- **Test baseline:** `npm test` exit 0 — jest: Tests 24 passed, 24 total · vitest: Test Files 10 passed (10), Tests 70 passed (70) (`_facts.yml tests_baseline`)

> **The preamble of `02-implementation.md` governs this file too** — the `⟨commands.*⟩` notation, the logging convention, the two repositories of facts, the ground rules. It is not repeated here.
> Split per `references/doc-pattern.md` §Splitting an oversized doc. No technical content differs from a single-file version.

> **The code below is written against the tree of 2026-10-04 and has not been run.** Three places depend on what Phase 0 measures and say so in the block: the input route (`02` Phase 0.1), the capture rung (`02` Phase 0.2), and whether fixtures are host-served (`02` Phase 0.5).

---

## Changelog

### 2026-10-04 — v4: build R6 — the harness is built and both suites ran on the Virtual Device: ten scenarios pass, one is blocked, and two fail on defects in the app (D8, D9); the report is generated into docs/e2e; fixture audio falls back to the host voice when Polly is unreachable

Built. The code blocks in the implementation halves are the files as they stand after the first device runs, not as first written.

### 2026-10-04 — v2: review R2 dispositions and owner confirmation — a launch id on the wire, fixtures addressed by collector state not by URL, a 60 s fixture asset so a stall can happen, the device restored to the Release package after a VARIANT run, published paths made relative; status draft -> reviewed

Written for the first time. The stall scenario holds its segment until the runner releases it rather than for a fixed time, because the buffer runs 30 s ahead of the playhead and a timed delay would be absorbed without anyone noticing.

---

## Part A — Implementation plan (continued)

### Phase 7 — `C6` `e2e/trace.ts`

**File:** `e2e/trace.ts` `(new)`
**Anchor:** new file, full content below.

**What changes:** the line parser and the assertion vocabulary. Pure functions over an array of events: no device, no clock, no I/O — which is what lets `02c` Phase 14 replay them against recorded traces.

**Code:**

```ts
/** contracts.trace_event */
export interface TraceEvent {
  boot: string;
  seq: number;
  t_dev_ms: number;
  t_host: string;
  line: string;
  name: string;
  fields: Record<string, string>;
}

/**
 * `INTERSTICE.audio.duck id=c1 to_pct=25` -> name `audio.duck`, fields {id, to_pct}.
 * A token without `key=` continues the value before it, so a spoken sentence
 * is one field. Tokens before the first field land in `_` (`buffer.appended seg0 …`).
 */
export function parseLine(line: string): Pick<TraceEvent, 'name' | 'fields'> {
  const body = line.startsWith('INTERSTICE.') ? line.slice('INTERSTICE.'.length) : line;
  const [name = '', ...tokens] = body.split(' ');
  const fields: Record<string, string> = {};
  let last: string | null = null;
  for (const token of tokens) {
    const eq = token.indexOf('=');
    if (eq > 0 && /^[a-z][a-z0-9_]*$/.test(token.slice(0, eq))) {
      last = token.slice(0, eq);
      fields[last] = token.slice(eq + 1);
    } else if (last) {
      fields[last] += ` ${token}`;
    } else {
      fields._ = fields._ ? `${fields._} ${token}` : token;
    }
  }
  return { name, fields };
}

export type FieldTest = string | RegExp | ((value: string) => boolean);
export interface Match {
  name: string;
  where?: Record<string, FieldTest>;
}

export function matches(e: TraceEvent, m: Match): boolean {
  if (e.name !== m.name) return false;
  for (const [key, test] of Object.entries(m.where ?? {})) {
    const value = e.fields[key];
    if (value === undefined) return false;
    if (typeof test === 'string' ? value !== test : test instanceof RegExp ? !test.test(value) : !test(value)) {
      return false;
    }
  }
  return true;
}

export type Assertion =
  /** at least one event matches */
  | { kind: 'seen'; expect: Match }
  /** these match in this order, each on a later event than the one before */
  | { kind: 'order'; expect: Match[] }
  | { kind: 'count'; expect: Match; exactly: number }
  /** `to` follows `from` within max_ms of DEVICE time */
  | { kind: 'within'; from: Match; to: Match; max_ms: number }
  /** `start` and `end` both fall inside [window_ms] on the PLAYHEAD */
  | { kind: 'in_window'; start: Match; end: Match; window_ms: [number, number]; tolerance_ms: number }
  /**
   * nothing matches between `after` and `before`. `emitter` is mandatory: it
   * names the code that WOULD have produced the line, so an absence is never
   * asserted against a path that cannot emit.
   */
  | { kind: 'absent'; expect: Match; after: Match; before: Match; emitter: string };

/** contracts.scenario_result.assertions[] */
export interface AssertionResult {
  kind: Assertion['kind'];
  expect: string;
  ok: boolean;
  matched_seq: number | null;
}

const show = (m: Match): string =>
  m.name +
  Object.entries(m.where ?? {})
    .map(([k, v]) => ` ${k}=${typeof v === 'function' ? '(checked)' : String(v)}`)
    .join('');

const first = (events: TraceEvent[], m: Match, from = 0): number => {
  for (let i = from; i < events.length; i++) if (matches(events[i]!, m)) return i;
  return -1;
};

/**
 * Where the playhead was when `e` was emitted: the last player.progress at or
 * before it, plus the device time elapsed since. null before the first progress.
 */
export function positionAt(events: TraceEvent[], index: number): number | null {
  for (let i = index; i >= 0; i--) {
    const p = events[i]!;
    if (p.name === 'player.progress') {
      return Number(p.fields.pos_ms) + (events[index]!.t_dev_ms - p.t_dev_ms);
    }
  }
  return null;
}

export function evaluate(a: Assertion, events: TraceEvent[]): AssertionResult {
  const res = (expect: string, ok: boolean, i: number): AssertionResult => ({
    kind: a.kind,
    expect,
    ok,
    matched_seq: i >= 0 ? events[i]!.seq : null,
  });

  switch (a.kind) {
    case 'seen': {
      const i = first(events, a.expect);
      return res(show(a.expect), i >= 0, i);
    }
    case 'order': {
      let at = -1;
      for (const m of a.expect) {
        at = first(events, m, at + 1);
        if (at < 0) return res(a.expect.map(show).join(' → '), false, -1);
      }
      return res(a.expect.map(show).join(' → '), true, at);
    }
    case 'count': {
      const hits = events.filter((e) => matches(e, a.expect));
      const last = hits.length ? events.indexOf(hits[hits.length - 1]!) : -1;
      return res(`${show(a.expect)} ×${a.exactly} (saw ${hits.length})`, hits.length === a.exactly, last);
    }
    case 'within': {
      const i = first(events, a.from);
      const j = i < 0 ? -1 : first(events, a.to, i + 1);
      const ok = j >= 0 && events[j]!.t_dev_ms - events[i]!.t_dev_ms <= a.max_ms;
      return res(`${show(a.from)} → ${show(a.to)} within ${a.max_ms} ms`, ok, j);
    }
    case 'in_window': {
      const i = first(events, a.start);
      const j = i < 0 ? -1 : first(events, a.end, i + 1);
      const from = i < 0 ? null : positionAt(events, i);
      const to = j < 0 ? null : positionAt(events, j);
      const [lo, hi] = a.window_ms;
      const ok =
        from !== null && to !== null && from >= lo - a.tolerance_ms && to <= hi + a.tolerance_ms;
      return res(
        `${show(a.start)} … ${show(a.end)} inside [${lo}, ${hi}] ms (was ${Math.round(from ?? -1)} … ${Math.round(to ?? -1)})`,
        ok,
        j,
      );
    }
    case 'absent': {
      const i = first(events, a.after);
      const j = i < 0 ? -1 : first(events, a.before, i + 1);
      // Both bounds must be SEEN: an absence with no line after it is silence,
      // and silence is what a dead app produces too.
      if (i < 0 || j < 0) return res(`no ${show(a.expect)} — bounds not seen`, false, -1);
      const hit = events.slice(i + 1, j).findIndex((e) => matches(e, a.expect));
      return res(`no ${show(a.expect)} between ${show(a.after)} and ${show(a.before)} [emitter: ${a.emitter}]`, hit < 0, j);
    }
  }
}

/**
 * limits.trace.consequence: within each launch the sequence must be 0..n with
 * no gap. Returns null when whole, or the reason.
 */
export function integrity(events: TraceEvent[]): string | null {
  const byBoot = new Map<string, number[]>();
  for (const e of events) byBoot.set(e.boot, [...(byBoot.get(e.boot) ?? []), e.seq]);
  for (const [boot, seqs] of byBoot) {
    seqs.sort((a, b) => a - b);
    for (let i = 0; i < seqs.length; i++) {
      if (seqs[i] !== i) return `launch ${boot}: expected seq ${i}, got ${seqs[i]}`;
    }
  }
  return null;
}

/** arrival order is not emission order (limits.trace.ordering) */
export function ordered(events: TraceEvent[]): TraceEvent[] {
  const bootOrder = [...new Set(events.map((e) => e.boot))];
  return [...events].sort(
    (a, b) => bootOrder.indexOf(a.boot) - bootOrder.indexOf(b.boot) || a.seq - b.seq,
  );
}
```

**Contracts implemented:** `contracts.trace_event`, `contracts.scenario_result` (`assertions`), `limits.trace` (`ordering`, `consequence`), `decisions.verdict_vocabulary` (the `trace_incomplete` reason comes from `integrity`).

**Phase 7 verification:** `⟨commands.tests⟩` → exit 0 with the tests of `02e-tests-and-e2e.md` §B.1 `trace.test.ts` added.

---

### Phase 8 — `C5` `e2e/collector.ts`

**File:** `e2e/collector.ts` `(new)`
**Anchor:** new file, full content below.

**What changes:** one server on the beacon port: receives lines, serves the fixture directory with whatever faults the runner last armed.

**Code:**

```ts
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';
import { resolve, sep } from 'node:path';
import { matches, ordered, parseLine, type Match, type TraceEvent } from './trace.js';

/** what the fixture server does instead of serving a file */
export type Fault =
  /** 404 — a file that is not there */
  | { path: RegExp; kind: 'missing' }
  /** the first half of the body, then end — a file cut short */
  | { path: RegExp; kind: 'truncate' }
  /** destroy the socket — `fetch` REJECTS, which a status code never makes it do */
  | { path: RegExp; kind: 'drop' }
  /** do not answer until `release()` is called */
  | { path: RegExp; kind: 'hold' };

export interface Collector {
  /** everything received so far, in emission order */
  events(): TraceEvent[];
  /** how many events exist now — a scenario's slice starts here */
  mark(): number;
  /**
   * launch ids that STARTED since a mark: those whose seq 0 arrived after it.
   * Not "every id seen since": a terminated app keeps emitting for a second or
   * two, and its late lines arrive after the next scenario's mark.
   */
  bootsSince(from: number): Set<string>;
  waitFor(m: Match, timeoutMs: number, from: number): Promise<TraceEvent | null>;
  /** the arrival index just past an event `waitFor` returned */
  after(e: TraceEvent): number;
  arm(faults: Fault[]): void;
  disarm(): void;
  /** answer every held request */
  release(): void;
  /** fixture paths requested since the last arm(), for the run record */
  served(): string[];
  close(): Promise<void>;
}

export function createCollector(opts: { port: number; fixtureRoot: string }): Promise<Collector> {
  const root = resolve(opts.fixtureRoot);
  const received: TraceEvent[] = [];
  let faults: Fault[] = [];
  let held: Array<() => void> = [];
  let served: string[] = [];
  const waiters = new Set<() => void>();

  const sendFile = (res: ServerResponse, file: string, half: boolean) => {
    const size = statSync(file).size;
    const end = half ? Math.max(0, Math.floor(size / 2) - 1) : size - 1;
    res.writeHead(200, { 'Content-Length': end + 1, 'Access-Control-Allow-Origin': '*' });
    createReadStream(file, { start: 0, end }).pipe(res);
  };

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${opts.port}`);

    // endpoints.fixtures
    if (url.pathname.startsWith('/fx/')) {
      const rel = decodeURIComponent(url.pathname.slice('/fx/'.length));
      const file = resolve(root, rel);
      served.push(rel);
      // loopback only, and never outside the fixture directory (01 §5)
      if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404).end();
        return;
      }
      const fault = faults.find((f) => f.path.test(rel));
      if (fault?.kind === 'missing') return void res.writeHead(404).end();
      if (fault?.kind === 'drop') return void req.socket.destroy();
      if (fault?.kind === 'hold') return void held.push(() => sendFile(res, file, false));
      return sendFile(res, file, fault?.kind === 'truncate');
    }

    // endpoints.beacon
    const line = url.searchParams.get('m');
    if (line) {
      received.push({
        boot: url.searchParams.get('b') ?? '',
        seq: Number(url.searchParams.get('s') ?? -1),
        t_dev_ms: Number(url.searchParams.get('t') ?? 0),
        t_host: new Date().toISOString(),
        line,
        ...parseLine(line),
      });
      for (const wake of waiters) wake();
    }
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*' }).end();
  });

  const api: Collector = {
    events: () => ordered(received),
    mark: () => received.length,
    after: (e) => received.indexOf(e) + 1,
    bootsSince: (from) => new Set(received.slice(from).filter((e) => e.seq === 0).map((e) => e.boot)),
    waitFor(m, timeoutMs, from) {
      return new Promise((done) => {
        const check = () => {
          // arrival order here on purpose: `from` is an arrival index
          const hit = received.slice(from).find((e) => matches(e, m));
          if (!hit) return false;
          cleanup();
          done(hit);
          return true;
        };
        const timer = setTimeout(() => {
          cleanup();
          done(null);
        }, timeoutMs);
        const cleanup = () => {
          clearTimeout(timer);
          waiters.delete(check);
        };
        if (!check()) waiters.add(check);
      });
    },
    arm(next) {
      faults = next;
      served = [];
    },
    disarm() {
      faults = [];
      api.release();
    },
    release() {
      const pending = held;
      held = [];
      for (const answer of pending) answer();
    },
    served: () => [...served],
    close: () => new Promise((done) => server.close(() => done())),
  };

  return new Promise((ready, refuse) => {
    // A stale reader on this port silently eats every line the app sends: the
    // beacon is fire-and-forget, so nothing on the device would say so.
    server.once('error', (err: NodeJS.ErrnoException) =>
      refuse(
        err.code === 'EADDRINUSE'
          ? new Error(`port ${opts.port} is taken — another beacon reader is running (lsof -nP -iTCP:${opts.port} -sTCP:LISTEN)`)
          : err,
      ),
    );
    server.listen(opts.port, '127.0.0.1', () => ready(api));
  });
}
```

**Contracts implemented:** `endpoints.beacon`, `endpoints.fixtures`, `contracts.beacon_query`, `contracts.trace_event`, `decisions.host_served_fixtures`.

**Phase 8 verification:** `⟨commands.tests⟩` → exit 0 with `02e-tests-and-e2e.md` §B.1 `collector.test.ts` added; then `02e-tests-and-e2e.md` §C.2.

---

### Phase 9 — `C2` `e2e/device.ts`

**File:** `e2e/device.ts` `(new)`
**Anchor:** new file, full content below.

**What changes:** the Vega CLI behind one module. The component id is read from `_profile.yml`, never typed here.

**Code:**

```ts
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';

const PROFILE = readFileSync('docs/features/_profile.yml', 'utf8');
/** `_profile.yml component_id` — the id every device command takes */
export const COMPONENT = /^component_id:\s*(\S+)/m.exec(PROFILE)![1]!;

const BUILT = 'build/aarch64-release/interstice_aarch64.vpkg';
export const PKG = {
  release: 'e2e/out/pkg/release.vpkg',
  variant: 'e2e/out/pkg/variant.vpkg',
} as const;

const vega = (...args: string[]): string =>
  execFileSync('vega', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const npm = (...args: string[]): void => {
  execFileSync('npm', args, { stdio: 'inherit' });
};

export function virtualDeviceRunning(): boolean {
  return /"running":\s*true/.test(vega('virtual-device', 'status'));
}

/** device -> host, so the app's `localhost:<port>` is this machine */
export function reverseForward(port: number): void {
  vega('device', 'start-port-forwarding', '--port', String(port), '--forward', 'false');
}

/**
 * Build what the suite needs and keep a copy of each package under e2e/out/pkg.
 * VARIANT is built FIRST and Release LAST, so `build/` always ends up holding
 * the Release package — the one a later manual install would pick up.
 */
export function buildPackages(suite: 'release' | 'variant'): void {
  mkdirSync('e2e/out/pkg', { recursive: true });
  if (suite === 'variant') {
    npm('run', 'build:e2e');
    copyFileSync(BUILT, PKG.variant);
  }
  npm('run', 'build');
  copyFileSync(BUILT, PKG.release);
}

export const install = (pkg: string): void => void vega('device', 'install-app', '--packagePath', pkg);
export const launch = (): void => void vega('device', 'launch-app', '--appName', COMPONENT);
/** `_profile.yml commands.force_stop`. Not running is not an error. */
export function terminate(): void {
  try {
    vega('device', 'terminate-app', '--appName', COMPONENT);
  } catch {
    /* already stopped */
  }
}

/** on-device shell command — `vega device run-cmd` */
export const runCmd = (command: string): string => vega('device', 'run-cmd', '--command', command);

/** for `contracts.run_record.conditions` */
export function describeDevice(): string {
  try {
    const info = JSON.parse(vega('device', 'info')) as Record<string, unknown>;
    return `${info.simulated ? 'Vega Virtual Device' : 'Fire TV'}, ${String(info.architecture)}, ${String(info.buildDescription)}`;
  } catch {
    return 'unknown — `vega device info` did not return JSON';
  }
}
export const sdkVersion = (): string =>
  /Active SDK Version:\s*(\S+)/.exec(vega('--version'))?.[1] ?? 'unknown';
```

**Contracts implemented:** `contracts.run_record` (`conditions`), `decisions.two_suites` (the two packages), `AC15` (the Release package is kept to reinstall).

**Phase 9 verification:** `02e-tests-and-e2e.md` §C.2.

---

### Phase 10 — `C3` `e2e/input.ts`

**File:** `e2e/input.ts` `(new)`
**Anchor:** new file, full content below.

**What changes:** remote keys by name. The route is whichever `02` Phase 0.1 measured.

**Code:**

```ts
import { runCmd } from './device.js';

export type Key = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'ENTER' | 'BACK';

/** contracts.run_record.input_route — set from `02` Phase 0.1 */
export const INPUT_ROUTE: 'inputd-cli' | 'grpc' = 'inputd-cli';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One press. `inputd-cli button_press KEY_ENTER` is the form the app set
 * measured on 2026-09-25; KEY_BACK is confirmed in `02` Phase 0.1 step 3.
 *
 * [AFTER PHASE 0] If INPUT_ROUTE is 'grpc' (defects D2 dead, D1 fixed), replace
 * the body with the key call of whatever client `e2e/capture.ts` ended up
 * using. The signature does not change.
 */
export async function press(key: Key): Promise<void> {
  runCmd(`inputd-cli button_press KEY_${key}`);
  await sleep(300); // limits.timing.key_gap_ms
}

export async function pressAll(keys: Key[]): Promise<void> {
  for (const key of keys) await press(key);
}
```

There is no `hold`. The one scenario that needs it, `S17`, is blocked by `D6`, and a held key is added with the seek control it would exercise — not before.

**Contracts implemented:** `limits.input`, `limits.timing` `key_gap_ms` (300).

**Phase 10 verification:** `02e-tests-and-e2e.md` §C.2.

---

## Continues in `02b2-scenarios.md`

Phase 11: capture (`C4`). Phase 12: the scenarios (`C7`). Then `02b3-runner.md`, Phase 13: the runner (`C1`).
