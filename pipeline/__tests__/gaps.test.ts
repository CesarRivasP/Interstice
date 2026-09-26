import { describe, expect, it } from 'vitest';
import { clipToContent, findGaps, type ContentWindow, type Gap } from '../gaps.js';

// The demo asset's measured describable windows (_facts.yml worst_case.content_windows).
// Credits run 588.0s -> 707.2s and a POST-CREDITS SCENE runs 709.5s -> 730.3s.
const WINDOWS: ContentWindow[] = [
  { start_ms: 0, end_ms: 588_000, label: 'film' },
  { start_ms: 709_500, end_ms: 730_333, label: 'post-credits' },
];

const gap = (start_ms: number, end_ms: number): Gap => ({
  index: 0,
  start_ms,
  end_ms,
  duration_ms: end_ms - start_ms,
  before: null,
  after: null,
});

describe('clipToContent — decisions.demo_asset_licensing, the credits bound', () => {
  it('drops a gap that lies entirely in the credits', () => {
    expect(clipToContent([gap(600_000, 700_000)], WINDOWS)).toEqual([]);
  });

  it('clips a gap that runs off the end of the content into the credits', () => {
    const [clipped] = clipToContent([gap(567_000, 734_167)], WINDOWS);
    expect(clipped?.start_ms).toBe(567_000);
    expect(clipped?.end_ms).toBe(588_000);
  });

  // Fails if: the trailing gap is dropped wholesale instead of being intersected
  // window by window. That is the rule the spec nearly adopted, and on this asset
  // it would delete a real 21-second post-credits scene — content a sighted viewer
  // keeps and a blind viewer would silently lose.
  it('yields one gap per window when a single gap spans the credits', () => {
    const clipped = clipToContent([gap(567_000, 734_167)], WINDOWS);
    expect(clipped).toHaveLength(2);
    expect(clipped[1]?.start_ms).toBe(709_500);
    expect(clipped[1]?.end_ms).toBe(730_333);
  });

  it('drops a clipped remainder shorter than limits.ad.min_gap_ms', () => {
    // 587.0s -> 600.0s leaves 1000 ms inside the film window, under the 1500 ms floor.
    expect(clipToContent([gap(587_000, 600_000)], WINDOWS)).toEqual([]);
  });

  it('renumbers indices over the clipped list, in time order', () => {
    const clipped = clipToContent(
      [gap(567_000, 734_167), gap(10_000, 20_000)],
      WINDOWS,
    );
    expect(clipped.map((g) => g.index)).toEqual([0, 1, 2]);
    expect(clipped[0]?.start_ms).toBe(10_000);
  });

  it('treats an empty window list as "the whole asset is content"', () => {
    const gaps = [gap(600_000, 700_000)];
    expect(clipToContent(gaps, [])).toEqual(gaps);
  });

  it('composes with findGaps without changing what findGaps means', () => {
    const subs = [
      { start_ms: 1_000, end_ms: 2_000, text: 'one' },
      { start_ms: 566_000, end_ms: 567_000, text: 'last line' },
    ];
    const raw = findGaps(subs, 734_167);
    const clipped = clipToContent(raw, WINDOWS);
    // The raw trailing gap reaches the end of the asset; the clipped one stops at
    // the content end and the post-credits scene arrives as its own gap.
    expect(raw[raw.length - 1]?.end_ms).toBe(734_167);
    expect(clipped[clipped.length - 1]?.end_ms).toBe(730_333);
    expect(clipped.length).toBe(raw.length + 1);
  });
});
