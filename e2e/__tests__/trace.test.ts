import { beforeEach, describe, expect, it } from 'vitest';
import { evaluate, integrity, ordered, parseLine, positionAt, type TraceEvent } from '../trace.js';

let seq = 0;
/** one event, `t` in device ms */
const ev = (line: string, t: number, boot = 'b1'): TraceEvent => ({
  boot, seq: seq++, t_dev_ms: t, t_host: new Date(t).toISOString(), line, ...parseLine(line),
});
beforeEach(() => {
  seq = 0;
});

describe('parseLine', () => {
  it('splits name and fields', () => {
    expect(parseLine('INTERSTICE.audio.duck id=c1 to_pct=25')).toEqual({ name: 'audio.duck', fields: { id: 'c1', to_pct: '25' } });
  });

  it('keeps a sentence as one field', () => {
    const p = parseLine('INTERSTICE.overlay.shown status=stalled spoken=The video paused while it loads more.');
    expect(p.fields).toEqual({ status: 'stalled', spoken: 'The video paused while it loads more.' });
  });

  it('puts tokens before the first field in _', () => {
    expect(parseLine('INTERSTICE.buffer.appended seg0 bytes=10 held=1').fields._).toBe('seg0');
  });

  // Fails if: a key may not hold a digit. Found on the first device run:
  // `e2e=false` was read as a continuation, and S01 failed on a correct app.
  it('accepts a digit inside a key', () => {
    expect(parseLine('INTERSTICE.app.mode e2e=false host=none').fields).toEqual({ e2e: 'false', host: 'none' });
  });
});

describe('order', () => {
  // Fails if: first() restarts from 0 for each element. Any trace holding both
  // lines then passes in either order — S03 would pass on a film restored
  // before it was ducked.
  it('requires later events', () => {
    const events = [ev('INTERSTICE.b', 1), ev('INTERSTICE.a', 2)];
    expect(evaluate({ kind: 'order', expect: [{ name: 'a' }, { name: 'b' }] }, events).ok).toBe(false);
    expect(evaluate({ kind: 'order', expect: [{ name: 'b' }, { name: 'a' }] }, events).ok).toBe(true);
  });

  it('needs two distinct events for the same match twice', () => {
    const one = [ev('INTERSTICE.player.progress pos_ms=1', 1)];
    expect(evaluate({ kind: 'order', expect: [{ name: 'player.progress' }, { name: 'player.progress' }] }, one).ok).toBe(false);
  });
});

describe('absent', () => {
  const a = { kind: 'absent' as const, expect: { name: 'x' }, after: { name: 'from' }, before: { name: 'to' }, emitter: 'test' };

  // Fails if: an unbounded absence may pass. An app that died after `from`
  // emits no `x` and no `to`; passing that is passing a dead app.
  it('is false when its bounds are not both seen', () => {
    expect(evaluate(a, [ev('INTERSTICE.from', 1)]).ok).toBe(false);
    expect(evaluate(a, []).ok).toBe(false);
  });

  it('is false when the line sits between the bounds, true when it sits after', () => {
    expect(evaluate(a, [ev('INTERSTICE.from', 1), ev('INTERSTICE.x', 2), ev('INTERSTICE.to', 3)]).ok).toBe(false);
    expect(evaluate(a, [ev('INTERSTICE.from', 1), ev('INTERSTICE.to', 2), ev('INTERSTICE.x', 3)]).ok).toBe(true);
  });
});

describe('count', () => {
  // Fails if: count compares with >=. S02's single-eviction check is then
  // satisfied by the loop it exists to catch.
  it('is exact', () => {
    const two = [ev('INTERSTICE.buffer.evicted n=1', 1), ev('INTERSTICE.buffer.evicted n=1', 2)];
    expect(evaluate({ kind: 'count', expect: { name: 'buffer.evicted' }, exactly: 1 }, two).ok).toBe(false);
    expect(evaluate({ kind: 'count', expect: { name: 'buffer.evicted' }, exactly: 2 }, two).ok).toBe(true);
    expect(evaluate({ kind: 'count', expect: { name: 'nope' }, exactly: 0 }, two).ok).toBe(true);
  });
});

describe('in_window', () => {
  const w = { kind: 'in_window' as const, start: { name: 'audio.duck' }, end: { name: 'audio.restored' }, window_ms: [4000, 9000] as [number, number], tolerance_ms: 300 };

  // Fails if: positionAt ignores the device time since the last progress line.
  // Positions then snap back to the previous second, and a cue ending up to a
  // second late reads as on time — the defect of 2026-09-27.
  it('places events on the playhead by interpolation', () => {
    const inside = [ev('INTERSTICE.player.progress pos_ms=4000', 1000), ev('INTERSTICE.audio.duck id=c1', 1200), ev('INTERSTICE.player.progress pos_ms=6000', 3000), ev('INTERSTICE.audio.restored id=c1', 3100)];
    expect(evaluate(w, inside).ok).toBe(true);
    seq = 0;
    const late = [ev('INTERSTICE.player.progress pos_ms=4000', 1000), ev('INTERSTICE.audio.duck id=c1', 1200), ev('INTERSTICE.player.progress pos_ms=9000', 6000), ev('INTERSTICE.audio.restored id=c1', 6400)];
    expect(positionAt(late, 3)).toBe(9400);
    expect(evaluate(w, late).ok).toBe(false);
  });

  it('is false before the first progress line', () => {
    expect(positionAt([ev('INTERSTICE.audio.duck id=c1', 1)], 0)).toBeNull();
    expect(evaluate(w, [ev('INTERSTICE.audio.duck id=c1', 1), ev('INTERSTICE.audio.restored id=c1', 2)]).ok).toBe(false);
  });

  // Fails if: only player.progress states the playhead. A cue whose window
  // opens the film fires on the first tick, ahead of the first progress line,
  // and its duck had no position (R11, S07 on the device: fire at pos_ms=142).
  it('reads the playhead from a scheduler line too, and only one that carries pos_ms', () => {
    const early = [ev('INTERSTICE.scheduler.fire id=c1 pos_ms=142 window=[0,11500)', 1000), ev('INTERSTICE.audio.duck id=c1', 1006)];
    expect(positionAt(early, 1)).toBe(148);
    expect(positionAt([ev('INTERSTICE.scheduler.load cues=55', 1), ev('INTERSTICE.audio.duck id=c1', 2)], 1)).toBeNull();
  });
});

describe('integrity', () => {
  it('accepts a whole launch', () => {
    expect(integrity([ev('INTERSTICE.a', 1), ev('INTERSTICE.b', 2), ev('INTERSTICE.c', 3)])).toBeNull();
  });

  // Fails if: a leading gap is tolerated. The first lines of a launch are
  // emitted at module load, and that is where app.mode lives.
  it('names the missing sequence number, including a leading one', () => {
    const all = [ev('INTERSTICE.a', 1), ev('INTERSTICE.b', 2), ev('INTERSTICE.c', 3)];
    expect(integrity([all[0]!, all[2]!])).toContain('expected seq 1');
    expect(integrity([all[1]!, all[2]!])).toContain('expected seq 0');
  });

  // Fails if: a repeated number passes. A line injected into a real launch has
  // to reuse or skip a number, and a skip is already caught.
  it('rejects a sequence number that arrived twice', () => {
    const real = [ev('INTERSTICE.a', 1), ev('INTERSTICE.b', 2)];
    const forged = { ...real[1]!, line: 'INTERSTICE.player.opened', name: 'player.opened' };
    expect(integrity([...real, forged])).toContain('arrived twice');
  });

  // Fails if: seqs are pooled across launches. One launch's gap is then filled
  // by the other's number.
  it('counts per launch', () => {
    const a = [ev('INTERSTICE.a', 1, 'a'), ev('INTERSTICE.b', 2, 'a')];
    seq = 0;
    const b = [ev('INTERSTICE.a', 3, 'b'), ev('INTERSTICE.b', 4, 'b')];
    expect(integrity([...a, ...b])).toBeNull();
    expect(integrity([a[0]!, b[1]!])).not.toBeNull();
  });

  it('ordered() sorts by seq within a launch and keeps launches in arrival order', () => {
    const x = [ev('INTERSTICE.a', 1, 'a'), ev('INTERSTICE.b', 2, 'a')];
    seq = 0;
    const y = [ev('INTERSTICE.a', 3, 'b')];
    expect(ordered([x[1]!, y[0]!, x[0]!]).map((e) => `${e.boot}${e.seq}`)).toEqual(['a0', 'a1', 'b0']);
  });
});
