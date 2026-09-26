import React from 'react';
import {Image} from 'react-native';
import {PlayerScreen} from './screens/PlayerScreen';
import {log} from './diagnostics';

// Required rather than referenced by string so that metro bundles it into the
// package: `mp4` is in metro's default assetExts, and the build's
// `cp .../rn-bundles/Release/assets/*` step only has something to copy when an
// asset is actually required. The media pipeline runs in its own process and
// cannot reach the host through the app's port forwarding
// (_facts.yml limits.vega_media.media_process_is_separate), so the asset has to
// travel inside the package.
const CLIP = require('./assets/clip.mp4');

// One synthesised description cue, here to answer defects[D6] and defects[D2]
// on a real device. changes[C10] replaces it with Polly output; the container is
// already what C10 must emit — fragmented mp4, AAC-LC.
const CUE = require('./assets/cue.m4a');

const resolved = Image.resolveAssetSource(CLIP);
const resolvedCue = Image.resolveAssetSource(CUE);
log(`INTERSTICE.asset.resolved uri=${resolved?.uri ?? 'NONE'}`);
log(`INTERSTICE.asset.cue uri=${resolvedCue?.uri ?? 'NONE'}`);

export const App = () => (
  <PlayerScreen uri={resolved?.uri ?? ''} cueUri={resolvedCue?.uri ?? ''} />
);

export default App;
