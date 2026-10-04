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
