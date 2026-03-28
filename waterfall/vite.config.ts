import { defineConfig } from 'vite';
import { resolve } from 'path';
import type { Plugin } from 'vite';

const __dirname = new URL('.', import.meta.url).pathname;
const SRC = resolve(__dirname, 'src');

/**
 * Maps clean public URLs to their real source files in src/:
 *   /waterfall/waterfall.css  →  src/waterfall.css
 *   /waterfall/index.ts       →  src/index.ts
 *
 * This keeps the component files in src/ (part of the library) while
 * letting the demo pages reference them at predictable, stable URLs.
 */
function srcAliasPlugin(): Plugin {
  const urlToFile: Record<string, string> = {
    '/waterfall/waterfall.css': resolve(SRC, 'waterfall.css'),
    '/waterfall/index.ts': resolve(SRC, 'index.ts'),
  };

  return {
    name: 'src-alias',
    resolveId(id) {
      if (id in urlToFile) return urlToFile[id];
    },
    load(id) {
      // Vite resolves the alias above; the file is loaded normally from disk.
      // No custom load logic needed — returning undefined lets Vite proceed.
      return undefined;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url in urlToFile) {
          // Rewrite the request URL so Vite's transform pipeline picks it up
          req.url = '/@fs' + urlToFile[req.url];
        }
        next();
      });
    },
  };
}

export default defineConfig({
  // Serve public/ as the web root: index.html lives at /
  root: resolve(__dirname, 'public'),

  // Source files outside root are still reachable via /@fs/... internally,
  // but we expose them through clean URLs via the plugin above.
  server: {
    fs: {
      // Allow Vite to serve files from the workspace root (one level up)
      allow: [__dirname],
    },
  },

  plugins: [srcAliasPlugin()],

  build: {
    outDir: resolve(__dirname, 'dist-demo'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'public/index.html'),
        interactive: resolve(__dirname, 'public/interactive.html'),
        'src-attr': resolve(__dirname, 'public/src-attr.html'),
      },
    },
  },
});
