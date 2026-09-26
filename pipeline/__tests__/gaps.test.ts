import { describe, expect, it } from 'vitest';
import {
  clipToContent,
  findGaps,
  splitIntoCues,
  type ContentWindow,
  type Gap,
} from '../gaps.js';

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

describe('splitIntoCues — a gap is not a cue (R13)', () => {
  const gap = (start_ms: number, end_ms: number, index = 0): Gap => ({
    index,
    start_ms,
    end_ms,
    duration_ms: end_ms - start_ms,
    before: null,
    after: null,
  });

  it('leaves a gap under limits.ad.max_cue_ms as one cue', () => {
    const cues = splitIntoCues([gap(0, 10_000)], 'standard');
    expect(cues).toHaveLength(1);
    expect(cues[0]?.end_ms).toBe(10_000);
  });

  // Fails if: a long gap becomes one cue. The demo asset's longest content gap
  // is 62 s; described as a single window it is one paragraph read over a minute
  // of film, built from at most limits.ad.frames_per_gap_max frames.
  it('splits a long gap into consecutive windows that tile it exactly', () => {
    const cues = splitIntoCues([gap(0, 62_000)], 'standard');
    expect(cues.length).toBeGreaterThan(1);
    expect(cues[0]?.start_ms).toBe(0);
    expect(cues[cues.length - 1]?.end_ms).toBe(62_000);
    for (let i = 1; i < cues.length; i++) {
      expect(cues[i]?.start_ms).toBe(cues[i - 1]?.end_ms);
    }
    for (const c of cues) expect(c.duration_ms).toBeLessThanOrEqual(12_000);
  });

  it('drops a window that cannot carry limits.ad.min_useful_words', () => {
    // 1500 ms at concise: floor(floor((1500-300)/1000*160/60) * 0.6) = 1 word.
    expect(splitIntoCues([gap(0, 1_500)], 'concise')).toEqual([]);
    expect(splitIntoCues([gap(0, 1_500)], 'detailed')).toHaveLength(1);
  });

  // Fails if: the cue count is assumed constant across levels. It is not, and
  // that is why changes[C10] writes one track file per verbosity rather than one
  // track with a shared cue list.
  it('yields FEWER cues at concise than at detailed, on the same gaps', () => {
    const gaps = [gap(0, 1_600, 0), gap(5_000, 7_000, 1), gap(20_000, 50_000, 2)];
    const concise = splitIntoCues(gaps, 'concise').length;
    const detailed = splitIntoCues(gaps, 'detailed').length;
    expect(concise).toBeLessThan(detailed);
  });

  it('keeps the dialogue neighbours only on the windows that touch them', () => {
    const line = {start_ms: 62_000, end_ms: 63_000, text: 'a line'};
    const cues = splitIntoCues(
      [{...gap(0, 62_000), after: line}],
      'standard',
    );
    expect(cues[cues.length - 1]?.after).toBe(line);
    // A middle window has silence on both sides and must not borrow a neighbour
    // it does not have — Phase 5 builds its prompt from these.
    expect(cues[1]?.after).toBeNull();
    expect(cues[1]?.before).toBeNull();
  });

  it('never asks for more words than the window can physically carry', () => {
    for (const c of splitIntoCues([gap(0, 62_000)], 'detailed')) {
      expect(c.word_target).toBeLessThanOrEqual(c.word_ceiling);
    }
  });
});

describe('splitIntoCues — the nesting property changes[C8] and changes[C9] rest on', () => {
  const gaps: Gap[] = [
    {index: 0, start_ms: 0, end_ms: 1_600, duration_ms: 1_600, before: null, after: null},
    {index: 1, start_ms: 5_000, end_ms: 7_000, duration_ms: 2_000, before: null, after: null},
    {index: 2, start_ms: 20_000, end_ms: 82_000, duration_ms: 62_000, before: null, after: null},
  ];
  const key = (c: {start_ms: number; end_ms: number}) => `${c.start_ms}-${c.end_ms}`;

  // Fails if: window BOUNDARIES ever start depending on verbosity. They depend
  // only on duration; verbosity decides which windows are DROPPED, and the drop
  // threshold is monotonic in the verbosity scale. So the cue sets nest:
  // concise ⊆ standard ⊆ detailed.
  //
  // C8 extracts frames once against the detailed set and the other two levels
  // reuse them — a third of the ffmpeg work instead of all of it. If this
  // property breaks, that reuse silently pairs a cue with another cue's frames,
  // which no downstream check would catch because the frame count still looks
  // right.
  it('nests: every concise cue is a standard cue, and every standard cue is a detailed one', () => {
    const concise = new Set(splitIntoCues(gaps, 'concise').map(key));
    const standard = new Set(splitIntoCues(gaps, 'standard').map(key));
    const detailed = new Set(splitIntoCues(gaps, 'detailed').map(key));

    for (const k of concise) expect(standard.has(k)).toBe(true);
    for (const k of standard) expect(detailed.has(k)).toBe(true);
    expect(concise.size).toBeLessThan(detailed.size);
  });
});

describe('splitIntoCues — part position, so C9 can tell silence from a film boundary', () => {
  const longGap: Gap = {
    index: 0,
    start_ms: 0,
    end_ms: 62_000,
    duration_ms: 62_000,
    before: null,
    after: null,
  };

  // Fails if: a middle window is indistinguishable from a gap that opens or
  // closes the film. Both have before === null && after === null, and the
  // prompts they need are opposite — "this gap opens the film" is a false
  // premise handed to C9 for every middle window of every split gap.
  it('numbers each window within its gap', () => {
    const cues = splitIntoCues([longGap], 'standard');
    expect(cues[0]?.part_index).toBe(1);
    expect(cues[0]?.part_count).toBe(cues.length);
    expect(cues[cues.length - 1]?.part_index).toBe(cues.length);
    expect(cues.some((c) => c.part_index > 1 && c.part_index < c.part_count)).toBe(true);
  });

  it('reports a single-window gap as part 1 of 1', () => {
    const cues = splitIntoCues(
      [{...longGap, end_ms: 8_000, duration_ms: 8_000}],
      'standard',
    );
    expect(cues).toHaveLength(1);
    expect(cues[0]?.part_index).toBe(1);
    expect(cues[0]?.part_count).toBe(1);
  });
});
