import 'react-native';
import {fireEvent, render, waitFor} from '@testing-library/react-native';
import * as React from 'react';

import {App} from '../src/App';
import {pressBack} from './setup';

/**
 * The App wires the REAL Vega adapter, so this suite is the one place the
 * w3cmedia mock still matters. Everything above the seam is tested against the
 * fake adapter in test/fakes/adapter.tsx and loads no platform module at all.
 */
describe('App — shell and navigation', () => {
  it('opens on a title list with a focusable entry', () => {
    const view = render(<App />);
    expect(view.getByLabelText('Play Tears of Steel')).toBeTruthy();
  });

  it('enters the player when a title is chosen', async () => {
    const view = render(<App />);
    fireEvent.press(view.getByLabelText('Play Tears of Steel'));
    await waitFor(() => expect(view.getByTestId('kepler-video-surface')).toBeTruthy());
  });

  // Fails if: BACK has no stated destination. On a TV the remote's BACK is the
  // only way out of a screen, and one that consumes it without going anywhere
  // traps the viewer in the player — AC2, and the reason the criterion names
  // BACK separately from every other key.
  it('returns to the list on BACK, rather than trapping the viewer', async () => {
    const view = render(<App />);
    fireEvent.press(view.getByLabelText('Play Tears of Steel'));
    await waitFor(() => expect(view.getByTestId('kepler-video-surface')).toBeTruthy());

    pressBack();

    await waitFor(() => expect(view.getByLabelText('Play Tears of Steel')).toBeTruthy());
    expect(view.queryByTestId('kepler-video-surface')).toBeNull();
  });
});
