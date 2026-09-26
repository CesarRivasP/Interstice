import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `02c` Phase 7's structural assertion, mechanized.
 *
 * The phase states it as a command to run by hand:
 *
 *   rg -n "@amazon-devices/react-native-w3cmedia" src/ --glob '!src/platform/**'
 *
 * A check that lives only in a document is a check that runs when somebody
 * remembers it, and this one decays silently: the first import added outside
 * the seam costs nothing and breaks nothing, and by the time `changes[C12]` is
 * packaged the seam is a comment rather than a boundary.
 */

const PLATFORM_PACKAGES = [
  '@amazon-devices/react-native-w3cmedia',
  '@amazon-devices/react-native-kepler',
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

describe('the MediaAdapter seam', () => {
  // Fails if: any file outside src/platform/ imports a platform package. That
  // is what makes changes[C12] a real package rather than a Vega app with a
  // package-shaped README, and it is also what would make a second platform a
  // new directory instead of a rewrite.
  it('confines platform packages to src/platform/', () => {
    const offenders = sourceFiles('src')
      .filter((f) => !f.startsWith(join('src', 'platform')))
      .filter((f) => PLATFORM_PACKAGES.some((pkg) => readFileSync(f, 'utf8').includes(pkg)));

    expect(offenders).toEqual([]);
  });

  it('keeps the choice of platform in exactly one place', () => {
    const choosers = sourceFiles('src').filter((f) =>
      readFileSync(f, 'utf8').includes('platform/vega'),
    );
    expect(choosers).toEqual([join('src', 'App.tsx')]);
  });
});
