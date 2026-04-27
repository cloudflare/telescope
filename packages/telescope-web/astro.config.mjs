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
    plugins: [
      {
        name: 'pre-compile-deps',
        configEnvironment(name) {
          if (name !== 'client') {
            return {
              optimizeDeps: {
                // wasm-compiler-edge must never be bundled by esbuild — it contains a ?module import that only workerd can handle natively
                // https://docs.astro.build/en/guides/integrations-guide/cloudflare/#cloudflare-module-imports
                // https://developers.cloudflare.com/workers/wrangler/bundling/#including-non-javascript-modules
                exclude: ['@prisma/client/runtime/wasm-compiler-edge'],
              },
            };
          }
        },
      },
    ],
  },
  integrations: [react()],
});
