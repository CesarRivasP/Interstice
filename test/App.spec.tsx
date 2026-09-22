import 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import * as React from 'react';

import { App } from '../src/App';
import { PlayerScreen } from '../src/screens/PlayerScreen';
import { surfaceCallbacks } from './mocks/w3cmedia';

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
});
