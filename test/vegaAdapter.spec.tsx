import { createVegaAdapter } from '../src/platform/vega';
import { rampVolumePct } from '../src/ad/duck';
import type { AssetSource } from '../src/platform/MediaAdapter';
import { instances } from './mocks/w3cmedia';

/**
 * The defects found on 2026-09-27 by running changes[C12]'s example/vega on the
 * Vega Virtual Device — code this adapter shares. Every one passed the suite
 * that existed, because a mock does only what its author thought to make it do.
 */

const ASSET: AssetSource = {
  initUri: 'seg/init.mp4',
  segments: [{ index: 0, start_ms: 0, end_ms: 9_940, uri: 'seg/0.m4s' }],
};

const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  instances.players.length = 0;
  instances.sources.length = 0;
  (global as { fetch?: unknown }).fetch = jest.fn(async () => ({
    arrayBuffer: async () => new ArrayBuffer(64),
  }));
});

async function open(adapter: ReturnType<typeof createVegaAdapter>) {
  const opening = adapter.video.open(ASSET);
  await settle();
  instances.sources[instances.sources.length - 1]!.open();
  await opening;
}

async function startClip(adapter: ReturnType<typeof createVegaAdapter>) {
  const playing = adapter.clips.play('audio/cue.m4a');
  await settle();
  const clip = instances.players[instances.players.length - 1]!;
  instances.sources[instances.sources.length - 1]!.open();
  await settle();
  await settle();
  return { playing, clip };
}

const race = (p: Promise<unknown>) =>
  Promise.race([p.then(() => 'settled'), settle().then(() => 'pending')]);

describe('the Vega adapter — found on the device', () => {
  // Fails if: 'sourceopen' is handled more than once. Per MSE, remove() on an
  // 'ended' source reopens it and fires 'sourceopen' again; evicting after the
  // last segment does exactly that, and the second handling re-appended the
  // whole asset, evicted, reopened — a loop at the end of the 20 s clip.
  it('builds one SourceBuffer however many times the source reopens', async () => {
    const adapter = createVegaAdapter();
    await open(adapter);
    const source = instances.sources[0]!;
    source.open();
    source.open();
    await settle();
    expect(source.types).toHaveLength(1);
  });

  // Fails if: position is NaN before the player has media — seen on the device
  // as `scheduler.resync pos_ms=NaN`.
  it('reports position 0 while the player has no media yet', () => {
    const adapter = createVegaAdapter();
    instances.players[0]!.currentTime = NaN;
    expect(adapter.video.positionMs()).toBe(0);
  });

  // Fails if: stop() leaves the clip's promise pending. A paused AudioPlayer
  // never emits 'ended': one leaked player per interrupted cue.
  it('settles the clip and tears its player down when stopped', async () => {
    const adapter = createVegaAdapter();
    const { playing, clip } = await startClip(adapter);
    adapter.clips.stop();
    await expect(race(playing)).resolves.toBe('settled');
    expect(clip.pause).toHaveBeenCalled();
    expect(clip.deinitialize).toHaveBeenCalled();
  });

  // Fails if: the clip waits for teardown (~120 ms on the device, with the film
  // still ducked) before letting the film come back up.
  it('resolves when the clip ends, without waiting for teardown', async () => {
    const adapter = createVegaAdapter();
    const { playing, clip } = await startClip(adapter);
    clip.deinitialize.mockImplementation(() => new Promise<void>(() => undefined));
    clip.emit('ended');
    await expect(race(playing)).resolves.toBe('settled');
  });
});

describe('rampVolumePct — timers on the device fire late', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  // Fails if: the fade is counted in steps. A 200 ms fade of 13 x 16 ms steps
  // took ~510 ms on the Virtual Device, and three of four cues brought the film
  // back up after their window had closed (AC4, AC5).
  it('finishes when rampMs has ELAPSED, even when every timer fires late', async () => {
    const fakeSetTimeout = global.setTimeout;
    jest
      .spyOn(global, 'setTimeout')
      .mockImplementation(((fn: () => void, ms?: number) =>
        fakeSetTimeout(fn, Math.max(ms ?? 0, 50))) as unknown as typeof setTimeout);

    const volumes: number[] = [];
    const video = { setVolumePct: (v: number) => volumes.push(v) } as never;
    let done = false;
    void rampVolumePct(video, 100, 25, 200).then(() => (done = true));
    let elapsed = 0;
    while (!done && elapsed < 2_000) {
      await jest.advanceTimersByTimeAsync(10);
      elapsed += 10;
    }
    expect(done).toBe(true);
    expect(elapsed).toBeLessThanOrEqual(250);
    expect(volumes[volumes.length - 1]).toBe(25);
  });
});
