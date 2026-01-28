// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },

    imageService: 'cloudflare',
  }),
  vite: {
    ssr: {
      external: ['node:path', 'node:fs/promises', 'node:url', 'node:crypto']
    }
  }
});
