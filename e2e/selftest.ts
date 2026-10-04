import type { Scenario } from './scenarios/types.js';
import { evaluate, matches, type Assertion, type Match, type TraceEvent } from './trace.js';

/** the Match whose events, once removed, must break the assertion */
function decisive(a: Assertion): Match | null {
  switch (a.kind) {
    case 'seen':
      return a.expect;
    case 'order':
      return a.expect[a.expect.length - 1] ?? null;
    case 'within':
      return a.to;
    case 'in_window':
      return a.end;
    case 'count':
      // "exactly 0" has nothing to remove; it is a negative, covered below
      return a.exactly > 0 ? a.expect : null;
    case 'absent':
      return null;
  }
}

/**
 * True when every POSITIVE assertion of the scenario turns false once the
 * events it matched are taken out of the trace it passed on.
 *
 * Negative assertions (`absent`, `count … exactly 0`) cannot be mutated this
 * way — there is nothing to remove, and a matching event cannot be built from
 * a predicate. They are proved by hand-built traces in
 * e2e/__tests__/trace.test.ts, each with its `Fails if:` (02e §B.1).
 */
export function canFail(scenario: Scenario, passing: TraceEvent[]): boolean {
  const positives = scenario.assertions.filter((a) => decisive(a) !== null);
  if (positives.length === 0) return false; // a scenario of negatives only proves nothing
  return positives.every((a) => {
    const target = decisive(a)!;
    const mutated =
      a.kind === 'count'
        ? dropOne(passing, target)
        : passing.filter((e) => !matches(e, target));
    return evaluate(a, mutated).ok === false;
  });
}

function dropOne(events: TraceEvent[], m: Match): TraceEvent[] {
  const i = events.findIndex((e) => matches(e, m));
  return i < 0 ? events : [...events.slice(0, i), ...events.slice(i + 1)];
}
