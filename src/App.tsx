import React from 'react';
import { PlayerScreen } from './screens/PlayerScreen';

// Bundled with the package; see manifest.toml. The full-length asset is not in
// the repository — see README, "Setup".
const DEMO_URI = 'file:///tmp/clip.mp4';

export const App = () => <PlayerScreen uri={DEMO_URI} />;

export default App;
