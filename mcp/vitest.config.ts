import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // The integration check opens a real browser, which is slower than a unit test.
    testTimeout: 60_000,
    hookTimeout: 240_000,
  },
});
