import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SUITES } from '../scenarios/index.js';
import { WINDOWS } from '../scenarios/variant.js';

/**
 * Binds the scenarios in code to the registry, the way the app set's
 * contract-parity test binds its validator: the registry is read on every run,
 * never copied here.
 */
const OWN = readFileSync('docs/features/e2e-harness/_facts.yml', 'utf8');
const APP = readFileSync('docs/features/interstice/_facts.yml', 'utf8');

const declared = [...OWN.matchAll(/- \{ id: (S\d+), name: ([\w-]+), suite: (\w+), covers: \[([^\]]*)\]/g)].map((m) => ({
  id: m[1]!, name: m[2]!, suite: m[3]!, covers: m[4]!.split(',').map((s) => s.trim()),
}));
const deferred = new Set(
  [...OWN.matchAll(/- \{ id: (S\d+),[^}]*?deferred: true/gs)].map((m) => m[1]!),
);
const coded = [...SUITES.release, ...SUITES.variant];

describe('scenarios match limits.suite', () => {
  it('found the registry entries at all', () => {
    expect(declared.length).toBeGreaterThan(10);
  });

  // Fails if: a scenario exists in code and not in the registry, or its covers
  // list is widened in code alone — the coverage matrix would then credit a
  // criterion nobody reviewed.
  it('ids, names, suites and covers are exactly the registry\'s', () => {
    const want = declared.filter((d) => !deferred.has(d.id));
    expect(coded.map((s) => ({ id: s.id, name: s.name, suite: s.suite, covers: s.covers }))).toEqual(want);
  });

  it('the cue windows are limits.fixture.cue_windows_ms', () => {
    const m = /cue_windows_ms: (\[\[.*\]\])/.exec(OWN);
    expect(WINDOWS).toEqual(JSON.parse(m![1]!));
  });

  it('every covered criterion exists in the app registry', () => {
    const app = new Set([...APP.matchAll(/^\s+- \{ id: (AC\d+),/gm)].map((m) => m[1]!));
    for (const s of coded) for (const id of s.covers) expect(app.has(id), `${s.id} covers ${id}`).toBe(true);
  });

  it('a blocked scenario says why, and every other one can be shown to fail', () => {
    for (const s of coded) {
      if (s.blocked_by !== undefined) expect(s.blocked_by.length).toBeGreaterThan(3);
      else expect(s.assertions.some((a) => a.kind !== 'absent' && !(a.kind === 'count' && a.exactly === 0)), s.id).toBe(true);
    }
  });
});
