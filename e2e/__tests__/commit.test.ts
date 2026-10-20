import { describe, expect, it } from 'vitest';
import { appCommit } from '../commit.js';

const fakeGit = (status: string) => (args: string[]) =>
  args[0] === 'rev-parse' ? 'f552e08\n' : status;

describe('appCommit', () => {
  // Fails if: a build from a clean tree is labelled as anything but its commit.
  it('names the commit when the tree is clean', () => {
    expect(appCommit(fakeGit(''))).toBe('f552e08');
  });

  // Fails if: a build with uncommitted changes is published under a commit that lacks them.
  it('marks the commit dirty when the tree has changes outside docs/', () => {
    expect(appCommit(fakeGit(' M src/screens/PlayerScreen.tsx\n'))).toBe('f552e08+dirty');
    expect(appCommit(fakeGit('?? src/new.ts\n'))).toBe('f552e08+dirty');
  });

  // Fails if: docs/ stops being excluded — the report writes there on every publish.
  it('asks git to leave docs/ out', () => {
    const seen: string[][] = [];
    appCommit((args) => {
      seen.push(args);
      return args[0] === 'rev-parse' ? 'abc\n' : '';
    });
    expect(seen[1]).toContain(':(exclude)docs');
  });
});
