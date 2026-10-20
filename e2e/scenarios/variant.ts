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
      // None at all — not even the initial one. Until R47-W1 the screen started
      // in `missing` and announced it before the loader had looked (R45-F2);
      // now nothing is said about the description until the loader answers.
      { kind: 'count', expect: { name: 'ad.state', where: { kind: 'missing' } }, exactly: 0 },
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
  {
    // R11: moved here from the Release suite, where it was S05. Since app R57
    // every title the Release build lists has a packaged track, so the missing
    // state is reached by withholding the FIXTURE's track instead.
    id: 'S19', name: 'no-track-is-stated', suite: 'variant', fixture: true,
    use_case: 'The title has no description track; the app says so and the film plays anyway.',
    covers: ['AC8'],
    faults: [{ path: /e2e-fixture\.standard\.track\.json$/, kind: 'missing' }],
    steps: [
      ...select,
      { do: 'wait', for: { name: 'controls.announce' } },
      { do: 'wait', for: progress, timeout_ms: 20_000 },
      { do: 'shot', caption: 'The missing-track state, on screen' },
      { do: 'wait', for: past(5_000), timeout_ms: 20_000 },
    ],
    assertions: [
      { kind: 'seen', expect: { name: 'controls.announce', where: { kind: 'missing' } } },
      // announced AFTER the loader looked, never before (R45-F2, R47-W1)
      { kind: 'order', expect: [{ name: 'loader.miss' }, { name: 'controls.announce', where: { kind: 'missing' } }] },
      // the film is still moving AFTER the loader gave up
      { kind: 'order', expect: [{ name: 'loader.miss' }, progress, progress] },
      { kind: 'absent', expect: { name: 'player.stalled' },
        after: progress,
        before: past(5_000),
        emitter: 'src/screens/PlayerScreen.tsx onStalled -> player.stalled' },
    ],
  },
];
