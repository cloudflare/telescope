import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Connect } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(__dirname, 'src');

// Route mapping: route path -> file path
const routeMap: Record<string, string> = {
  '/': resolve(srcDir, 'pages/index.html'),
  '/index': resolve(srcDir, 'pages/index.html'),
  '/home': resolve(srcDir, 'pages/index.html'),
  '/basic': resolve(srcDir, 'pages/basic.html'),
  '/advanced': resolve(srcDir, 'pages/advanced.html'),
  '/results': resolve(srcDir, 'pages/results.html'),
  '/upload': resolve(srcDir, 'pages/upload.html'),
  '/data/overview': resolve(srcDir, 'pages/data/overview.html'),
  '/data/filmstrip-video': resolve(srcDir, 'pages/data/filmstrip-video.html'),
  '/data/metrics': resolve(srcDir, 'pages/data/metrics.html'),
  '/data/waterfall': resolve(srcDir, 'pages/data/waterfall.html'),
  '/data/critical-path': resolve(srcDir, 'pages/data/critical-path.html'),
  '/data/console': resolve(srcDir, 'pages/data/console.html'),
  '/data/resources': resolve(srcDir, 'pages/data/resources.html'),
  '/data/bottlenecks': resolve(srcDir, 'pages/data/bottlenecks.html'),
  '/data/config': resolve(srcDir, 'pages/data/config.html'),
  '/img/chrome.png': resolve(srcDir, 'pages/img/chrome.png'),
  '/img/chrome-beta.png': resolve(srcDir, 'pages/img/chrome-beta.png'),
  '/img/chrome-canary.png': resolve(srcDir, 'pages/img/chrome-canary.png'),
  '/img/msedge.png': resolve(srcDir, 'pages/img/msedge.png'),
  '/img/webkit.png': resolve(srcDir, 'pages/img/webkit.png'),
  '/img/firefox.png': resolve(srcDir, 'pages/img/firefox.png'),
  '/style.css': resolve(srcDir, 'pages/style.css'),
  '/favicon.svg': resolve(srcDir, 'pages/favicon.svg'),
};

// Build input: use route paths as entry names
const buildInput: Record<string, string> = {};
for (const [route, filePath] of Object.entries(routeMap)) {
  if (existsSync(filePath)) {
    const entryName = route === '/' ? 'index' : route.slice(1).replace(/\//g, '-');
    buildInput[entryName] = filePath;
  }
}

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: buildInput,
    },
  },
  resolve: {
    alias: {
      '@': srcDir,
    },
  },
  server: {
    port: 3000,
    open: true,
    // Middleware to handle route mapping
    middlewareMode: false,
  },
  preview: {
    port: 3000,
  },
  plugins: [
    {
      name: 'route-mapper',
      configureServer(server) {
        server.middlewares.use((req: Connect.IncomingMessage, res, next) => {
          const url = req.url?.split('?')[0] || '/';
          
          // Check if this is a route that needs mapping
          if (routeMap[url] && existsSync(routeMap[url])) {
            // Rewrite the request to the actual file
            (req as any).url = routeMap[url].replace(srcDir, '');
          }
          
          next();
        });
      },
      generateBundle(options, bundle) {
        // Rewrite HTML file output paths to match routes
        for (const [fileName, chunk] of Object.entries(bundle)) {
          if (chunk.type === 'asset' && fileName.endsWith('.html')) {
            // Find the route for this file
            for (const [route, filePath] of Object.entries(routeMap)) {
              const relativePath = filePath.replace(srcDir + '/', '');
              if (fileName.includes(relativePath.replace('.html', ''))) {
                const newFileName = route === '/' ? 'index.html' : `${route.slice(1)}.html`;
                if (newFileName !== fileName) {
                  // Rename the chunk
                  delete bundle[fileName];
                  bundle[newFileName] = chunk;
                  chunk.fileName = newFileName;
                }
                break;
              }
            }
          }
        }
      },
    },
  ],
});

