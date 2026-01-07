import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Connect } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(__dirname, 'src');
const resultsDir = resolve(__dirname, '../results');

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
        // API endpoint for listing results
        server.middlewares.use('/api/results', (req: Connect.IncomingMessage, res, next) => {
          const url = req.url || '';
          
          // Handle listing all result directories
          if (url === '' || url === '/') {
            try {
              if (!existsSync(resultsDir)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify([]));
                return;
              }
              
              const dirs = readdirSync(resultsDir).filter((dir) => {
                const dirPath = resolve(resultsDir, dir);
                return statSync(dirPath).isDirectory();
              });
              
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(dirs));
              return;
            } catch (error) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Failed to read results directory' }));
              return;
            }
          }
          
          // Handle listing files in a result directory
          const listMatch = url.match(/^\/([^/]+)\/list$/);
          if (listMatch) {
            const [, testId] = listMatch;
            const testDir = resolve(resultsDir, testId);
            
            try {
              if (!existsSync(testDir) || !statSync(testDir).isDirectory()) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Test directory not found' }));
                return;
              }
              
              const files = readdirSync(testDir).filter((file) => {
                const filePath = resolve(testDir, file);
                return statSync(filePath).isFile();
              });
              
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(files));
              return;
            } catch (error) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Failed to read directory' }));
              return;
            }
          }
          
          // Handle fetching specific result files
          const match = url.match(/^\/([^/]+)\/(.+)$/);
          if (match) {
            const [, testId, filePath] = match;
            const fileFullPath = resolve(resultsDir, testId, filePath);
            
            // Security check: ensure file is within results directory
            if (!fileFullPath.startsWith(resultsDir)) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Forbidden' }));
              return;
            }
            
            if (existsSync(fileFullPath) && statSync(fileFullPath).isFile()) {
              const content = readFileSync(fileFullPath);
              const ext = filePath.split('.').pop()?.toLowerCase();
              
              let contentType = 'application/octet-stream';
              if (ext === 'json') contentType = 'application/json';
              else if (ext === 'png') contentType = 'image/png';
              else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
              else if (ext === 'webm') contentType = 'video/webm';
              else if (ext === 'har') contentType = 'application/json';
              
              res.writeHead(200, { 'Content-Type': contentType });
              res.end(content);
              return;
            } else {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'File not found' }));
              return;
            }
          }
          
          next();
        });
        
        // Route mapping middleware
        server.middlewares.use((req: Connect.IncomingMessage, res, next) => {
          const url = req.url?.split('?')[0] || '/';
          
          // Skip API routes
          if (url.startsWith('/api/')) {
            next();
            return;
          }
          
          // Handle dynamic routes: /data/{page}/{testId}
          const dataPageMatch = url.match(/^\/data\/([^/]+)\/(.+)$/);
          if (dataPageMatch) {
            const [, pageName, testId] = dataPageMatch;
            const pageNames = ['overview', 'filmstrip-video', 'metrics', 'waterfall', 'console', 'resources', 'bottlenecks', 'config'];
            
            // Verify it's a valid page name
            if (pageNames.includes(pageName)) {
              // Map page name to file path (filmstrip-video -> filmstrip-video.html)
              const htmlFile = `${pageName}.html`;
              const filePath = resolve(srcDir, 'pages/data', htmlFile);
              
              if (existsSync(filePath)) {
                (req as any).url = `/pages/data/${htmlFile}`;
                next();
                return;
              }
            }
          }
          
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

