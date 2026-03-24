// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    imageService: 'cloudflare',
  }),
  vite: {
    ssr: {
      external: [
        'node:path',
        'node:fs/promises',
        'node:url',
        'node:crypto',
        'node:process',
        'node:buffer',
        'node:module',
        'node:fs',
        'node:async_hooks',
        'node:events',
        'node:os',
      ],
    },
    optimizeDeps: {
      include: [
        '@prisma/adapter-d1',
        '@prisma/client/runtime/wasm-compiler-edge',
      ],
    },
  },
  integrations: [react()],
});
