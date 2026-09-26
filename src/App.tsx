import React, {useCallback, useState} from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {PlayerScreen} from './screens/PlayerScreen';
import {createVegaAdapter} from './platform/vega';
import {probeRangeSupport} from './platform/vega/rangeProbe';
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

/**
 * The same clip, cut into fragmented-MP4 segments by pipeline/segment.ts.
 *
 * Each one is `require`d because metro bundles what is required and nothing
 * else — and `m4s` had to be added to `assetExts` in metro.config.js, since it
 * is not a default media extension.
 *
 * Hand-listed here only while changes[C10] does not yet emit a manifest; the
 * moment it does, this becomes contracts.asset_manifest.segments read from the
 * track beside the asset.
 */
const SEGMENTS = [
  {index: 0, start_ms: 0, end_ms: 9_940, mod: require('./assets/seg/seg0000.m4s')},
  {index: 1, start_ms: 9_940, end_ms: 14_107, mod: require('./assets/seg/seg0001.m4s')},
  {index: 2, start_ms: 14_107, end_ms: 19_399, mod: require('./assets/seg/seg0002.m4s')},
  {index: 3, start_ms: 19_399, end_ms: 20_047, mod: require('./assets/seg/seg0003.m4s')},
];
const INIT = require('./assets/seg/init.mp4');

const resolved = Image.resolveAssetSource(CLIP);

/**
 * The demo clip as a one-segment asset.
 *
 * A whole-file asset is a single segment covering the whole timeline, so it
 * takes the same path through limits.mse_buffer as a segmented one. That is
 * deliberate: if the short clip took a separate "just append it" path, the
 * windowing code would only ever run on the asset nobody tests with.
 *
 * changes[C10] emits the segmented form, and then this becomes
 * contracts.asset_manifest.segments read from the track's manifest.
 */
const DEMO_ASSET = {
  initUri: Image.resolveAssetSource(INIT)?.uri ?? '',
  segments: SEGMENTS.map(s => ({
    index: s.index,
    start_ms: s.start_ms,
    end_ms: s.end_ms,
    uri: Image.resolveAssetSource(s.mod)?.uri ?? '',
  })),
};
log(
  `INTERSTICE.asset.segments n=${DEMO_ASSET.segments.length}` +
    ` init=${DEMO_ASSET.initUri ? 'set' : 'NONE'}`,
);
const resolvedCue = Image.resolveAssetSource(CUE);
log(`INTERSTICE.asset.resolved uri=${resolved?.uri ?? 'NONE'}`);
log(`INTERSTICE.asset.cue uri=${resolvedCue?.uri ?? 'NONE'}`);

// The one place the platform is chosen. Everything below src/ that is not
// src/platform/ reaches the device only through this object — enforced by
// pipeline/__tests__/seam.test.ts, not by good intentions.
const media = createVegaAdapter();

// TEMPORARY (R34) — measures whether a byte-range fetch works on a packaged
// path, which is what limits.mse_buffer's window depends on. Removed with the
// rest of the Phase 0 instrumentation once AC23 has read it.
void probeRangeSupport(resolved?.uri ?? '');

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
        asset={DEMO_ASSET}
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
