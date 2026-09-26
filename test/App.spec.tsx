import 'react-native';
import {render, waitFor} from '@testing-library/react-native';
import * as React from 'react';

import {App} from '../src/App';

// The App wires the REAL Vega adapter, so this suite is the one place the
// w3cmedia mock still matters. Everything above the seam is tested against the
// fake adapter in test/fakes/adapter.tsx and loads no platform module at all.
describe('App', () => {
  it('mounts the player behind the platform adapter', async () => {
    const view = render(<App />);
    await waitFor(() => expect(view.getByTestId('kepler-video-surface')).toBeTruthy());
  });
});
