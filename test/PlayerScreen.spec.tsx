import 'react-native';
import * as React from 'react';
import {act, render, waitFor} from '@testing-library/react-native';

import {PlayerScreen} from '../src/screens/PlayerScreen';
import {fakeAdapter, type FakeAdapter} from './fakes/adapter';

const URI = 'file:///pkg/bundle/assets/src/assets/clip.mp4';

let media: FakeAdapter;
beforeEach(() => {
  media = fakeAdapter();
});

const renderPlayer = (props: Partial<React.ComponentProps<typeof PlayerScreen>> = {}) =>
  render(<PlayerScreen media={media} uri={URI} {...props} />);

describe('PlayerScreen — the seam', () => {
  // Fails if: the screen reaches past the adapter. The structural check is
  // `rg "@amazon-devices/react-native-w3cmedia" src/ --glob '!src/platform/**'`
  // returning nothing; this is the behavioural half — the screen is rendered
  // here with NO platform mock loaded at all, so a direct import would break it.
  it('renders the surface the adapter supplies', async () => {
    const view = renderPlayer();
    await waitFor(() => expect(view.getByTestId('video-surface')).toBeTruthy());
  });

  it('asks the adapter to open the asset and start it', async () => {
    renderPlayer();
    await waitFor(() => expect(media.video.opened).toEqual([URI]));
    await waitFor(() => expect(media.video.isPlaying()).toBe(true));
  });

  it('tears the player down and drops its listeners on unmount', async () => {
    const view = renderPlayer();
    await waitFor(() => expect(media.video.opened).toHaveLength(1));
    view.unmount();
    await waitFor(() => expect(media.video.destroyed).toBe(1));
    expect(media.video.listenerCount('stalled')).toBe(0);
    expect(media.video.listenerCount('error')).toBe(0);
  });
});

describe('PlayerScreen — every state is spoken, not only shown (AC2, AC8, AC24)', () => {
  it('announces loading before playback starts', () => {
    const view = renderPlayer();
    expect(view.getByLabelText('Loading title')).toBeTruthy();
  });

  it('clears the overlay once it is playing', async () => {
    const view = renderPlayer();
    await waitFor(() => expect(view.queryByLabelText('Loading title')).toBeNull());
  });

  // Fails if: a stall leaves the screen in `playing`. A stall raises NO error
  // (R21-F3), so nothing else reports it — the viewer gets a frozen picture and
  // silence, which for this app's users is indistinguishable from the film
  // simply having stopped being interesting.
  it('announces a stall, which raises no error of its own', async () => {
    const view = renderPlayer();
    await waitFor(() => expect(media.video.isPlaying()).toBe(true));

    await act(async () => media.video.emitStalled());

    expect(view.getByLabelText(/paused while it loads more/)).toBeTruthy();
  });

  it('stops the cue on a stall so the film is never left ducked', async () => {
    const view = renderPlayer({cueUri: 'file:///cue.m4a'});
    await waitFor(() => expect(media.video.isPlaying()).toBe(true));
    await act(async () => media.video.emitStalled());
    expect(media.clips.stops).toBeGreaterThan(0);
    view.unmount();
  });

  it('announces a playback error with the reason attached', async () => {
    const view = renderPlayer();
    await waitFor(() => expect(media.video.isPlaying()).toBe(true));
    await act(async () => media.video.emitError(new Error('media error 4')));
    expect(view.getByLabelText(/could not be played. media error 4/)).toBeTruthy();
  });

  it('announces a failure to open, rather than sitting on Loading forever', async () => {
    media.video.openError = new Error('no bytes');
    const view = renderPlayer();
    await waitFor(() => expect(view.getByLabelText(/could not be played. no bytes/)).toBeTruthy());
  });
});

describe('PlayerScreen — the D6/D2 probe cue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  /**
   * The duck ramp is a stepped fade built from setTimeout (limits.vega_media
   * .no_volume_ramp — the platform has no ramp of its own), so reaching the clip
   * means advancing through the fade as well as through the 2 s delay. Draining
   * both is what this helper does; an `advanceTimersByTime(2000)` alone asserts
   * against the fade rather than against the cue.
   */
  const drain = async (ms: number) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 16) {
      await act(async () => {
        jest.advanceTimersByTime(16);
      });
    }
    await act(async () => undefined); // let the last await chain settle
  };

  it('fires exactly one cue, and only once', async () => {
    const view = render(<PlayerScreen media={media} uri={URI} cueUri="file:///cue.m4a" />);
    await act(async () => undefined); // let open() and play() settle
    await drain(2_500);

    expect(media.clips.played).toEqual(['file:///cue.m4a']);
    view.unmount();
  });

  // Fails if: the film is left ducked after a cue. AC5 says the main track
  // ALWAYS returns to full, and the failure this guards is the one that makes a
  // film unwatchable rather than merely wrong — one bad cue at 25% forever.
  it('returns the main track to full after the cue', async () => {
    const view = render(<PlayerScreen media={media} uri={URI} cueUri="file:///cue.m4a" />);
    await act(async () => undefined);
    await drain(2_500);

    expect(media.video.volumes.at(-1)).toBe(100);
    expect(media.video.volumes).toContain(25);
    view.unmount();
  });

  it('returns the main track to full even when the cue FAILS', async () => {
    media.clips.failWith = new Error('cue media error 4');
    const view = render(<PlayerScreen media={media} uri={URI} cueUri="file:///cue.m4a" />);
    await act(async () => undefined);
    await drain(2_500);

    expect(media.video.volumes.at(-1)).toBe(100);
    view.unmount();
  });

  // Fails if: a cue in flight keeps working after the screen is gone. Its await
  // chain does not know the component unmounted, so its `finally` ramps the
  // volume on a player that has already been destroyed — and stop() has by then
  // restored it anyway. Jest reports the symptom as "Cannot log after tests are
  // done", which is the same defect wearing a smaller hat.
  it('does not keep working after the screen unmounts mid-cue', async () => {
    const view = render(<PlayerScreen media={media} uri={URI} cueUri="file:///cue.m4a" />);
    await act(async () => undefined);
    await act(async () => {
      jest.advanceTimersByTime(2_000); // the cue fires, mid-fade
    });
    view.unmount();

    const after = media.video.volumes.length;
    await drain(1_000);
    // stop()'s own restore is allowed; the stale cue's is not
    expect(media.video.volumes.length).toBeLessThanOrEqual(after + 13);
    expect(media.video.volumes.at(-1)).toBe(100);
  });

  it('fires no cue when none is supplied', async () => {
    render(<PlayerScreen media={media} uri={URI} />);
    await act(async () => undefined);
    await drain(5_000);
    expect(media.clips.played).toEqual([]);
  });
});

describe('PlayerScreen — a stall is a state playback can LEAVE', () => {
  // Fails if: `stalled` is terminal. MSE emits `waiting` at the START of normal
  // playback while the first frames decode — measured on the device 2 ms after
  // play() resolved — so a screen that latches on it speaks "Buffering" over a
  // film that is playing perfectly well, to a viewer who cannot see that it is.
  it('clears the stalled overlay when playback resumes', async () => {
    const view = render(<PlayerScreen media={media} uri={URI} />);
    await waitFor(() => expect(media.video.isPlaying()).toBe(true));

    await act(async () => media.video.emitStalled());
    expect(view.getByLabelText(/paused while it loads more/)).toBeTruthy();

    await act(async () => media.video.emitPlaying());
    expect(view.queryByLabelText(/paused while it loads more/)).toBeNull();
  });

  it('does not resurrect a screen that has errored', async () => {
    const view = render(<PlayerScreen media={media} uri={URI} />);
    await waitFor(() => expect(media.video.isPlaying()).toBe(true));

    await act(async () => media.video.emitError(new Error('media error 4')));
    await act(async () => media.video.emitPlaying());

    expect(view.getByLabelText(/could not be played/)).toBeTruthy();
  });
});
