import React, {useCallback, useState} from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {PlayerScreen} from './screens/PlayerScreen';
import {createVegaAdapter} from './platform/vega';
import {log} from './diagnostics';

// Required rather than referenced by string so that metro bundles it into the
// package: `mp4` is in metro's default assetExts, and the build's asset-copy
// step only has something to copy when an asset is actually required. The media
// pipeline runs in its own process and cannot reach the host through the app's
// port forwarding (limits.vega_media.media_process_is_separate), so the asset
// has to travel inside the package.
//
// NOTE the directory: src/assets/, NOT the project-root assets/. The Vega build
// copies the project-root assets/ directory verbatim into the package
// (limits.vega_media.build_packages_assets_dir), which is how 489 MB of source
// film once shipped to the device.
const CLIP = require('./assets/clip.mp4');

// One synthesised description cue, here to answer defects[D6] and defects[D2]
// on a real device. changes[C10] replaces it with Polly output; the container is
// already what C10 must emit — fragmented mp4, AAC-LC.
const CUE = require('./assets/cue.m4a');

const resolved = Image.resolveAssetSource(CLIP);
const resolvedCue = Image.resolveAssetSource(CUE);
log(`INTERSTICE.asset.resolved uri=${resolved?.uri ?? 'NONE'}`);
log(`INTERSTICE.asset.cue uri=${resolvedCue?.uri ?? 'NONE'}`);

// The one place the platform is chosen. Everything below src/ that is not
// src/platform/ reaches the device only through this object — enforced by
// pipeline/__tests__/seam.test.ts, not by good intentions.
const media = createVegaAdapter();

/**
 * One title. `decisions.demo_asset_licensing` — openly licensed, dialogue
 * bearing, and recorded with its license in README.md.
 */
const TITLES = [{id: 'tears-of-steel', label: 'Tears of Steel'}];

/**
 * Track files sit beside the asset and are fetched like any other packaged file.
 * `limits.vega_media.url_mode_broken` is about the PLAYER, not about fetch —
 * JavaScript reaches packaged paths fine, which R18 measured before anything
 * else worked.
 */
async function readJson(path: string): Promise<unknown> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export const App = () => {
  const [playing, setPlaying] = useState<string | null>(null);
  const exit = useCallback(() => setPlaying(null), []);

  if (playing) {
    return (
      <PlayerScreen
        media={media}
        uri={resolved?.uri ?? ''}
        cueUri={resolvedCue?.uri ?? ''}
        assetDir="/pkg/bundle/assets/src/assets"
        assetId={playing}
        readJson={readJson}
        onExit={exit}
      />
    );
  }

  return (
    <View style={styles.list}>
      <Text style={styles.heading}>Interstice</Text>
      {TITLES.map(title => (
        <Pressable
          key={title.id}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Play ${title.label}`}
          hasTVPreferredFocus
          onPress={() => {
            log(`INTERSTICE.app.play id=${title.id}`);
            setPlaying(title.id);
          }}>
          <Text style={styles.title}>{title.label}</Text>
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  list: {flex: 1, backgroundColor: '#000', padding: 48, gap: 24},
  heading: {color: '#fff', fontSize: 48, marginBottom: 24},
  title: {color: '#fff', fontSize: 32},
});

export default App;
