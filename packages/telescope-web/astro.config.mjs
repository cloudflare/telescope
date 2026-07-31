// @ts-check
import { fileURLToPath } from 'node:url';

import cloudflare from '@astrojs/cloudflare';
import node from '@astrojs/node';
import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

const deployTarget = process.env.DEPLOY_TARGET ?? 'node';
if (deployTarget !== 'node' && deployTarget !== 'cloudflare') {
  throw new Error(`Unsupported DEPLOY_TARGET: ${deployTarget}`);
}
const isCloudflare = deployTarget === 'cloudflare';

export default defineConfig({
  output: 'server',
  adapter: isCloudflare
    ? cloudflare({ imageService: 'cloudflare' })
    : node({ mode: 'standalone' }),
  vite: {
    resolve: {
      alias: {
        '@/lib/runtime/current': fileURLToPath(
          new URL(
            `./src/lib/runtime/${isCloudflare ? 'cloudflare' : 'node'}.ts`,
            import.meta.url,
          ),
        ),
      },
    },
  },
  integrations: [react()],
});
