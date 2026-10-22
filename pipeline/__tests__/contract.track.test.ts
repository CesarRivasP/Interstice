import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateTrack } from '../../node_modules/react-native-tv-audio-description/lib/TrackLoader.js';
import { AD, wordCeiling } from '../budget.js';
import { announcements } from '../gaps.js';
import { parseManifest } from '../manifest.js';
import { VERBOSITY_LEVELS, trackFileName, type DescriptionTrack } from '../types.js';

/**
 * 02e §B.2 "The contract test that needs D4" — against the REAL emitted files
 * under generated/<asset>/, never a fixture. It runs only when a real run has
 * left tracks there; until then every case is skipped, visibly, rather than
 * passing on nothing. AC7: no cue text in those files is hand-written — except
 * the manifest's `announce_end` sentences, which are matched here exactly so the
 * exception cannot widen unnoticed.
 */

const ASSET = 'tears-of-steel';
const DIR = join('generated', ASSET);
const manifest = parseManifest(readFileSync('media/tears-of-steel.manifest.json', 'utf8'), 'test');
const ANNOUNCED = new Map(
  announcements(manifest.content_windows, manifest.duration_ms).map((a) => [`cue_${a.start_ms}-${a.end_ms}`, a.text]),
);
const present = VERBOSITY_LEVELS.filter((v) => existsSync(join(DIR, trackFileName(ASSET, v))));

describe.skipIf(present.length === 0)('generated/<asset> tracks from a real run', () => {
  for (const verbosity of present) {
    const path = join(DIR, trackFileName(ASSET, verbosity));
    const track = JSON.parse(readFileSync(path, 'utf8')) as DescriptionTrack;

    it(`${verbosity}: validates against the package TrackLoader and declares itself`, () => {
      expect(validateTrack(track)).toMatchObject({ ok: true });
      expect(track.verbosity).toBe(verbosity);
      expect(track.model_id).not.toBe('fake-provider');
    });

    it(`${verbosity}: every ok cue is inside its ceiling (AC4) with real audio and real frames`, () => {
      for (const c of track.cues) {
        if (c.status !== 'ok') continue;
        const fixed = ANNOUNCED.get(c.id);
        if (fixed !== undefined) {
          // the manifest's sentence, verbatim, and nothing a model saw
          expect(c.text).toBe(fixed);
          expect(c.source_frames_ms).toEqual([]);
        } else {
          expect(c.words).toBeLessThanOrEqual(wordCeiling(c.end_ms - c.start_ms));
        }
        const audio = join(DIR, c.audio_uri);
        expect(existsSync(audio)).toBe(true);
        const head = readFileSync(audio);
        expect(head.includes('ftyp')).toBe(true);
        expect(head.includes('moof')).toBe(true); // fragmented, not merely .m4a by name
        if (fixed !== undefined) continue;
        expect(c.source_frames_ms.length).toBeGreaterThanOrEqual(1);
        expect(c.source_frames_ms.length).toBeLessThanOrEqual(AD.FRAMES_PER_GAP_MAX);
      }
    });
  }
});
