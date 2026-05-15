// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';
import node from '@astrojs/node';
import react from '@astrojs/react';

// TELESCOPE_MODE selects the runtime target:
//   - 'cloudflare' (default): builds for Cloudflare Workers (D1/R2/AI)
//   - 'local':                builds for standalone Node.js (filesystem)
const mode = process.env.TELESCOPE_MODE === 'local' ? 'local' : 'cloudflare';

const adapter =
  mode === 'local'
    ? node({ mode: 'standalone' })
    : cloudflare({
        imageService: 'cloudflare',
      });

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter,
  vite: {
    // In local mode, exclude Cloudflare-only modules from the bundle.
    // They are reachable only via dynamic import in cloudflare-mode code paths.
    build:
      mode === 'local'
        ? {
            rollupOptions: {
              external: [
                'cloudflare:workers',
                '@prisma/adapter-d1',
                '@/generated/prisma/client',
                /^@\/generated\/prisma\b/,
                /^.*\/cloudflareStorage(?:\.js)?$/,
                /^.*\/d1TestStore(?:\.js)?$/,
              ],
            },
          }
        : undefined,
    plugins:
      mode === 'cloudflare'
        ? [
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
          ]
        : [],
  },
  integrations: [react()],
});
