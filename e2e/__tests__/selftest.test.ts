import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUITES } from '../scenarios/index.js';
import { canFail } from '../selftest.js';
import { evaluate, type TraceEvent } from '../trace.js';

/**
 * AC4. The traces are recordings of a real device run, committed from a green
 * run and re-recorded whenever a scenario's assertions change.
 */
const DIR = 'e2e/__tests__/traces';
const recorded = readdirSync(DIR).filter((f) => f.endsWith('.jsonl'));
const all = [...SUITES.release, ...SUITES.variant];

describe('every recorded scenario passes on its trace and can be made to fail', () => {
  it('has recordings — a loop over nothing is the cheapest false green there is', () => {
    expect(recorded.length).toBeGreaterThan(0);
  });

  for (const file of recorded) {
    const id = file.replace('.jsonl', '');
    it(id, () => {
      const scenario = all.find((s) => s.id === id)!;
      const events = readFileSync(join(DIR, file), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as TraceEvent);
      for (const a of scenario.assertions) expect(evaluate(a, events).ok, evaluate(a, events).expect).toBe(true);
      expect(canFail(scenario, events)).toBe(true);
    });
  }

  it('a scenario of negatives only is not accepted as able to fail', () => {
    const negatives = { ...all[0]!, assertions: [{ kind: 'count' as const, expect: { name: 'x' }, exactly: 0 }] };
    expect(canFail(negatives, [])).toBe(false);
  });
});
