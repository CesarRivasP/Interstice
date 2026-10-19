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
