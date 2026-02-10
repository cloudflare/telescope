// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: { // only used for `astro dev`: https://docs.astro.build/en/guides/integrations-guide/cloudflare/#platformproxy
      enabled: true,
      configPath: './wrangler.jsonc',
      environment: 'development',
    },

    imageService: 'cloudflare',
  }),
  vite: {
    ssr: {
      external: ['node:path', 'node:fs/promises', 'node:url', 'node:crypto'],
    },
  },
});
