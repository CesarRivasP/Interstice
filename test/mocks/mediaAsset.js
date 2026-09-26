/**
 * Stub for media assets required from src/ under jest.
 *
 * `require('./assets/cue.m4a')` hands jest the raw bytes and it tries to parse
 * them as JavaScript. The kepler preset covers the image extensions and not the
 * media ones, so the media assets are mapped here through
 * jest.config.json moduleNameMapper.
 *
 * React Native's asset registry returns an opaque numeric handle, so that is
 * what this returns — a shape the code under test can pass to
 * Image.resolveAssetSource without pretending to be a real asset.
 */
module.exports = 1;
