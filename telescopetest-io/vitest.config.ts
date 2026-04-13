import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/generated': path.resolve(__dirname, './generated'),
    },
  },
  test: {
    testTimeout: 10_000,
    coverage: {
      provider: 'v8',
    },
    include: ['__tests__/**/*.test.ts'],
  },
});
