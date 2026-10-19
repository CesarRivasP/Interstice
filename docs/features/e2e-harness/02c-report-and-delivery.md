# Implementation (5 of 5) — E2E harness — selftest, fixtures, the report and its publication

> Complements `01-master-plan.md`. Phases 14–18. Continues from `02b3-runner.md` (Phase 13).

- **Date:** 2026-10-04
- **Branch:** `main`
- **Test baseline:** `npm test` exit 0 — jest: Tests 24 passed, 24 total · vitest: Test Files 10 passed (10), Tests 70 passed (70) (`_facts.yml tests_baseline`)

> **The preamble of `02-implementation.md` governs this file too.** It is not repeated here.
> Split per `references/doc-pattern.md` §Splitting an oversized doc. No technical content differs from a single-file version.

---

## Changelog

### 2026-10-04 — v4: build R6 — the harness is built and both suites ran on the Virtual Device: ten scenarios pass, one is blocked, and two fail on defects in the app (D8, D9); the report is generated into docs/e2e; fixture audio falls back to the host voice when Polly is unreachable

Built. The code blocks in the implementation halves are the files as they stand after the first device runs, not as first written.

### 2026-10-04 — v2: review R2 dispositions and owner confirmation — a launch id on the wire, fixtures addressed by collector state not by URL, a 60 s fixture asset so a stall can happen, the device restored to the Release package after a VARIANT run, published paths made relative; status draft -> reviewed

Written for the first time. Publishing is a copy, because every path in a run record is relative to its run directory.

---

## Part A — Implementation plan (continued)

### Phase 14 — `C10` `e2e/selftest.ts`

**File:** `e2e/selftest.ts` `(new)`
**Anchor:** new file, full content below.

**What changes:** the harness proving it can fail. For a scenario and a trace it passed on, remove the events each positive assertion matched and require that assertion to turn false. Used twice: by the runner on the run's own traces (`contracts.run_record` `selftest`), and by a vitest file over recorded traces committed under `e2e/__tests__/traces/`.

**Code:**

```ts
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
```

**After the first green run of each suite**, copy that run's `traces/*.jsonl` into `e2e/__tests__/traces/` and commit them. They are recordings of a real device, kept as test input; they are re-recorded whenever a scenario's assertions change.

**Contracts implemented:** `contracts.run_record` (`selftest`), `AC4`.

**Phase 14 verification:** the `e2e:selftest` script (`C17`) → exit 0; `02e-tests-and-e2e.md` §B.2.

---

### Phase 15 — `C8` `e2e/fixtures.ts`

**File:** `e2e/fixtures.ts` `(new)`
**Anchor:** new file, full content below.

**What changes:** builds everything the VARIANT suite serves, into `e2e/out/fixtures/` (ignored by git): 60 s of the film as segments, three cue clips, three track files. Reuses the pipeline's own `segmentAsset` and `synthesizeCue`, so the fixture's media and audio have the container the device was measured to accept.

**Needs:** `media/tears-of-steel.mp4` (downloaded per `README.md`, never committed) and `ffmpeg`. Polly speaks the three sentences when AWS credentials are present; otherwise the host's `say` does, into the same container.

**Code:**

```ts
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { segmentAsset } from '../pipeline/segment.js';
import { synthesizeCue } from '../pipeline/synthesize.js';

// limits.fixture — the registry's values, verbatim
const ASSET_ID = 'e2e-fixture';
const DURATION_S = 60;
const WINDOWS: [number, number][] = [[4000, 9000], [14000, 20000], [24000, 28000]];

const OUT = 'e2e/out/fixtures';
const SOURCE = 'media/tears-of-steel.mp4';
// the device reaches the collector here; must equal the INTERSTICE_E2E the
// VARIANT package was built with (package.json build:e2e)
const HOST = process.env.INTERSTICE_E2E ?? 'http://localhost:8099';

// "Fixture cue N" — never a description of the picture. AC7 of the app set
// forbids hand-written cue text in the PRODUCT track; this is not that track,
// and its text says so out loud.
const TEXT = ['Fixture cue one.', 'Fixture cue two.', 'Fixture cue three.'];
const LEVELS = { concise: [0, 1], standard: [0, 1, 2], detailed: [0, 1, 2] } as const;

const durationMs = (file: string): number =>
  Math.round(
    Number(
      execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {
        encoding: 'utf8',
      }),
    ) * 1000,
  );

/**
 * The fixture's voice. Polly when the credentials are there; otherwise the
 * host's own `say`, into the SAME container the device was measured to accept
 * (fragmented mp4, AAC — the MSE path the app set measured). The words
 * are "Fixture cue N" either way, so nothing a scenario asserts depends on
 * which one spoke — and a reader with no AWS account can still run the suite.
 */
async function speak(text: string, file: string): Promise<'polly' | 'say'> {
  try {
    await synthesizeCue(text, file);
    return 'polly';
  } catch (err) {
    console.log(`Polly unavailable (${(err as Error).message.split('\n')[0]}) — using the host voice`);
    const aiff = `${file}.aiff`;
    execFileSync('say', ['-o', aiff, text]);
    execFileSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', aiff,
      '-c:a', 'aac', '-b:a', '96k', '-ar', '44100', '-ac', '2',
      '-movflags', '+frag_keyframe+empty_moov+default_base_moof', file,
    ]);
    rmSync(aiff);
    return 'say';
  }
}

async function main(): Promise<void> {
  mkdirSync(join(OUT, 'cues'), { recursive: true });

  // 1. the media: the first minute, stream-copied, then cut into segments
  const head = join(OUT, 'head.mp4');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', SOURCE, '-t', String(DURATION_S), '-c', 'copy', head]);
  const cut = segmentAsset(head, join(OUT, 'seg'));

  /** contracts.fixture_asset */
  const asset = {
    init: `seg/${basename(cut.init_uri)}`,
    segments: cut.segments.map((s) => ({
      index: s.index,
      start_ms: s.start_ms,
      end_ms: s.end_ms,
      uri: `seg/${basename(s.uri)}`,
    })),
  };
  // S15 needs a segment that is NOT fetched before playback begins
  if (!asset.segments.some((s) => s.start_ms >= 31_000)) {
    throw new Error('no segment starts after 31 s: S15 cannot stall on this cut');
  }
  writeFileSync(join(OUT, 'asset.json'), JSON.stringify(asset, null, 2) + '\n');

  // 2. the cue audio, and a check that each fits its window with room to spare
  for (const [i, text] of TEXT.entries()) {
    const file = join(OUT, 'cues', `c${i + 1}.m4a`);
    const voice = await speak(text, file);
    console.log(`cue c${i + 1}: ${voice}, ${durationMs(file)} ms`);
    const [start, end] = WINDOWS[i]!;
    const room = end - start - durationMs(file);
    if (room < 1000) throw new Error(`cue c${i + 1} leaves ${room} ms in its window; S10 would fail on the fixture, not on the app`);
  }

  // 3. one track per level — the key set of the app set's description_track contract
  for (const [verbosity, indexes] of Object.entries(LEVELS)) {
    const track = {
      version: '1',
      asset_id: ASSET_ID,
      generated_at: new Date().toISOString(),
      source_subtitles: 'none — e2e fixture, windows declared',
      verbosity,
      model_id: 'none — e2e fixture',
      cues: indexes.map((i) => ({
        id: `c${i + 1}`,
        start_ms: WINDOWS[i]![0],
        end_ms: WINDOWS[i]![1],
        words: TEXT[i]!.split(' ').length,
        text: TEXT[i]!,
        audio_uri: `${HOST}/fx/cues/c${i + 1}.m4a`,
        source_frames_ms: [],
        status: 'ok',
      })),
    };
    writeFileSync(join(OUT, `${ASSET_ID}.${verbosity}.track.json`), JSON.stringify(track, null, 2) + '\n');
  }

  console.log(`fixtures written to ${OUT}: ${asset.segments.length} segments, ${TEXT.length} cues, 3 tracks`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

**Contracts implemented:** `contracts.fixture_asset`, `limits.fixture`, `decisions.fixture_track`, and — by key set — the app set's `description_track` and `description_cue` contracts (in `docs/features/interstice/_facts.yml`), which `02e-tests-and-e2e.md` §B.2 checks against the package's own validator.

**Phase 15 verification:** the `e2e:fixtures` script (`C17`) → the last line `fixtures written to e2e/out/fixtures: … segments, 3 cues, 3 tracks`; then `⟨commands.tests⟩` → exit 0 with `02e-tests-and-e2e.md` §B.2 `fixtures.test.ts`.

---

### Phase 16 — `C9` `e2e/report`

**Files:** `e2e/spoken.ts`, `e2e/report/build.ts`, `e2e/report/publish.ts` — all `(new)`.

**What changes:** a run record becomes a page. The page is a pure function of the run records under `docs/e2e/run/` and of two registries — nothing in it is typed by hand, and nothing from a trace reaches it unescaped.

**Code** — `e2e/spoken.ts`:

```ts
// Imported by path: the package's entry point loads React Native, which Node
// cannot. Same route the app set's contract-parity test takes.
import { stateMessage, type ADState } from '../node_modules/react-native-tv-audio-description/lib/messages.js';
import type { TraceEvent } from './trace.js';

/**
 * What the app said, in order. Overlay sentences come from the trace as
 * emitted; description-state sentences are produced by the package's OWN
 * stateMessage from the state the app logged, so the report never carries a
 * copy of the wording.
 */
export function spokenFrom(events: TraceEvent[]): string[] {
  const out: string[] = [];
  const say = (sentence: string) => {
    // the package does not repeat an unchanged sentence; neither does this
    if (sentence && out[out.length - 1] !== sentence) out.push(sentence);
  };
  for (const e of events) {
    if (e.name === 'overlay.shown') say(e.fields.spoken ?? '');
    if (e.name === 'ad.state') {
      const f = e.fields;
      const state: ADState =
        f.kind === 'ready'
          ? { kind: 'ready', enabled: f.enabled === 'true', verbosity: f.verbosity as never, cues: Number(f.cues) }
          : { kind: f.kind as 'missing' | 'malformed', detail: '' };
      say(stateMessage(state));
    }
  }
  return out;
}
```

**Code** — `e2e/report/build.ts`:

```ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { matches, positionAt, type TraceEvent } from '../trace.js';

const ROOT = process.argv[2] ?? 'docs/e2e';
const APP_FACTS = 'docs/features/interstice/_facts.yml';
const OWN_FACTS = 'docs/features/e2e-harness/_facts.yml';
const ATTRIBUTION = '(CC) Blender Foundation | mango.blender.org'; // limits.report.attribution

/** every string that came off a device or out of a registry goes through this */
const esc = (s: unknown): string =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// decisions.ac_text_read_not_copied: the criterion text is READ, here, each build.
const criteria = [...readFileSync(APP_FACTS, 'utf8').matchAll(/^\s+- \{ id: (AC\d+), item: '((?:[^']|'')*)'/gm)].map(
  (m) => ({ id: m[1]!, item: m[2]!.replace(/''/g, "'") }),
);
const own = readFileSync(OWN_FACTS, 'utf8');
const classesBlock = /\n    classes:\n((?:      AC\d+: \w+\n)+)/.exec(own)?.[1] ?? '';
const classOf = Object.fromEntries([...classesBlock.matchAll(/(AC\d+): (\w+)/g)].map((m) => [m[1]!, m[2]!]));
const partialBlock = /\n    partial:\n((?:      AC\d+: '.*'\n)+)/.exec(own)?.[1] ?? '';
const partialOf = Object.fromEntries([...partialBlock.matchAll(/(AC\d+): '(.*)'/g)].map((m) => [m[1]!, m[2]!]));

type Run = { suite: string; run_id: string; started_at: string; conditions: Record<string, string>; app_commit: string;
  package_version: string; capture_rung: string; input_route: string; selftest: { ran: boolean; scenarios_that_can_fail: number; of: number };
  restored_release: boolean | null; results: any[] };

const runs: Run[] = ['release', 'variant']
  .map((suite) => join(ROOT, 'run', suite, 'run.json'))
  .filter(existsSync)
  .map((p) => JSON.parse(readFileSync(p, 'utf8')) as Run);
if (runs.length === 0) throw new Error(`no run record under ${ROOT}/run/ — npm run e2e:publish`);

const allResults = runs.flatMap((r) => r.results.map((x) => ({ ...x, run: r })));

/** the strip: the playhead left to right, windows as bands, each cue from duck to restore */
function timeline(result: any): string {
  if (!result.windows_ms) return '';
  const file = join(ROOT, 'run', result.suite, result.trace_path);
  if (!existsSync(file)) return '';
  const events = readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as TraceEvent);
  const spans: [number, number][] = [];
  events.forEach((e, i) => {
    if (e.name !== 'audio.duck') return;
    const j = events.findIndex((x, k) => k > i && matches(x, { name: 'audio.restored', where: { id: e.fields.id ?? '' } }));
    const a = positionAt(events, i);
    const b = j < 0 ? null : positionAt(events, j);
    if (a !== null && b !== null) spans.push([a, b]);
  });
  const end = Math.max(30_000, ...result.windows_ms.map((w: number[]) => w[1]!), ...spans.map((s) => s[1]));
  const x = (ms: number) => ((ms / end) * 1000).toFixed(1);
  return `<svg class="strip" viewBox="0 0 1000 46" role="img" aria-label="Cue windows and cues on the playhead">
  <rect x="0" y="20" width="1000" height="6" class="film"/>
  ${result.windows_ms.map((w: number[]) => `<rect x="${x(w[0]!)}" y="8" width="${x(w[1]! - w[0]!)}" height="30" class="window"/>`).join('')}
  ${spans.map(([a, b]) => `<rect x="${x(a)}" y="14" width="${x(b - a)}" height="18" class="cue"/>`).join('')}
</svg><p class="legend">band: the window · block: the film ducked, from duck to restore · ${esc((end / 1000).toFixed(0))} s shown</p>`;
}

function card(r: any): string {
  const shots = r.artifacts
    .map((a: any) =>
      a.kind === 'clip'
        ? `<figure><video controls preload="none" src="run/${esc(r.suite)}/${esc(a.path)}"></video><figcaption>${esc(a.caption)}</figcaption></figure>`
        : `<figure><img loading="lazy" src="run/${esc(r.suite)}/${esc(a.path)}" alt="${esc(a.caption)}"><figcaption>${esc(a.caption)}</figcaption></figure>`,
    )
    .join('');
  return `<article class="card ${esc(r.verdict)}" id="${esc(r.id)}">
  <header><span class="verdict">${esc(r.verdict.toUpperCase())}</span><h3>${esc(r.id)} · ${esc(r.use_case)}</h3>
  <p class="tags">${esc(r.suite.toUpperCase())}${r.fixture ? ' · <strong>FIXTURE</strong>' : ''} · covers ${r.covers.map(esc).join(', ')}</p></header>
  ${r.reason ? `<p class="reason">${esc(r.reason)}</p>` : ''}
  ${shots ? `<div class="shots">${shots}</div><p class="attribution">${esc(ATTRIBUTION)}</p>` : ''}
  ${timeline(r)}
  ${r.spoken.length ? `<h4>What the viewer is told</h4><ol class="spoken">${r.spoken.map((s: string) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
  ${r.steps.length ? `<h4>Steps</h4><ol class="steps">${r.steps.map((s: any) => `<li><code>${esc((s.at_ms / 1000).toFixed(1))}s</code> ${esc(s.action)} — ${esc(s.detail)}</li>`).join('')}</ol>` : ''}
  ${r.assertions.length ? `<h4>Decided by</h4><ul class="asserts">${r.assertions.map((a: any) => `<li class="${a.ok ? 'ok' : 'no'}">${a.ok ? '✓' : '✗'} <code>${esc(a.expect)}</code></li>`).join('')}</ul>` : ''}
  ${r.cannot_show ? `<p class="cannot"><strong>Cannot show:</strong> ${esc(r.cannot_show)}</p>` : ''}
  ${r.verdict !== 'blocked' ? `<p class="trace"><a href="run/${esc(r.suite)}/${esc(r.trace_path)}">full trace</a> · ${esc((r.duration_ms / 1000).toFixed(1))} s</p>` : ''}
</article>`;
}

const counts = Object.values(classOf).reduce<Record<string, number>>((n, c) => ({ ...n, [c]: (n[c] ?? 0) + 1 }), {});
const matrix = criteria
  .map((c) => {
    const behind = allResults.filter((r) => r.covers.includes(c.id));
    return `<tr class="${esc(classOf[c.id] ?? 'unclassified')}"><th>${esc(c.id)}</th><td>${esc(c.item)}</td>
  <td>${esc((classOf[c.id] ?? 'UNCLASSIFIED').replace(/_/g, ' '))}${partialOf[c.id] ? `<br><small>${esc(partialOf[c.id])}</small>` : ''}</td>
  <td>${behind.map((r) => `<a class="${esc(r.verdict)}" href="#${esc(r.id)}">${esc(r.id)} ${esc(r.verdict)}</a>`).join(' ') || '—'}</td></tr>`;
  })
  .join('\n');

const css = `:root{--bg:#fff;--fg:#16181d;--mute:#5b6270;--line:#d9dde5;--pass:#17753a;--fail:#b3261e;--blocked:#8a5a00;--band:#cfe0ff;--cue:#2b5fd9}
@media(prefers-color-scheme:dark){:root{--bg:#111318;--fg:#e8eaf0;--mute:#9aa3b2;--line:#2b303b;--pass:#5fd08a;--fail:#ff8a80;--blocked:#f0b95a;--band:#263a66;--cue:#8fb0ff}}
body{margin:0;padding:24px 16px 64px;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}main{max-width:960px;margin:0 auto}
h1{font-size:28px;margin:0 0 4px}h2{margin:40px 0 12px;font-size:20px}h3{font-size:17px;margin:0}h4{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:var(--mute);margin:16px 0 4px}
.meta,.legend,.tags,.trace,.attribution,small{color:var(--mute);font-size:13px}
.card{border:1px solid var(--line);border-left:6px solid var(--mute);border-radius:8px;padding:16px;margin:16px 0}
.card.pass{border-left-color:var(--pass)}.card.fail{border-left-color:var(--fail)}.card.blocked{border-left-color:var(--blocked)}
.verdict{float:right;font-weight:700;font-size:13px}.pass .verdict,a.pass,.ok{color:var(--pass)}.fail .verdict,a.fail,.no{color:var(--fail)}.blocked .verdict,a.blocked{color:var(--blocked)}
.reason{font-weight:600}.shots{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:12px}figure{margin:0}img,video{width:100%;border-radius:4px;display:block}
.strip{width:100%;height:46px;margin-top:12px}.film{fill:var(--line)}.window{fill:var(--band)}.cue{fill:var(--cue)}
.tablewrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border-top:1px solid var(--line);padding:8px;text-align:left;vertical-align:top}
a{color:inherit}code{font-size:13px;overflow-wrap:anywhere}ul,ol{padding-left:20px;margin:4px 0}.asserts{list-style:none;padding:0}.cannot{border-top:1px dashed var(--line);padding-top:8px}`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Interstice — verification report</title><style>${css}</style></head><body><main>
<h1>Interstice — verification report</h1>
<p class="meta">Every result below was decided by the app's own trace on a device run. Pictures illustrate; they decide nothing.</p>
${runs.map((r) => `<p class="meta"><strong>${esc(r.suite.toUpperCase())}</strong> · ${esc(r.started_at)} · ${esc(r.conditions.target_platform)} · ${esc(r.conditions.build)} · ${esc(r.conditions.content_asset)} · app ${esc(r.app_commit)} · package ${esc(r.package_version)} · capture ${esc(r.capture_rung)} · keys ${esc(r.input_route)} · selftest ${esc(r.selftest.scenarios_that_can_fail)}/${esc(r.selftest.of)} passing scenarios shown able to fail${r.restored_release === null ? '' : ` · Release package restored: ${r.restored_release ? 'yes' : 'NO'}`}</p>`).join('\n')}

<h2>The app's acceptance criteria</h2>
<p>${esc(criteria.length)} criteria: ${Object.entries(counts).map(([k, v]) => `${esc(v)} ${esc(k.replace(/_/g, ' '))}`).join(' · ')}.
<strong>RELEASE</strong> results are the submitted binary. <strong>FIXTURE</strong> results ran a test build against a labelled stand-in track that is not the product's and never ships.</p>
<div class="tablewrap"><table><thead><tr><th>id</th><th>criterion</th><th>class</th><th>evidence</th></tr></thead><tbody>
${matrix}
</tbody></table></div>

<h2>What this report cannot show</h2>
<ul>
<li><strong>Audible ducking.</strong> The trace shows the volume property set and restored. Whether a listener hears the film get quieter is checked on hardware.</li>
<li><strong>VoiceView.</strong> It cannot be switched on in the Virtual Device. "What the viewer is told" below is what the app hands to the screen reader, not what the screen reader did with it.</li>
<li><strong>The memory bound on a real Fire TV.</strong> Every run here is on the Virtual Device.</li>
<li><strong>That a cue avoids dialogue.</strong> Fixture windows are declared, not derived from subtitles; that half waits on the generated track.</li>
</ul>

${runs.map((r) => `<h2>${esc(r.suite === 'release' ? 'The submitted build' : 'The test build, with faults injected')}</h2>\n${r.results.map(card).join('\n')}`).join('\n')}
</main></body></html>
`;

writeFileSync(join(ROOT, 'index.html'), html);
console.log(`report: ${join(ROOT, 'index.html')} — ${allResults.length} scenarios, ${criteria.length} criteria`);
```

**Code** — `e2e/report/publish.ts`:

```ts
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// limits.report
const MAX_TOTAL_MB = 25;
const MAX_SHOT_KB = 300;
const MAX_CLIP_MB = 3;
const DEST = 'docs/e2e';

/** usage: tsx e2e/report/publish.ts <run dir> [<run dir>] — at most one per suite */
const dirs = process.argv.slice(2);
if (dirs.length === 0) throw new Error('usage: npm run e2e:publish -- e2e/out/<run id> [e2e/out/<run id>]');

for (const dir of dirs) {
  const { suite } = JSON.parse(readFileSync(join(dir, 'run.json'), 'utf8')) as { suite: string };
  const dest = join(DEST, 'run', suite);
  rmSync(dest, { recursive: true, force: true });
  cpSync(dir, dest, { recursive: true }); // a copy is the whole run: every path in it is relative
}

const sizeOf = (p: string): number =>
  statSync(p).isDirectory() ? readdirSync(p).reduce((n, f) => n + sizeOf(join(p, f)), 0) : statSync(p).size;
const tooBig: string[] = [];
const walk = (p: string) => {
  for (const f of readdirSync(p)) {
    const full = join(p, f);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.png$/.test(f) && statSync(full).size > MAX_SHOT_KB * 1024) tooBig.push(`${full} > ${MAX_SHOT_KB} KB`);
    else if (/\.mp4$/.test(f) && statSync(full).size > MAX_CLIP_MB * 1024 * 1024) tooBig.push(`${full} > ${MAX_CLIP_MB} MB`);
  }
};
walk(join(DEST, 'run'));
if (sizeOf(DEST) > MAX_TOTAL_MB * 1024 * 1024) tooBig.push(`${DEST} > ${MAX_TOTAL_MB} MB in total`);
if (tooBig.length) throw new Error(`over the published-size bounds (limits.report):\n  ${tooBig.join('\n  ')}`);

if (!existsSync('docs/.nojekyll')) writeFileSync('docs/.nojekyll', '');
execFileSync('npx', ['tsx', 'e2e/report/build.ts', DEST], { stdio: 'inherit' });
```

A screenshot or clip over its bound is a refusal, not a silent resize: `E2E_CAPTURE` produced it, and the place to make it smaller is the capture (a 1280-wide PNG, a 12 s clip — `limits.report` `max_clip_s`), where the choice is visible.

**Contracts implemented:** `contracts.run_record`, `contracts.scenario_result`, `limits.report`, `limits.coverage`, `decisions.ac_text_read_not_copied`, `decisions.report_static_pages`, `AC8`–`AC13`.

**Phase 16 verification:** the `e2e:report` script (`C17`) with no device attached → `report: docs/e2e/index.html — … scenarios, 22 criteria`; then `02e-tests-and-e2e.md` §B.2 `report.test.ts` and `02e-tests-and-e2e.md` §C.7.

---

### Phase 17 — `C11` `docs/e2e`, `C20` `README.md`, `C22` GitHub Pages `[MANUAL]`

**17.1 — publish.** After a run of each suite the owner is willing to stand behind:

```
npm run e2e:publish -- e2e/out/<release run id> e2e/out/<variant run id>
git add docs/e2e docs/.nojekyll && git commit
```

`docs/e2e/` is generated. It is never edited by hand; a wrong page is fixed in `e2e/report/build.ts` and rebuilt.

**17.2 — `README.md`.**
**Anchor:** the `## Status` heading of `README.md`. Insert a new section directly above it:

```markdown
## Verification

**[The verification report](https://cesarrivasp.github.io/Interstice/e2e/)** shows the app running through its use cases on the Vega Virtual Device: what was on screen, what the viewer was told, and the trace lines that decided each result — mapped to every acceptance criterion in `docs/features/interstice/`, including the ones it cannot close.

To re-run it: a booted Vega Virtual Device (SDK 0.24), Node 20+, then

    npm run e2e:release     # the submitted build — five scenarios, no fixtures
    npm run e2e:report      # rebuilds the page from the committed run; needs no device

`npm run e2e:variant` additionally needs `media/tears-of-steel.mp4`, `ffmpeg` and AWS credentials for Polly (`npm run e2e:fixtures`, once). How it is built: `docs/features/e2e-harness/`.
```

**17.3 — GitHub Pages `[MANUAL]` — verifies `AC12`.** In the repository on GitHub: Settings → Pages → Build and deployment → Source: *Deploy from a branch* → Branch: `main`, folder `/docs` → Save. Then open `https://cesarrivasp.github.io/Interstice/e2e/` and confirm the page loads with its images. Record the result on `acceptance[AC12]`: `status: executed`, `verified_on:`, and the URL in `evidence:`.

The `/docs` folder also holds the spec sets. They are already public in the repository; Pages only makes them reachable by a second URL.

**Contracts implemented:** `decisions.report_static_pages`, `limits.report`, `AC11`, `AC12`.

**Phase 17 verification:** `02e-tests-and-e2e.md` §C.7.

---

### Phase 18 — `C21` `FRICTION-LOG.md` `[MANUAL]`

**Verifies:** `AC14`.

**File:** `FRICTION-LOG.md`
**Anchor:** the end of the file; entries are dated and appended.

**What changes:** one entry per platform obstacle met while building this, **written the day it is met** — the first ones during `02` Phase 0. The shape is the one the file already uses (the app set's friction-log-shape decision, in `docs/features/interstice/_facts.yml`): `tool | expected | happened | workaround | time_lost`.

Known before any code, to be written only when actually met and with the time actually lost:

| tool | expected | what Phase 0 will confirm or correct |
|---|---|---|
| Vega CLI | a command to capture the screen | `limits.capture` `cli_has_no_screenshot` — measured: none exists |
| Vega CLI | a command to press a remote key | `D2` — two observations disagree |
| automation toolkit | a current frame from `takeScreenshot` | `limits.capture` `appium_stale_frames` — third-party report |
| build | one flag, two packages from one tree | `D4` |

Each also becomes a line of product feedback in the submission, which the rules ask for separately.

**Contracts implemented:** `AC14`.

**Phase 18 verification:** `02e-tests-and-e2e.md` §C.8.

---

## Continues in `02e-tests-and-e2e.md`

Part B (the harness's own tests), Part C (the manual steps, one per phase verification above) and the Definition of Done.
