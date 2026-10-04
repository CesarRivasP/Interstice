import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = readFileSync('docs/features/interstice/_facts.yml', 'utf8');
const criteria = [...APP.matchAll(/^\s+- \{ id: (AC\d+), item: '/gm)].map((m) => m[1]!);

const result = (over: Record<string, unknown>) => ({
  id: 'S01', name: 'n', suite: 'release', use_case: 'A use case.', covers: ['AC1'], fixture: false,
  verdict: 'pass', reason: null, blocked_by: null, steps: [], assertions: [], spoken: [], artifacts: [],
  trace_path: 'traces/S01.jsonl', duration_ms: 1000, ...over,
});

function build(results: unknown[]): string {
  const root = mkdtempSync(join(tmpdir(), 'e2e-report-'));
  mkdirSync(join(root, 'run', 'release'), { recursive: true });
  writeFileSync(
    join(root, 'run', 'release', 'run.json'),
    JSON.stringify({
      run_id: 'r', started_at: '2026-10-04T00:00:00Z', suite: 'release',
      conditions: { target_platform: 'p', build: 'b', content_asset: 'c' },
      app_commit: 'abc', package_version: '0.1.0', capture_rung: 'none', input_route: 'inputd-cli',
      selftest: { ran: true, scenarios_that_can_fail: 1, of: 1 }, restored_release: null, results,
    }),
  );
  execFileSync('npx', ['tsx', 'e2e/report/build.ts', root], { stdio: 'pipe' });
  return readFileSync(join(root, 'index.html'), 'utf8');
}

describe('the report', () => {
  const html = build([
    result({}),
    result({ id: 'S02', verdict: 'fail', reason: '<script>alert(1)</script>' }),
    result({ id: 'S17', suite: 'release', verdict: 'blocked', reason: 'blocked by D6 — no seek', blocked_by: 'D6 — no seek', covers: ['AC6'] }),
    result({ id: 'S10', fixture: true, covers: ['AC4'] }),
  ]);

  // Fails if: the matrix is built from the harness's own class list instead of
  // from the app's acceptance[]. A criterion added to the app would then be
  // missing from the report with nothing saying so.
  it('has one matrix row per criterion of the app, counted from the registry', () => {
    expect(criteria.length).toBeGreaterThan(15);
    for (const id of criteria) expect(html).toContain(`<th>${id}</th>`);
  });

  // Fails if: any interpolation skips esc(). Trace text comes off a device and
  // is published.
  it('escapes what came from a run', () => {
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('renders a blocked scenario, with its reason, as blocked', () => {
    expect(html).toMatch(/class="card blocked" id="S17"/);
    expect(html).toContain('blocked by D6 — no seek');
  });

  it('labels fixture results and only those', () => {
    const card = (id: string) => html.slice(html.indexOf(`id="${id}"`), html.indexOf('</article>', html.indexOf(`id="${id}"`)));
    expect(card('S10')).toContain('FIXTURE');
    expect(card('S01')).not.toContain('FIXTURE');
  });

  it('states what it cannot show', () => {
    for (const s of ['Audible ducking', 'VoiceView', 'memory bound', 'avoids dialogue']) expect(html).toContain(s);
  });
});
