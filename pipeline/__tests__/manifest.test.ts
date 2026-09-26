import { describe, expect, it } from 'vitest';
import { ManifestError, parseManifest } from '../manifest.js';

const base = {
  version: '1',
  asset_id: 'tears-of-steel',
  media_uri: 'assets/tears-of-steel.mp4',
  subtitles_uri: 'assets/tears-of-steel.en.srt',
  duration_ms: 734_167,
  content_windows: [
    { start_ms: 0, end_ms: 588_000, label: 'film' },
    { start_ms: 709_500, end_ms: 730_333, label: 'post-credits' },
  ],
  byte_index: null,
};

const parse = (patch: Record<string, unknown> = {}) =>
  parseManifest(JSON.stringify({ ...base, ...patch }), 'test');

describe('parseManifest — contracts.asset_manifest', () => {
  it('reads the demo asset s manifest', () => {
    const m = parse();
    expect(m.asset_id).toBe('tears-of-steel');
    expect(m.content_windows).toHaveLength(2);
    expect(m.byte_index).toBeNull();
  });

  it('sorts windows by start time so downstream order is not the author s', () => {
    const m = parse({
      content_windows: [
        { start_ms: 709_500, end_ms: 730_333 },
        { start_ms: 0, end_ms: 588_000 },
      ],
    });
    expect(m.content_windows[0]?.start_ms).toBe(0);
  });

  // Fails if: overlapping windows are accepted. clipToContent emits one clipped
  // gap PER WINDOW, so a gap inside two overlapping windows becomes two cues
  // covering the same seconds — the viewer hears the same span described twice,
  // and nothing downstream can tell that it was a manifest error.
  it('rejects overlapping windows', () => {
    expect(() =>
      parse({
        content_windows: [
          { start_ms: 0, end_ms: 588_000 },
          { start_ms: 500_000, end_ms: 600_000 },
        ],
      }),
    ).toThrow(ManifestError);
  });

  it('rejects a window that runs past the end of the asset', () => {
    expect(() => parse({ content_windows: [{ start_ms: 0, end_ms: 999_999_999 }] })).toThrow(
      /windowPastEnd/,
    );
  });

  it('rejects an empty or inverted window', () => {
    expect(() => parse({ content_windows: [{ start_ms: 100, end_ms: 100 }] })).toThrow(
      /emptyWindow/,
    );
  });

  it('accepts an empty window list — the whole asset is content', () => {
    expect(parse({ content_windows: [] }).content_windows).toEqual([]);
  });

  // Fails if: a missing content_windows key is treated as "no windows". Absent
  // and empty must not mean the same thing — one is an author who declared the
  // whole asset describable, the other is an author who forgot, and only the
  // second is a mistake worth stopping for.
  it('rejects a MISSING content_windows key, which is not the same as an empty one', () => {
    const {content_windows: _dropped, ...without} = base;
    expect(() => parseManifest(JSON.stringify(without), 'test')).toThrow(/field=content_windows/);
  });

  it('rejects malformed json with the origin in the message', () => {
    expect(() => parseManifest('{not json', '/tmp/a.json')).toThrow(/origin=\/tmp\/a\.json/);
  });
});
