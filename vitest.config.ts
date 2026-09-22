import { defineConfig } from 'vitest/config';

// The pipeline half only. The Vega app is tested by jest (jest.config.json),
// which the platform preset requires — see _facts.yml limits.vega_media.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['pipeline/__tests__/**/*.test.ts'],
  },
});
