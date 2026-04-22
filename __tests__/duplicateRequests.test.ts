import type { AddressInfo } from 'node:net';

import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, afterAll, describe, expect, test } from 'vitest';

import type {
  BrowserName,
  HarData,
  HarEntry,
  LaunchOptions,
  SuccessfulTestResult,
} from '../src/types.js';

import { cleanupTestDirectory, retrieveHAR } from './helpers.js';

import { launchTest } from '../src/index.js';
import { BrowserConfig } from '../src/browsers.js';

const browsers: BrowserName[] = BrowserConfig.getBrowsers();

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function fixturesDir(name: string): string {
  return join(projectRoot, 'tests', name);
}

/**
 * Launches a test, asserts success, retrieves the HAR, and cleans up the test
 * directory after the callback finishes (even on failure).
 */
async function withHAR(
  options: LaunchOptions,
  callback: (har: HarData) => void,
): Promise<void> {
  const result = await launchTest(options);
  expect(result.success).toBe(true);

  const testId = (result as SuccessfulTestResult).testId;
  try {
    const har = retrieveHAR(testId);
    expect(har).not.toBeNull();
    callback(har!);
  } finally {
    cleanupTestDirectory(testId);
  }
}

function styleCssEntries(har: HarData): HarEntry[] {
  return har.log.entries.filter((entry: HarEntry) =>
    entry.request.url.includes('/style.css'),
  );
}

/**
 * Creates a static-file HTTP server that serves the given allowed files from
 * the specified fixtures directory. Call `listen()` to start it.
 */
function createStaticServer(
  fixturesDirPath: string,
  allowedFiles: string[],
): Server {
  return createServer(async (req, res) => {
    const fileName = allowedFiles.find(
      f => req.url === '/' + f || (f === 'index.html' && req.url === '/'),
    );
    if (!fileName) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const filePath = join(fixturesDirPath, fileName);
    try {
      const data = await readFile(filePath);
      const mimeTypes: Record<string, string> = {
        html: 'text/html',
        css: 'text/css',
      };
      const ext = filePath.split('.').pop() ?? '';
      const contentType = mimeTypes[ext] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });
}

async function listen(srv: Server): Promise<string> {
  await new Promise<void>(resolve => srv.listen(0, '127.0.0.1', resolve));
  const addr = srv.address() as AddressInfo;
  return `http://127.0.0.1:${addr.port}`;
}

async function close(srv: Server): Promise<void> {
  await new Promise<void>(resolve => srv.close(() => resolve()));
}

// ---------------------------------------------------------------------------
// Duplicate request HAR entries
// ---------------------------------------------------------------------------

describe('Duplicate request HAR entries', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createStaticServer(fixturesDir('duplicate-requests'), [
      'index.html',
      'style.css',
    ]);
    baseUrl = await listen(server);
  });

  afterAll(async () => {
    await close(server);
  });

  describe.each(browsers)('%s', (browser: BrowserName) => {
    test('each duplicate-URL HAR entry gets its own timing data', async () => {
      await withHAR({ url: `${baseUrl}/index.html`, browser }, har => {
        const entries = styleCssEntries(har);
        expect(entries.length).toBe(3);

        const entriesWithTimingData = entries.filter(
          (entry: HarEntry) => entry._dns_start !== undefined,
        );
        expect(entriesWithTimingData.length).toBe(entries.length);
      });
    }, 120000);
  });
});

// ---------------------------------------------------------------------------
// Host override with HAR timing correlation
// ---------------------------------------------------------------------------

describe('Host override with HAR timing correlation', () => {
  let server: Server;
  let serverPort: number;

  beforeAll(async () => {
    const dir = fixturesDir('host-override');
    server = createServer(async (req, res) => {
      if (req.url === '/style.css') {
        const data = await readFile(join(dir, 'style.css'));
        res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end(data);
        return;
      }

      if (req.url === '/' || req.url === '/index.html') {
        const addr = server.address() as AddressInfo;
        const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Host Override Test</title>
    <link rel="stylesheet" href="http://cloudflare.com:${addr.port}/style.css" />
  </head>
  <body>
    <h1>Host override test page</h1>
  </body>
</html>`;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });
    const url = await listen(server);
    serverPort = Number(new URL(url).port);
  });

  afterAll(async () => {
    await close(server);
  });

  describe.each(browsers)('%s', (browser: BrowserName) => {
    test('HAR entries have timing data when overrideHost is used', async () => {
      await withHAR(
        {
          url: `http://127.0.0.1:${serverPort}/index.html`,
          browser,
          overrideHost: {
            [`cloudflare.com:${serverPort}`]: `127.0.0.1:${serverPort}`,
          },
        },
        har => {
          const entries = styleCssEntries(har);
          expect(entries.length).toBeGreaterThanOrEqual(1);

          for (const cssEntry of entries) {
            expect(cssEntry).toMatchObject({
              request: {
                url: `http://127.0.0.1:${serverPort}/style.css`,
              },
              response: {
                status: 200,
              },
              timings: {
                dns: expect.any(Number),
                connect: expect.any(Number),
                ssl: expect.any(Number),
                send: expect.any(Number),
                wait: expect.any(Number),
                receive: expect.any(Number),
              },
            });
          }
        },
      );
    }, 120000);
  });
});
