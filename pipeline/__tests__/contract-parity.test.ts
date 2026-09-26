import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CUE_KEYS, TRACK_KEYS } from '../../src/ad/TrackLoader';

/**
 * Registry-to-code parity, mechanized.
 *
 * `_facts.yml contracts.*` is the single source of truth for these shapes, and
 * `audit.py` check 3 compares it against the PROSE. Nothing compared it against
 * the CODE — so a field added to the registry and to the docs could still be
 * absent from the validator, and the app would accept a track missing it.
 *
 * R25 is why this exists in this form: a fake written alongside its subject
 * encodes the subject's assumptions. The fixture here is read from the registry
 * on every run, so it cannot drift towards what the validator happens to check.
 */

const FACTS = 'docs/features/interstice/_facts.yml';

/** Field names directly under `  <name>:` inside the top-level `contracts:` block. */
function contractFields(name: string): string[] {
  const src = readFileSync(FACTS, 'utf8');
  const start = src.indexOf(`\n  ${name}:\n`);
  if (start === -1) throw new Error(`contracts.${name} not found in ${FACTS}`);

  const lines = src.slice(start + 1).split('\n').slice(1);
  const fields: string[] = [];
  for (const line of lines) {
    if (line.trim() === '') continue;
    // a line indented by exactly 2 spaces starts the NEXT contract
    if (!line.startsWith('    ')) break;
    const m = /^ {4}([a-z_0-9]+):/.exec(line);
    if (m) fields.push(m[1]!);
  }
  return fields;
}

describe('contracts.description_cue <-> TrackLoader CUE_KEYS', () => {
  // Fails if: a field is added to contracts.description_cue and not to the
  // validator. The app would then accept a track that is missing it, and the
  // first symptom would be an undefined read somewhere in the player.
  it('validates exactly the fields the registry declares', () => {
    expect([...CUE_KEYS].sort()).toEqual(contractFields('description_cue').sort());
  });
});

describe('contracts.description_track <-> TrackLoader TRACK_KEYS', () => {
  it('validates exactly the fields the registry declares', () => {
    expect([...TRACK_KEYS].sort()).toEqual(contractFields('description_track').sort());
  });
});
