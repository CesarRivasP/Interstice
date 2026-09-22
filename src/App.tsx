import React from 'react';
import { Image } from 'react-native';
import { PlayerScreen } from './screens/PlayerScreen';
import { log } from './diagnostics';

// Required rather than referenced by string so that metro bundles it into the
// package: `mp4` is in metro's default assetExts, and the build's
// `cp .../rn-bundles/Release/assets/*` step only has something to copy when an
// asset is actually required. The media pipeline runs in its own process and
// cannot reach the host through the app's port forwarding
// (_facts.yml limits.vega_media.media_process_is_separate), so the asset has to
// travel inside the package.
const CLIP = require('./assets/clip.mp4');

const resolved = Image.resolveAssetSource(CLIP);
log(`INTERSTICE.asset.resolved uri=${resolved?.uri ?? 'NONE'}`);

export const App = () => <PlayerScreen uri={resolved?.uri ?? ''} />;

export default App;
