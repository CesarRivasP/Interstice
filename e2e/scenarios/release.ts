import type { Scenario } from './types.js';

const progress = { name: 'player.progress' };
const play = { name: 'app.play', where: { id: 'tears-of-steel' } };
// the first cue of the packaged standard track — its gap opens the film
const FIRST_CUE = 'cue_0-11500';

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
  // S02 (play-to-end), S03 (probe-cue-ducks) and S05 (no-track-is-stated) are
  // RETIRED in e2e-harness R11: they were written for the 20-second excerpt and
  // its probe cue, and since app R57 the package carries the film and its
  // generated track instead. Their ids are not reused. S06 and S07 replace the
  // first two; S19 (variant) carries the missing-track state, which no title in
  // the Release build can reach any more.
  {
    id: 'S06', name: 'film-plays-and-windows', suite: 'release', fixture: false,
    use_case: 'The viewer plays the film; the buffer runs ahead of the picture and lets go behind it.',
    covers: ['AC1'],
    steps: [
      { do: 'wait', for: { name: 'asset.segments' } },
      { do: 'keys', keys: ['ENTER'] },
      { do: 'wait', for: { name: 'player.play' } },
      { do: 'shot', caption: 'The film playing' },
      { do: 'wait', for: { name: 'player.progress', where: { pos_ms: (v) => Number(v) >= 45_000 } }, timeout_ms: 75_000 },
      { do: 'wait', for: { name: 'buffer.evicted' }, timeout_ms: 15_000 },
    ],
    assertions: [
      { kind: 'seen', expect: { name: 'asset.segments', where: { n: (v) => Number(v) > 100 } } },
      { kind: 'order', expect: [{ name: 'player.opened' }, { name: 'player.play' }, progress] },
      { kind: 'seen', expect: { name: 'player.progress', where: { pos_ms: (v) => Number(v) >= 45_000 } } },
      // limits.mse_buffer: 30 s ahead + 10 s behind is at most nine 6 s segments
      { kind: 'seen', expect: { name: 'buffer.evicted', where: { held: (v) => Number(v) <= 9 } } },
      { kind: 'count', expect: { name: 'buffer.evicted', where: { held: (v) => Number(v) > 9 } }, exactly: 0 },
      // the film never reached its end, so the source was never closed
      { kind: 'count', expect: { name: 'buffer.complete' }, exactly: 0 },
      { kind: 'count', expect: { name: 'buffer.failed' }, exactly: 0 },
    ],
    cannot_show: 'The whole film, and memory: this run watches 45 s of 12 min on the Virtual Device. AC23 names the worst device in the matrix and an end-to-end watch.',
  },
  {
    id: 'S07', name: 'generated-cue-ducks', suite: 'release', fixture: false,
    use_case: 'The film\'s first generated cue speaks inside its gap, over the film, and the film comes back to full.',
    covers: ['AC4', 'AC5'], windows_ms: [[0, 11_500]],
    steps: [
      { do: 'wait', for: { name: 'asset.segments' } },
      { do: 'keys', keys: ['ENTER'] },
      { do: 'clip_start', seconds: 14 },
      { do: 'wait', for: { name: 'audio.duck', where: { id: FIRST_CUE } }, timeout_ms: 20_000 },
      { do: 'shot', caption: 'During the first generated cue' },
      { do: 'wait', for: { name: 'audio.restored', where: { id: FIRST_CUE } }, timeout_ms: 20_000 },
      { do: 'clip_stop', caption: 'The first generated cue, with the film ducked under it' },
    ],
    assertions: [
      // the packaged track, not a fixture: every standard cue loaded
      { kind: 'seen', expect: { name: 'loader.load', where: { ok: 'true', cues: '56' } } },
      { kind: 'order', expect: [
        { name: 'loader.load', where: { ok: 'true' } },
        { name: 'controls.announce', where: { kind: 'ready' } },
      ] },
      { kind: 'order', expect: [
        { name: 'scheduler.fire', where: { id: FIRST_CUE } },
        { name: 'audio.duck', where: { id: FIRST_CUE, to_pct: '25' } },
        progress, // the film kept decoding under the cue
        { name: 'cue.audio', where: { state: 'ended' } },
        { name: 'audio.restored', where: { id: FIRST_CUE } },
      ] },
      { kind: 'in_window', start: { name: 'audio.duck', where: { id: FIRST_CUE } }, end: { name: 'audio.restored', where: { id: FIRST_CUE } },
        window_ms: [0, 11_500], tolerance_ms: 300 },
    ],
    cannot_show: 'That a listener heard the film get quieter (closes on hardware), and that the cue avoids dialogue beyond this first gap.',
  },

];
