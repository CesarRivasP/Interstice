const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

const config = {
  // The transform cache does not key on the environment, so without this a
  // Release build made after a flagged one KEEPS the flagged constant — measured
  // on 2026-10-04: four alternating builds, all four reported e2e=true. The
  // flag babel.config.js compiles in is therefore part of the cache version.
  cacheVersion: `interstice-e2e:${process.env.INTERSTICE_E2E ?? ''}`,
  resolver: {
    // `m4s` is a fragmented-MP4 media segment and is not in metro's default
    // assetExts. Without it, requiring a segment resolves as JavaScript and the
    // bundler fails on the first byte. limits.mse_buffer's window is built from
    // these, so they have to travel inside the package like any other asset.
    assetExts: [...defaultConfig.resolver.assetExts, 'm4s'],
  },
};

module.exports = mergeConfig(defaultConfig, config);
