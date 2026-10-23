import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { packageTracks } from '../package.js';

const AD_DIR = 'src/assets/ad';

/** The committed package, copied so the test can run packageTracks against it. */
function committedCopy(): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'package-')), 'ad');
  cpSync(AD_DIR, dir, { recursive: true });
  return dir;
}

function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string, rel: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(d, e.name), join(rel, e.name));
      else out[join(rel, e.name)] = readFileSync(join(d, e.name)).toString('base64');
    }
  };
  walk(dir, '');
  return out;
}

describe('package:film on a fresh clone', () => {
  // Fails if: a fresh clone (no generated/, which is gitignored) cannot run the
  // app as submitted. Every clip the committed track names must be in the repo,
  // because tracks.ts requires each one and metro fails the build otherwise.
  it('the committed tracks module names a track whose clips are all committed', () => {
    const module = readFileSync(join(AD_DIR, 'tracks.ts'), 'utf8');
    const required = [...module.matchAll(/require\('\.\/([^']+)'\)/g)].map((m) => m[1]!);
    const tracks = required.filter((f) => f.endsWith('.track.json'));
    expect(tracks.length).toBeGreaterThan(0);
    for (const f of required) expect(existsSync(join(AD_DIR, f)), f).toBe(true);

    for (const file of tracks) {
      const track = JSON.parse(readFileSync(join(AD_DIR, file), 'utf8')) as {
        cues: { status: string; audio_uri: string }[];
      };
      const uris = track.cues.filter((c) => c.status === 'ok' && c.audio_uri !== '').map((c) => c.audio_uri);
      expect(uris.length).toBeGreaterThan(0);
      for (const uri of uris) expect(module, uri).toContain(`'${uri}': require('./audio/`);
    }
  });

  // Fails if: package:film, run with no generated/ (a fresh clone), rewrites
  // the committed tracks module empty, which would leave the app with no track.
  it('keeps the committed track, clips and module when generated/ is missing', () => {
    const ad = committedCopy();
    const before = snapshot(ad);
    expect(packageTracks(join(tmpdir(), 'no-such-generated-dir'), ad)).toBe(0);
    expect(snapshot(ad)).toEqual(before);
  });

  it('keeps them when generated/<asset>/ holds no track', () => {
    const ad = committedCopy();
    const before = snapshot(ad);
    const empty = mkdtempSync(join(tmpdir(), 'generated-'));
    writeFileSync(join(empty, 'notes.txt'), 'not a track');
    expect(packageTracks(empty, ad)).toBe(0);
    expect(snapshot(ad)).toEqual(before);
  });

  // The existing behaviour: generated tracks replace the package.
  it('rewrites the package from generated/ when it holds tracks', () => {
    const gen = mkdtempSync(join(tmpdir(), 'generated-'));
    mkdirSync(join(gen, 'audio'));
    writeFileSync(join(gen, 'audio', 'cue_0-1000.standard.m4a'), 'clip');
    writeFileSync(
      join(gen, 'x.standard.track.json'),
      JSON.stringify({
        cues: [
          { id: 'cue_0-1000', status: 'ok', audio_uri: 'audio/cue_0-1000.standard.m4a' },
          { id: 'cue_2000-3000', status: 'failed', audio_uri: '' },
        ],
      }),
    );
    const ad = committedCopy();
    expect(packageTracks(gen, ad)).toBe(1);
    expect(readdirSync(ad).sort()).toEqual(['audio', 'tracks.ts', 'x.standard.track.json']);
    expect(readdirSync(join(ad, 'audio'))).toEqual(['cue_0-1000.standard.m4a']);
    const module = readFileSync(join(ad, 'tracks.ts'), 'utf8');
    expect(module).toContain("'x.standard.track.json': {");
    expect(module).toContain("'audio/cue_0-1000.standard.m4a': require('./audio/cue_0-1000.standard.m4a'),");
  });
});
