import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node environment — tests use Playwright as a library to drive a browser
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
  },
});
