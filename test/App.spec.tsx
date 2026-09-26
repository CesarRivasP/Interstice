import 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import * as React from 'react';

import { App } from '../src/App';
import { PlayerScreen } from '../src/screens/PlayerScreen';
import { instances, surfaceCallbacks } from './mocks/w3cmedia';

describe('App', () => {
  it('renders the player screen', async () => {
    const screen = render(<App />);
    await waitFor(() => expect(screen.getByTestId('kepler-video-surface')).toBeTruthy());
  });
});

describe('PlayerScreen', () => {
  beforeEach(() => {
    surfaceCallbacks.created.length = 0;
    surfaceCallbacks.destroyed.length = 0;
    instances.players.length = 0;
    instances.sources.length = 0;
    global.fetch = jest.fn(async () => ({
      arrayBuffer: async () => new ArrayBuffer(2048),
    })) as unknown as typeof fetch;
  });

  it('mounts a video surface for the player to render into', async () => {
    const screen = render(<PlayerScreen uri="file:///tmp/clip.mp4" />);
    await waitFor(() => expect(screen.getByTestId('kepler-video-surface')).toBeTruthy());
  });

  it('shows a spoken loading state until playback starts', async () => {
    const screen = render(<PlayerScreen uri="file:///tmp/clip.mp4" />);
    // AC8 direction: never a silent blank screen — the state is announced as well
    // as shown, because this app's users cannot see it.
    await waitFor(() =>
      expect(screen.getByLabelText('Loading title')).toBeTruthy(),
    );
  });

  it('registers a surface-created handler, which is what starts playback', async () => {
    render(<PlayerScreen uri="file:///tmp/clip.mp4" />);
    // The platform hands the surface over asynchronously and playback cannot
    // begin before it does — see _facts.yml limits.vega_media.video_player.
    // Fails if: PlayerScreen calls play() directly on mount instead of waiting
    // for the surface, which renders audio with no picture on a real device.
    await waitFor(() => expect(surfaceCallbacks.created.length).toBe(1));
  });

  // Fails if: the screen goes back to assigning a URL to `src`. URL mode is
  // broken on this SDK (_facts.yml limits.vega_media.url_mode_broken): the
  // player rejects the source with MEDIA_ERR_SRC_NOT_SUPPORTED before issuing a
  // single HTTP request, for a remote URL and a packaged file alike. The bytes
  // have to be handed over through a MediaSource, so `src` must stay empty.
  it('attaches media through srcObject and never through src', async () => {
    render(<PlayerScreen uri="file:///tmp/clip.mp4" />);
    await waitFor(() => expect(instances.sources.length).toBe(1));

    const player = instances.players[0]!;
    expect(player.src).toBe('');
    expect(player.srcObject).toBe(instances.sources[0]!);
  });

  it('fetches the asset itself and appends it once the source opens', async () => {
    render(<PlayerScreen uri="file:///tmp/clip.mp4" />);
    await waitFor(() => expect(instances.sources.length).toBe(1));

    const source = instances.sources[0]!;
    source.open();

    await waitFor(() => expect(source.buffers.length).toBe(1));
    await waitFor(() => expect(source.buffers[0]!.appended).toEqual([2048]));
    expect(global.fetch).toHaveBeenCalledWith('file:///tmp/clip.mp4');
    expect(source.readyState).toBe('ended');
  });
});
