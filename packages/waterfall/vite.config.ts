import { defineConfig, normalizePath } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import type { Plugin } from 'vite';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SRC = resolve(__dirname, 'src');
const DIST = resolve(__dirname, 'dist');

/**
 * Maps clean public URLs to real files on disk so demo pages reference the
 * same URLs that drop-in consumers will use:
 *
 *   /waterfall/waterfall.css  →  src/waterfall.css   (fast iteration — direct
 *                                                     from source, no rebuild)
 *   /waterfall/waterfall.js   →  dist/waterfall.js   (bundled artifact — run
 *                                                     `npm run build` first;
 *                                                     `predev` hook does this)
 *
 * The dual mapping (CSS from src/, JS from dist/) lets CSS edits show up
 * instantly without re-running the bundler, while keeping the JS path
 * identical to what consumers see in their own deployments.
 */
function srcAliasPlugin(): Plugin {
  const urlToFile: Record<string, string> = {
    '/waterfall/waterfall.css': resolve(SRC, 'waterfall.css'),
    '/waterfall/waterfall.js': resolve(DIST, 'waterfall.js'),
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
        if (req.url) {
          // Strip query/hash before looking up the alias — Vite appends
          // `?import`, `?t=…`, etc. to dev requests.
          const pathname = req.url.split(/[?#]/, 1)[0];
          const file = urlToFile[pathname];
          if (file) {
            // Rewrite the request URL so Vite's transform pipeline picks it
            // up. `/@fs/` expects a forward-slash, URL-safe absolute path —
            // `normalizePath` converts Windows backslashes (and drive
            // letters) into the form Vite expects, and `encodeURI` handles
            // spaces and other characters that need escaping.
            req.url = '/@fs/' + encodeURI(normalizePath(file));
          }
        }
        next();
      });
    },
  };
}

function lazyModulePlugin(): Plugin {
  return {
    name: 'lazy-module',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.filename.endsWith('index.html')) return html;
        const chunk = Object.values(ctx.bundle ?? {}).find(
          (c) => c.type === 'chunk' && c.name === 'waterfall',
        );
        if (!chunk) return html;
        return html.replace('/waterfall/waterfall.js', '/' + chunk.fileName);
      },
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
      // Allow Vite to serve files from the package root (one level above `root`).
      // dist/ and src/ live under this directory, so they're reachable too.
      allow: [__dirname],
    },
  },

  plugins: [srcAliasPlugin(), lazyModulePlugin()],

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

  // Demo-only static assets (theme.js, progressive.js, interactive.js,
  // demo.css, demo.har) live alongside the entry HTML in `public/`. They
  // are referenced from the HTML via absolute paths (e.g. `/theme.js`),
  // which Vite does not rewrite as build inputs, so we mark the same
  // directory as `publicDir` to have Vite copy them verbatim into
  // `dist-demo/`. Setting `publicDir` equal to `root` is supported; Vite
  // just excludes files listed as HTML entry inputs from the copy.
  publicDir: resolve(__dirname, 'public'),
});
