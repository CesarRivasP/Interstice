# Implementation (3 of 5) — E2E harness — capture, and the scenarios

> Complements `01-master-plan.md`. Phases 11–12. Continues from `02b-harness.md` and continues in `02b3-runner.md`.

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

Split out of the host-side half on a phase boundary, because the scenarios are data and are the part that changes when the app does.

---

## Part A — Implementation plan (continued)

### Phase 11 — `C4` `e2e/capture.ts`

**File:** `e2e/capture.ts` `(new)`
**Anchor:** new file, full content below.

**What changes:** the seam of `decisions.capture_ladder`. The null rung is complete and is what the harness runs on until Phase 0 says otherwise.

**Code:**

```ts
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, rmSync, statSync } from 'node:fs';

/** contracts.run_record.capture_rung */
export type Rung = 'grpc' | 'appium' | 'none';

export interface Capture {
  rung: Rung;
  /** once per run, before the first capture */
  prepare(): void;
  /** true when a non-empty file was written. Never throws: a missing picture is not a failed scenario. */
  screenshot(path: string): Promise<boolean>;
  /** records for a fixed time from now */
  startClip(path: string, seconds: number): Promise<void>;
  /** waits for the recording to end; true when a non-empty clip was written */
  stopClip(): Promise<boolean>;
}

const written = (path: string) => existsSync(path) && statSync(path).size > 0;

/** rung 3 — always available, and enough for a verdict */
const none: Capture = {
  rung: 'none',
  prepare: () => {},
  screenshot: async () => false,
  startClip: async () => {},
  stopClip: async () => false,
};

/**
 * rung 1 — the emulator gRPC interface, through the wrapper of R-VVD-DRIVER
 * (MIT, pinned at a9ea5d5; measured on 2026-10-04, defects D1 and D3).
 * `bin` is its dist/bin.js. The wrapper is run with this Node, never installed.
 */
function grpc(bin: string): Capture {
  const vvd = (args: string[], timeout: number) =>
    execFileSync(process.execPath, [bin, ...args], { stdio: 'ignore', timeout });
  let recording: { child: ChildProcess; path: string; done: Promise<void> } | null = null;

  return {
    rung: 'grpc',
    prepare() {
      // off after every start of the device; safe to repeat
      vvd(['enable-grpc'], 15_000);
    },
    async screenshot(path) {
      // limits.capture.frame_size: a film frame is 1.36 MB as PNG and 76 KB as
      // a 1280-wide JPEG, and the published bound is 300 KB.
      const png = `${path}.png`;
      try {
        vvd(['screenshot', png], 10_000);
        execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', png, '-vf', 'scale=1280:-1', '-q:v', '4', path]);
        return written(path);
      } catch {
        return false;
      } finally {
        rmSync(png, { force: true });
      }
    },
    async startClip(path, seconds) {
      const child = spawn(process.execPath, [bin, 'record', path, '--seconds', String(seconds)], { stdio: 'ignore' });
      const done = new Promise<void>((resolve) => child.once('exit', () => resolve()));
      recording = { child, path, done };
    },
    async stopClip() {
      if (!recording) return false;
      const { path, done } = recording;
      recording = null;
      await done;
      return written(path);
    },
  };
}

/** E2E_CAPTURE = none | grpc:<path to the wrapper's dist/bin.js>. Unset means none. */
export function createCapture(env = process.env.E2E_CAPTURE ?? 'none'): Capture {
  if (env.startsWith('grpc:')) return grpc(env.slice('grpc:'.length));
  return none;
}
```

**Measured in `02` Phase 0.2:** the rung is `grpc`; a film frame is 1.36 MB as PNG and 76 KB as a 1280-wide JPEG (`limits.capture` `frame_size`). When building this phase, `screenshot` therefore writes the PNG to a temp path and converts it with `ffmpeg -vf scale=1280:-1 -q:v 4` to the `.jpg` path it was given; the scenario paths in `02b3` Phase 13 end in `.jpg`. The clip is `vvd record <file> --seconds <n>`, which records for a fixed time: `startClip` spawns it and `stopClip` waits for it to exit.

The `appium` rung is not written. It is built only if `02` Phase 0.2 ends on it, and then against the same interface.

**Contracts implemented:** `decisions.capture_ladder`, `decisions.trace_is_the_oracle` (a capture cannot fail a scenario), `env_vars` (`E2E_CAPTURE`).

**Phase 11 verification:** `02e-tests-and-e2e.md` §C.4.

---

### Phase 12 — `C7` `e2e/scenarios`

**Files:** `e2e/scenarios/types.ts`, `e2e/scenarios/release.ts`, `e2e/scenarios/variant.ts`, `e2e/scenarios/index.ts` — all `(new)`.

**What changes:** the scenarios of `limits.suite`, as data. A scenario carries the **ids** of the app criteria it covers and never their text (`decisions.ac_text_read_not_copied`).

**Code** — `e2e/scenarios/types.ts`:

```ts
import type { Fault } from '../collector.js';
import type { Key } from '../input.js';
import type { Assertion, Match } from '../trace.js';

export type Step =
  | { do: 'keys'; keys: Key[] }
  | { do: 'wait'; for: Match; timeout_ms?: number }
  | { do: 'shot'; caption: string }
  /** record for a fixed time from here; the wrapper cannot be stopped early */
  | { do: 'clip_start'; seconds: number }
  | { do: 'clip_stop'; caption: string }
  /** answer the requests a `hold` fault is sitting on */
  | { do: 'release' };

export interface Scenario {
  id: string;
  name: string;
  suite: 'release' | 'variant';
  use_case: string;
  /** ids in docs/features/interstice/_facts.yml acceptance[] */
  covers: string[];
  fixture: boolean;
  /** a registry id or a missing capability. A blocked scenario has no steps. */
  blocked_by?: string;
  faults?: Fault[];
  steps: Step[];
  assertions: Assertion[];
  /** cue windows on the playhead, for the timeline strip */
  windows_ms?: [number, number][];
  /** rendered beside the verdict: the limit of what a pass means */
  cannot_show?: string;
}
```

**Code** — `e2e/scenarios/release.ts`:

```ts
import type { Scenario } from './types.js';

const progress = { name: 'player.progress' };
const play = { name: 'app.play', where: { id: 'tears-of-steel' } };

export const RELEASE: Scenario[] = [
  {
    id: 'S01', name: 'launch-and-list', suite: 'release', fixture: false,
    use_case: 'The viewer opens the app and lands on the title list with a title focused.',
    covers: ['AC1', 'AC2'],
    steps: [
      { do: 'wait', for: { name: 'asset.segments' } },
      { do: 'shot', caption: 'The title list on launch' },
      { do: 'keys', keys: ['ENTER'] },
      { do: 'wait', for: play },
    ],
    assertions: [
      { kind: 'seen', expect: { name: 'app.mode', where: { e2e: 'false' } } },
      { kind: 'seen', expect: { name: 'asset.segments', where: { n: (v) => Number(v) > 0, init: 'set' } } },
      // ENTER with nothing else pressed reached the title: it had focus on entry.
      { kind: 'seen', expect: play },
    ],
  },
  {
    id: 'S02', name: 'play-to-end', suite: 'release', fixture: false,
    use_case: 'The viewer plays the demo clip from start to finish.',
    covers: ['AC1'],
    steps: [
      { do: 'wait', for: { name: 'asset.segments' } },
      { do: 'keys', keys: ['ENTER'] },
      { do: 'wait', for: { name: 'player.play' } },
      { do: 'shot', caption: 'The film playing' },
      { do: 'wait', for: { name: 'player.progress', where: { pos_ms: (v) => Number(v) >= 19_000 } }, timeout_ms: 40_000 },
      { do: 'wait', for: { name: 'buffer.evicted' }, timeout_ms: 10_000 },
    ],
    assertions: [
      { kind: 'order', expect: [{ name: 'buffer.complete' }, { name: 'player.opened' }, { name: 'player.play' }, progress] },
      { kind: 'count', expect: { name: 'buffer.appended', where: { _: /^seg/ } }, exactly: 4 },
      { kind: 'seen', expect: { name: 'player.progress', where: { pos_ms: (v) => Number(v) >= 19_000 } } },
      // Exactly one. Two is the loop of 2026-09-27, where evicting after
      // endOfStream reopened the source and re-appended the asset.
      { kind: 'count', expect: { name: 'buffer.evicted' }, exactly: 1 },
    ],
    cannot_show: 'The full film: this is the 20 s clip.',
  },
  {
    id: 'S03', name: 'probe-cue-ducks', suite: 'release', fixture: false,
    use_case: 'A description cue speaks over the film and the film comes back to full.',
    covers: ['AC5'],
    steps: [
      { do: 'wait', for: { name: 'asset.segments' } },
      { do: 'keys', keys: ['ENTER'] },
      { do: 'clip_start', seconds: 12 },
      { do: 'wait', for: { name: 'audio.duck' } },
      { do: 'shot', caption: 'During the cue' },
      { do: 'wait', for: { name: 'audio.restored', where: { id: 'probe' } }, timeout_ms: 20_000 },
      { do: 'clip_stop', caption: 'The cue, with the film ducked under it' },
    ],
    assertions: [
      { kind: 'order', expect: [
        { name: 'cue.fire' },
        { name: 'audio.duck', where: { id: 'probe', to_pct: '25' } },
        progress, // the film kept decoding under the cue
        { name: 'cue.audio', where: { state: 'ended' } },
        { name: 'audio.restored', where: { id: 'probe' } },
      ] },
    ],
    cannot_show: 'That a listener heard the film get quieter. The volume property was set to 25% and restored; audible ducking closes on hardware.',
  },
  {
    id: 'S04', name: 'back-returns-to-list', suite: 'release', fixture: false,
    use_case: 'The viewer presses BACK during playback and is on the list again, able to start over.',
    covers: ['AC2'],
    steps: [
      { do: 'wait', for: { name: 'asset.segments' } },
      { do: 'keys', keys: ['ENTER'] },
      { do: 'wait', for: progress },
      { do: 'keys', keys: ['BACK'] },
      { do: 'wait', for: { name: 'player.back' } },
      { do: 'shot', caption: 'Back on the list' },
      { do: 'keys', keys: ['ENTER'] },
      { do: 'wait', for: { name: 'player.opened' }, timeout_ms: 20_000 },
    ],
    assertions: [
      { kind: 'seen', expect: { name: 'player.back', where: { from: 'playing' } } },
      // Focus on return: a second ENTER, nothing else pressed, starts the title again.
      { kind: 'count', expect: play, exactly: 2 },
      { kind: 'count', expect: { name: 'player.opened' }, exactly: 2 },
    ],
  },
  {
    id: 'S05', name: 'no-track-is-stated', suite: 'release', fixture: false,
    use_case: 'The title has no description track; the app says so and the film plays anyway.',
    covers: ['AC8'],
    steps: [
      { do: 'wait', for: { name: 'asset.segments' } },
      { do: 'keys', keys: ['ENTER'] },
      { do: 'wait', for: { name: 'controls.announce' } },
      { do: 'wait', for: progress, timeout_ms: 20_000 },
      { do: 'shot', caption: 'The missing-track state, on screen' },
      { do: 'wait', for: { name: 'player.progress', where: { pos_ms: (v) => Number(v) >= 5_000 } }, timeout_ms: 20_000 },
    ],
    assertions: [
      { kind: 'seen', expect: { name: 'controls.announce', where: { kind: 'missing' } } },
      // the film is still moving AFTER the loader gave up
      { kind: 'order', expect: [{ name: 'loader.miss' }, progress, progress] },
      // Not "no stall at all": MSE emits `waiting` at the start of every normal
      // playback on this device. No stall once the film is moving.
      { kind: 'absent', expect: { name: 'player.stalled' },
        after: progress,
        before: { name: 'player.progress', where: { pos_ms: (v) => Number(v) >= 5_000 } },
        emitter: 'src/screens/PlayerScreen.tsx onStalled -> player.stalled' },
    ],
  },
];
```

The announce is asserted as `seen`, not ordered after `loader.miss`, and the reason is a finding about the app rather than a convenience: `PlayerScreen` starts in `{kind: 'missing', detail: 'not loaded yet'}`, so `ADControls` speaks *"No description track was found for this title"* at mount, **before the loader has looked** — and on a title that has a track it will say that and then say the opposite. Reported to the app set with this round; `S10` will show it on the fixture the first time it runs.

`S05` passes today **because** the Release package has no track (`docs/features/interstice/_facts.yml` defects.D4). The day a real track is packaged, `S05` goes red: that is correct, and it moves to the VARIANT suite with a `missing` fault on the track file.

**Code** — `e2e/scenarios/variant.ts`:

```ts
import { readFileSync } from 'node:fs';
import type { Scenario, Step } from './types.js';

// limits.fixture — the values are the registry's, the fixture builder writes
// the same ones into the track (02c Phase 15).
export const FIXTURE_ID = 'e2e-fixture';
export const WINDOWS: [number, number][] = [[4000, 9000], [14000, 20000], [24000, 28000]];
const TOLERANCE = 300; // limits.timing.window_tolerance_ms
const STALL_WAIT = 60_000; // limits.timing.stall_wait_ms

const progress = { name: 'player.progress' };
const select: Step[] = [
  { do: 'wait', for: { name: 'asset.segments' } },
  // second title in the list
  { do: 'keys', keys: ['DOWN', 'ENTER'] },
  { do: 'wait', for: { name: 'app.play', where: { id: FIXTURE_ID } } },
];
const duck = (id: string) => ({ name: 'audio.duck', where: { id } });
const restored = (id: string) => ({ name: 'audio.restored', where: { id } });
const past = (ms: number) => ({ name: 'player.progress', where: { pos_ms: (v: string) => Number(v) >= ms } });

/** the first segment starting at or after limits.fixture.withheld_segment_from_ms */
function withheldSegment(): RegExp {
  const layout = JSON.parse(readFileSync('e2e/out/fixtures/asset.json', 'utf8')) as {
    segments: { start_ms: number; uri: string }[];
  };
  const seg = layout.segments.find((s) => s.start_ms >= 31_000);
  if (!seg) throw new Error('fixture asset has no segment starting after 31 s — run e2e:fixtures');
  return new RegExp(`^${seg.uri.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
}

export const VARIANT: Scenario[] = [
  {
    id: 'S10', name: 'cues-stay-in-window', suite: 'variant', fixture: true,
    use_case: 'Three cues each start and finish inside their window.',
    covers: ['AC4'], windows_ms: WINDOWS,
    steps: [
      ...select,
      { do: 'wait', for: restored('c1'), timeout_ms: 25_000 },
      { do: 'shot', caption: 'After the first cue' },
      { do: 'wait', for: restored('c3'), timeout_ms: 40_000 },
    ],
    assertions: WINDOWS.map((window_ms, i) => ({
      kind: 'in_window' as const, start: duck(`c${i + 1}`), end: restored(`c${i + 1}`), window_ms, tolerance_ms: TOLERANCE,
    })),
    cannot_show: 'That a cue avoids dialogue. These windows are declared by the fixture, not derived from subtitles.',
  },
  {
    id: 'S11', name: 'toggle-off-and-on', suite: 'variant', fixture: true,
    use_case: 'The viewer switches description off mid-film and back on; the film never stops.',
    covers: ['AC3'], windows_ms: WINDOWS,
    steps: [
      ...select,
      { do: 'wait', for: restored('c1'), timeout_ms: 25_000 },
      { do: 'keys', keys: ['ENTER'] }, // the switch holds focus on entry
      { do: 'wait', for: { name: 'controls.toggle', where: { to: 'false' } } },
      { do: 'shot', caption: 'Description off' },
      { do: 'wait', for: past(21_000), timeout_ms: 30_000 }, // the second window has closed
      { do: 'keys', keys: ['ENTER'] },
      { do: 'wait', for: { name: 'controls.toggle', where: { to: 'true' } } },
      { do: 'wait', for: restored('c3'), timeout_ms: 20_000 },
    ],
    assertions: [
      { kind: 'absent', expect: duck('c2'),
        after: { name: 'controls.toggle', where: { to: 'false' } },
        before: { name: 'controls.toggle', where: { to: 'true' } },
        emitter: 'the package DescriptionAudio.speak -> audio.duck' },
      { kind: 'absent', expect: { name: 'player.stalled' },
        after: { name: 'controls.toggle', where: { to: 'false' } },
        before: restored('c3'),
        emitter: 'src/screens/PlayerScreen.tsx onStalled -> player.stalled' },
      { kind: 'order', expect: [{ name: 'controls.toggle', where: { to: 'false' } }, progress, { name: 'controls.toggle', where: { to: 'true' } }, duck('c3')] },
      // the missed cue is not replayed late
      { kind: 'count', expect: duck('c2'), exactly: 0 },
    ],
  },
  {
    id: 'S12', name: 'verbosity-switch', suite: 'variant', fixture: true,
    use_case: 'The viewer moves between concise, standard and detailed while watching.',
    covers: ['AC17'],
    faults: [{ path: /e2e-fixture\.detailed\.track\.json$/, kind: 'missing' }],
    steps: [
      ...select,
      { do: 'wait', for: { name: 'loader.load', where: { ok: 'true', cues: '3' } } },
      { do: 'wait', for: progress }, // past the stall every playback starts with
      { do: 'keys', keys: ['DOWN', 'ENTER'] }, // switch -> concise
      { do: 'wait', for: { name: 'loader.load', where: { path: /concise/, ok: 'true' } } },
      { do: 'shot', caption: 'Concise selected' },
      { do: 'keys', keys: ['DOWN', 'DOWN', 'ENTER'] }, // concise -> standard -> detailed
      { do: 'wait', for: { name: 'loader.miss', where: { path: /detailed/ } } },
      { do: 'wait', for: past(12_000), timeout_ms: 30_000 },
    ],
    assertions: [
      { kind: 'order', expect: [
        { name: 'loader.load', where: { path: /standard/, ok: 'true', cues: '3' } },
        { name: 'controls.verbosity', where: { to: 'concise' } },
        { name: 'loader.load', where: { path: /concise/, ok: 'true', cues: '2' } },
        { name: 'controls.verbosity', where: { to: 'detailed' } },
        { name: 'loader.miss', where: { path: /detailed/ } },
        { name: 'loader.load', where: { path: /standard/, ok: 'true', cues: '3' } },
        progress,
      ] },
      { kind: 'absent', expect: { name: 'player.stalled' },
        after: { name: 'controls.verbosity', where: { to: 'concise' } },
        before: past(12_000),
        emitter: 'src/screens/PlayerScreen.tsx onStalled -> player.stalled' },
    ],
  },
  {
    id: 'S13', name: 'malformed-track-is-stated', suite: 'variant', fixture: true,
    use_case: 'The track file is corrupt; the app says something different from "missing" and the film plays.',
    covers: ['AC8'],
    faults: [{ path: /e2e-fixture\.standard\.track\.json$/, kind: 'truncate' }],
    steps: [
      ...select,
      { do: 'wait', for: { name: 'ad.state' , where: { kind: /missing|malformed/ } } },
      { do: 'shot', caption: 'The unreadable-track state, on screen' },
      { do: 'wait', for: past(5_000), timeout_ms: 20_000 },
    ],
    assertions: [
      { kind: 'seen', expect: { name: 'ad.state', where: { kind: 'malformed' } } },
      { kind: 'count', expect: { name: 'ad.state', where: { kind: 'missing' } }, exactly: 1 }, // the initial "not loaded yet", and no other
      { kind: 'order', expect: [{ name: 'controls.announce', where: { kind: 'malformed' } }, progress, progress] },
    ],
  },
  {
    id: 'S14', name: 'failed-cue-restores-volume', suite: 'variant', fixture: true,
    use_case: 'One cue has no audio; the film must not be left quiet.',
    covers: ['AC5'], windows_ms: WINDOWS,
    faults: [{ path: /cues\/c2\.m4a$/, kind: 'drop' }],
    steps: [
      ...select,
      { do: 'wait', for: { name: 'audio.failed', where: { id: 'c2' } }, timeout_ms: 35_000 },
      { do: 'wait', for: restored('c3'), timeout_ms: 25_000 },
    ],
    assertions: [
      { kind: 'order', expect: [duck('c2'), { name: 'audio.failed', where: { id: 'c2' } }, restored('c2'), progress] },
      // and the cue after it is unaffected
      { kind: 'order', expect: [restored('c2'), duck('c3'), restored('c3')] },
    ],
    cannot_show: 'The audible level. The restore is the volume property returning to 100%.',
  },
  {
    id: 'S15', name: 'stall-and-recover', suite: 'variant', fixture: true,
    use_case: 'The bytes run short mid-film; the viewer is told, and playback resumes when they arrive.',
    covers: ['AC24'],
    get faults() { return [{ path: withheldSegment(), kind: 'hold' as const }]; },
    steps: [
      ...select,
      { do: 'wait', for: past(30_000), timeout_ms: 45_000 },
      { do: 'wait', for: { name: 'overlay.shown', where: { status: 'stalled' } }, timeout_ms: STALL_WAIT },
      { do: 'shot', caption: 'Stalled: the picture is frozen and the app says so' },
      { do: 'release' },
      { do: 'wait', for: { name: 'player.resumed', where: { from: 'stalled' } }, timeout_ms: 20_000 },
      { do: 'wait', for: progress },
    ],
    assertions: [
      { kind: 'order', expect: [
        past(30_000),
        { name: 'player.stalled' },
        { name: 'overlay.shown', where: { status: 'stalled' } },
        { name: 'player.resumed', where: { from: 'stalled' } },
        { name: 'overlay.cleared' },
        progress,
      ] },
    ],
  },
  {
    id: 'S16', name: 'error-state-has-a-way-out', suite: 'variant', fixture: true,
    use_case: 'The title cannot be opened; the viewer is told and BACK still works.',
    covers: ['AC2'],
    // A dropped connection, not a 404: the package never checks response.ok.
    faults: [{ path: /init\.mp4$/, kind: 'drop' }],
    steps: [
      ...select,
      { do: 'wait', for: { name: 'overlay.shown', where: { status: 'error' } }, timeout_ms: 20_000 },
      { do: 'shot', caption: 'The error state' },
      { do: 'keys', keys: ['BACK'] },
      { do: 'wait', for: { name: 'player.back' } },
      { do: 'keys', keys: ['ENTER'] }, // focus returned to the list: first title
      { do: 'wait', for: { name: 'app.play', where: { id: 'tears-of-steel' } } },
    ],
    assertions: [
      { kind: 'order', expect: [
        { name: 'overlay.shown', where: { status: 'error' } },
        { name: 'player.back', where: { from: 'error' } },
        { name: 'app.play', where: { id: 'tears-of-steel' } },
      ] },
    ],
  },
  {
    id: 'S17', name: 'held-seek-coalesces', suite: 'variant', fixture: true,
    use_case: 'The viewer holds a direction to seek; the scheduler resyncs once.',
    covers: ['AC6'],
    blocked_by: 'D6 — the app has no seek control',
    steps: [], assertions: [],
  },
];
```

`S18` is not written: it is `deferred` in `limits.suite`.

**Two key paths above are read from the code and not yet from a device**, and the first VARIANT run settles them: DOWN from the first title reaches the fixture title; inside the player, the switch has focus on entry and DOWN walks concise → standard → detailed (the package's `ADControls` renders them in that order, the switch with `hasTVPreferredFocus`). If a `wait` for `controls.toggle` or `controls.verbosity` times out, the focus is elsewhere — which is a finding against `docs/features/interstice/_facts.yml` acceptance.AC2, not a harness bug to route around.

**Code** — `e2e/scenarios/index.ts`:

```ts
import { RELEASE } from './release.js';
import { VARIANT } from './variant.js';
import type { Scenario } from './types.js';

export const SUITES: Record<'release' | 'variant', Scenario[]> = { release: RELEASE, variant: VARIANT };
export type { Scenario, Step } from './types.js';
```

**Contracts implemented:** `limits.suite`, `limits.fixture`, `limits.timing` (`window_tolerance_ms`, `stall_wait_ms`), `decisions.ac_text_read_not_copied`, `decisions.fixture_track`.

**Phase 12 verification:** `⟨commands.tests⟩` → exit 0 with `02e-tests-and-e2e.md` §B.1 `scenarios.test.ts` added (it binds this file to `limits.suite`).


---

## Continues in `02b3-runner.md`

Phase 13: the runner (`C1`).
