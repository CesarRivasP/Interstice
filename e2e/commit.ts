import { execFileSync } from 'node:child_process';

type Git = (args: string[]) => string;
const git: Git = (args) => execFileSync('git', args, { encoding: 'utf8' });

/**
 * `contracts.run_record.app_commit`: the commit the build came from, and
 * `+dirty` when the working tree held changes that commit does not. On
 * 2026-10-19 a run built with the R51-F1 fix still uncommitted was published
 * as `app f552e08` — a commit without that code. `docs/` is excluded: the
 * report itself is written there, and nothing under it is built into the app.
 */
export function appCommit(run: Git = git): string {
  const head = run(['rev-parse', '--short', 'HEAD']).trim();
  const changes = run(['status', '--porcelain', '--', '.', ':(exclude)docs']).trim();
  return changes ? `${head}+dirty` : head;
}
