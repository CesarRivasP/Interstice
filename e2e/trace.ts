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
 * Where the playhead was when `e` was emitted: the last line at or before it
 * that STATES the playhead — player.progress, or a scheduler line carrying
 * pos_ms — plus the device time elapsed since. null before any such line.
 *
 * Not player.progress alone: the app ticks the scheduler before it logs
 * progress, so a cue whose window opens the film fires and ducks ahead of the
 * first progress line (R11, S07 at pos_ms=142), and its position was null.
 */
export function positionAt(events: TraceEvent[], index: number): number | null {
  for (let i = index; i >= 0; i--) {
    const p = events[i]!;
    if (p.name === 'player.progress' || (p.name.startsWith('scheduler.') && p.fields.pos_ms !== undefined)) {
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
      // a number seen twice is as disqualifying as one never seen: the app
      // emits each exactly once, so the second copy came from somewhere else
      if (seqs[i] === seqs[i - 1]) return `launch ${boot}: seq ${seqs[i]} arrived twice`;
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
