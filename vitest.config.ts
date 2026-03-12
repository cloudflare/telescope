import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 10_000,
    maxWorkers: 1,
    coverage: {
      provider: 'v8',
    },
    include: ['__tests__/**/*.test.ts'],
  },
});
