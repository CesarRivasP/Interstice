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
