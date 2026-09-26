import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `changes[]` IS the scope of this spec set, and until R36 nothing compared it
 * against the tree.
 *
 * `audit.py` check 7 (scope parity) is a HUMAN-pass check, and it compares
 * `changes[]` against the documents. So a component could be built, tested,
 * shipped to the device and described in the log while the registry — the single
 * source of truth for what this project consists of — never heard of it. Eight
 * components reached that state between R22 and R35, which is the drift this
 * whole skill exists to prevent, introduced by the agent running the skill.
 *
 * This is the cheap mechanical half: every source file under src/ and pipeline/
 * has a `changes[]` entry.
 */

const FACTS = 'docs/features/interstice/_facts.yml';

/**
 * `src/assets/` holds assets, and one GENERATED module that indexes them
 * (`pipeline/prepare.ts` writes it, because metro resolves `require` at build
 * time and the app cannot require a path it reads from a manifest). Generated
 * files are output, not scope — registering them would mean the registry
 * changing every time the asset is re-cut.
 */
const NOT_SOURCE = [join('src', 'assets'), '__tests__'];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return NOT_SOURCE.some((skip) => path.endsWith(skip) || entry === skip)
        ? []
        : sourceFiles(path);
    }
    return /\.tsx?$/.test(entry) && !entry.endsWith('.d.ts') ? [path] : [];
  });
}

function declaredFiles(): Set<string> {
  const src = readFileSync(FACTS, 'utf8');
  const files = new Set<string>();
  for (const m of src.matchAll(/^\s+- \{ id: C\d+, file: ([^,]+),/gm)) {
    files.add(m[1]!.trim().replace(/^['"]|['"]$/g, ''));
  }
  return files;
}

describe('changes[] covers the tree', () => {
  // Fails if: a component is built without being registered. The registry is
  // what `review` sweeps, what `implement` writes phases for, and what anyone
  // reading this project uses to know what it consists of. A file the registry
  // has never heard of is outside all three.
  it('declares every source file under src/ and pipeline/', () => {
    const declared = declaredFiles();
    const undeclared = [...sourceFiles('src'), ...sourceFiles('pipeline')].filter(
      (f) => !declared.has(f),
    );

    expect(undeclared).toEqual([]);
  });

  it('found some entries at all, so a parse failure cannot pass as a clean run', () => {
    expect(declaredFiles().size).toBeGreaterThan(10);
  });
});
