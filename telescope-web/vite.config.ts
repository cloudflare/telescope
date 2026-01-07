import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig } from 'vite';
import Busboy from 'busboy';
import AdmZip from 'adm-zip';
import { BrowserConfig } from '../lib/browsers.js';
import { DEFAULT_OPTIONS } from '../lib/defaultOptions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..');
const resultsRoot = path.join(repoRoot, 'results');

type ApiHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>,
) => void | Promise<void>;

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body, null, 2));
}

function sendText(res: ServerResponse, status: number, body: string) {
  res.statusCode = status;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.end(body);
}

function safeResolveUnder(root: string, ...parts: string[]) {
  const abs = path.resolve(root, ...parts);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (!abs.startsWith(rootWithSep)) {
    throw new Error('Path traversal blocked');
  }
  return abs;
}

function parseUrl(req: IncomingMessage) {
  const host = req.headers.host ?? 'localhost';
  return new URL(req.url ?? '/', `http://${host}`);
}

function matchRoute(
  pathname: string,
  route: string,
): { ok: boolean; params: Record<string, string> } {
  const a = pathname.split('/').filter(Boolean);
  const b = route.split('/').filter(Boolean);
  if (a.length !== b.length) return { ok: false, params: {} };
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    const seg = b[i];
    if (seg.startsWith(':')) {
      params[seg.slice(1)] = decodeURIComponent(a[i]);
    } else if (seg !== a[i]) {
      return { ok: false, params: {} };
    }
  }
  return { ok: true, params };
}

function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

export default defineConfig({
  appType: 'spa',
  server: {
    fs: {
      // allow reading repo-root files from middleware (we read them via fs, but this keeps dev ergonomics)
      allow: [repoRoot],
    },
  },
  plugins: [
    {
      name: 'telescope-api',
      configureServer(server) {
        const routes: Array<{ method: string; path: string; handler: ApiHandler }> =
          [
            {
              method: 'GET',
              path: '/api/readme',
              handler(_req, res) {
                const readmePath = path.join(repoRoot, 'README.md');
                if (!fs.existsSync(readmePath)) {
                  return sendJson(res, 404, { error: 'README.md not found' });
                }
                const markdown = fs.readFileSync(readmePath, 'utf-8');
                return sendJson(res, 200, { markdown });
              },
            },
            {
              method: 'GET',
              path: '/api/browsers',
              handler(_req, res) {
                return sendJson(res, 200, { browsers: BrowserConfig.getBrowsers() });
              },
            },
            {
              method: 'GET',
              path: '/api/options',
              handler(_req, res) {
                return sendJson(res, 200, { defaults: DEFAULT_OPTIONS });
              },
            },
            {
              method: 'GET',
              path: '/api/results',
              handler(_req, res) {
                if (!fs.existsSync(resultsRoot)) {
                  return sendJson(res, 200, { results: [] });
                }
                const dirs = fs
                  .readdirSync(resultsRoot, { withFileTypes: true })
                  .filter(d => d.isDirectory())
                  .map(d => d.name)
                  .sort()
                  .reverse();

                const results = dirs
                  .map(dirName => {
                    const configPath = path.join(resultsRoot, dirName, 'config.json');
                    if (!fs.existsSync(configPath)) return null;
                    const cfg = readJsonFile<any>(configPath);
                    const browser =
                      cfg?.options?.browser ?? cfg?.browserConfig?.channel ?? 'unknown';
                    const url = cfg?.url ?? cfg?.options?.url ?? '';
                    const runTime = cfg?.date ?? '';
                    const screenshotPath = path.join(
                      resultsRoot,
                      dirName,
                      'screenshot.png',
                    );
                    const hasScreenshot = fs.existsSync(screenshotPath);
                    return {
                      testId: dirName,
                      url,
                      runTime,
                      browser,
                      screenshotUrl: hasScreenshot
                        ? `/api/results/${encodeURIComponent(dirName)}/screenshot.png`
                        : null,
                    };
                  })
                  .filter(Boolean);

                return sendJson(res, 200, { results });
              },
            },
            {
              method: 'GET',
              path: '/api/results/:testId/config',
              handler(_req, res, params) {
                try {
                  const dir = safeResolveUnder(resultsRoot, params.testId);
                  const configPath = path.join(dir, 'config.json');
                  if (!fs.existsSync(configPath)) {
                    return sendJson(res, 404, { error: 'config.json not found' });
                  }
                  return sendJson(res, 200, readJsonFile<any>(configPath));
                } catch (e: any) {
                  return sendJson(res, 400, { error: e?.message ?? 'Bad request' });
                }
              },
            },
            {
              method: 'GET',
              path: '/api/results/:testId/screenshot.png',
              handler(_req, res, params) {
                try {
                  const dir = safeResolveUnder(resultsRoot, params.testId);
                  const filePath = path.join(dir, 'screenshot.png');
                  if (!fs.existsSync(filePath)) {
                    res.statusCode = 404;
                    return res.end();
                  }
                  res.statusCode = 200;
                  res.setHeader('content-type', 'image/png');
                  fs.createReadStream(filePath).pipe(res);
                } catch (_e) {
                  res.statusCode = 400;
                  res.end();
                }
              },
            },
            {
              method: 'GET',
              path: '/api/results/:testId/metrics',
              handler(_req, res, params) {
                try {
                  const dir = safeResolveUnder(resultsRoot, params.testId);
                  const filePath = path.join(dir, 'metrics.json');
                  if (!fs.existsSync(filePath)) {
                    return sendJson(res, 404, { error: 'metrics.json not found' });
                  }
                  return sendJson(res, 200, readJsonFile<any>(filePath));
                } catch (e: any) {
                  return sendJson(res, 400, { error: e?.message ?? 'Bad request' });
                }
              },
            },
            {
              method: 'GET',
              path: '/api/results/:testId/console',
              handler(_req, res, params) {
                try {
                  const dir = safeResolveUnder(resultsRoot, params.testId);
                  const filePath = path.join(dir, 'console.json');
                  if (!fs.existsSync(filePath)) {
                    return sendJson(res, 404, { error: 'console.json not found' });
                  }
                  return sendJson(res, 200, readJsonFile<any[]>(filePath));
                } catch (e: any) {
                  return sendJson(res, 400, { error: e?.message ?? 'Bad request' });
                }
              },
            },
            {
              method: 'GET',
              path: '/api/results/:testId/resources',
              handler(_req, res, params) {
                try {
                  const dir = safeResolveUnder(resultsRoot, params.testId);
                  const filePath = path.join(dir, 'resources.json');
                  if (!fs.existsSync(filePath)) {
                    return sendJson(res, 404, { error: 'resources.json not found' });
                  }
                  return sendJson(res, 200, readJsonFile<any>(filePath));
                } catch (e: any) {
                  return sendJson(res, 400, { error: e?.message ?? 'Bad request' });
                }
              },
            },
            {
              method: 'GET',
              path: '/api/results/:testId/har',
              handler(_req, res, params) {
                try {
                  const dir = safeResolveUnder(resultsRoot, params.testId);
                  const filePath = path.join(dir, 'pageload.har');
                  if (!fs.existsSync(filePath)) {
                    return sendJson(res, 404, { error: 'pageload.har not found' });
                  }
                  return sendJson(res, 200, readJsonFile<any>(filePath));
                } catch (e: any) {
                  return sendJson(res, 400, { error: e?.message ?? 'Bad request' });
                }
              },
            },
            {
              method: 'GET',
              path: '/api/results/:testId/filmstrip',
              handler(_req, res, params) {
                try {
                  const dir = safeResolveUnder(resultsRoot, params.testId);
                  const filmstripDir = path.join(dir, 'filmstrip');
                  if (!fs.existsSync(filmstripDir)) {
                    return sendJson(res, 200, { images: [] });
                  }
                  const files = fs
                    .readdirSync(filmstripDir)
                    .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
                    .sort();
                  const images = files.map(f => ({
                    name: f,
                    url: `/api/results/${encodeURIComponent(params.testId)}/filmstrip/${encodeURIComponent(f)}`,
                  }));
                  return sendJson(res, 200, { images });
                } catch (e: any) {
                  return sendJson(res, 400, { error: e?.message ?? 'Bad request' });
                }
              },
            },
            {
              method: 'GET',
              path: '/api/results/:testId/filmstrip/:filename',
              handler(_req, res, params) {
                try {
                  const dir = safeResolveUnder(resultsRoot, params.testId);
                  const filePath = safeResolveUnder(
                    path.join(dir, 'filmstrip'),
                    params.filename,
                  );
                  if (!fs.existsSync(filePath)) {
                    res.statusCode = 404;
                    return res.end();
                  }
                  res.statusCode = 200;
                  const ext = path.extname(params.filename).toLowerCase();
                  const mimes: Record<string, string> = {
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.webp': 'image/webp',
                  };
                  res.setHeader('content-type', mimes[ext] || 'image/jpeg');
                  fs.createReadStream(filePath).pipe(res);
                } catch (_e) {
                  res.statusCode = 400;
                  res.end();
                }
              },
            },
            {
              method: 'GET',
              path: '/api/results/:testId/video',
              handler(_req, res, params) {
                try {
                  const dir = safeResolveUnder(resultsRoot, params.testId);
                  const files = fs.readdirSync(dir).filter(f => /\.(webm|mp4)$/i.test(f));
                  if (!files.length) {
                    return sendJson(res, 404, { error: 'Video not found' });
                  }
                  const videoFile = files[0];
                  const filePath = path.join(dir, videoFile);
                  res.statusCode = 200;
                  const ext = path.extname(videoFile).toLowerCase();
                  res.setHeader('content-type', ext === '.webm' ? 'video/webm' : 'video/mp4');
                  fs.createReadStream(filePath).pipe(res);
                } catch (_e) {
                  res.statusCode = 400;
                  res.end();
                }
              },
            },
            {
              method: 'GET',
              path: '/api/results/:testId/video/info',
              handler(_req, res, params) {
                try {
                  const dir = safeResolveUnder(resultsRoot, params.testId);
                  const files = fs.readdirSync(dir).filter(f => /\.(webm|mp4)$/i.test(f));
                  if (!files.length) {
                    return sendJson(res, 404, { error: 'Video not found' });
                  }
                  const videoFile = files[0];
                  return sendJson(res, 200, {
                    filename: videoFile,
                    url: `/api/results/${encodeURIComponent(params.testId)}/video`,
                  });
                } catch (e: any) {
                  return sendJson(res, 400, { error: e?.message ?? 'Bad request' });
                }
              },
            },
            {
              method: 'GET',
              path: '/api/results/:testId/download',
              handler(_req, res, params) {
                try {
                  const dir = safeResolveUnder(resultsRoot, params.testId);
                  if (!fs.existsSync(dir)) {
                    return sendJson(res, 404, { error: 'Test results not found' });
                  }

                  // Create zip in memory
                  const zip = new AdmZip();
                  zip.addLocalFolder(dir, params.testId);

                  // Set headers for download
                  const zipBuffer = zip.toBuffer();
                  res.statusCode = 200;
                  res.setHeader('content-type', 'application/zip');
                  res.setHeader(
                    'content-disposition',
                    `attachment; filename="${params.testId}.zip"`,
                  );
                  res.setHeader('content-length', zipBuffer.length.toString());
                  res.end(zipBuffer);
                } catch (e: any) {
                  return sendJson(res, 400, { error: e?.message ?? 'Bad request' });
                }
              },
            },
            {
              method: 'POST',
              path: '/api/upload',
              handler(req, res) {
                const contentType = req.headers['content-type'] ?? '';
                if (!contentType.includes('multipart/form-data')) {
                  return sendJson(res, 415, {
                    error: 'Expected multipart/form-data (zip upload).',
                  });
                }

                const uploadsDir = path.join(repoRoot, 'uploads');
                if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

                const bb = Busboy({ headers: req.headers });
                let savedPath: string | null = null;
                let fileCount = 0;

                bb.on('file', (_name, file, info) => {
                  fileCount++;
                  const ext = path.extname(info.filename || '').toLowerCase();
                  if (ext !== '.zip') {
                    file.resume();
                    return;
                  }
                  const outName = `${Date.now()}_${Math.random()
                    .toString(16)
                    .slice(2)}.zip`;
                  const outPath = path.join(uploadsDir, outName);
                  savedPath = outPath;
                  file.pipe(fs.createWriteStream(outPath));
                });

                bb.on('close', () => {
                  if (fileCount === 0) {
                    return sendJson(res, 400, { error: 'No file provided.' });
                  }
                  if (!savedPath) {
                    return sendJson(res, 400, { error: 'Only .zip files accepted.' });
                  }
                  return sendJson(res, 200, {
                    ok: true,
                    savedAs: path.relative(repoRoot, savedPath),
                  });
                });

                req.pipe(bb);
              },
            },
          ];

        server.middlewares.use((req, res, next) => {
          const url = parseUrl(req);
          const pathname = url.pathname;
          const method = (req.method || 'GET').toUpperCase();

          for (const r of routes) {
            if (r.method !== method) continue;
            const { ok, params } = matchRoute(pathname, r.path);
            if (!ok) continue;
            Promise.resolve(r.handler(req, res, params)).catch((e: any) => {
              sendText(res, 500, e?.stack || e?.message || 'Internal error');
            });
            return;
          }

          next();
        });
      },
    },
  ],
});


