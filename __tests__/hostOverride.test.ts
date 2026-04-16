import type { AddressInfo } from 'node:net';

import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, afterAll, describe, expect, test } from 'vitest';

import type {
  BrowserName,
  HarEntry,
  SuccessfulTestResult,
} from '../src/types.js';

import { cleanupTestDirectory, retrieveHAR } from './helpers.js';

import { launchTest } from '../src/index.js';
import { BrowserConfig } from '../src/browsers.js';

const browsers: BrowserName[] = BrowserConfig.getBrowsers();

let server: Server;
let serverPort: number;

beforeAll(async () => {
  const fixturesDir = join(
    dirname(dirname(fileURLToPath(import.meta.url))),
    'tests',
    'host-override',
  );
  server = createServer(async (req, res) => {
    if (req.url === '/style.css') {
      const data = await readFile(join(fixturesDir, 'style.css'));
      res.writeHead(200, { 'Content-Type': 'text/css' });
      res.end(data);
      return;
    }

    if (req.url === '/' || req.url === '/index.html') {
      // Dynamically generate HTML that references style.css on "cloudflare.com",
      // which the overrideHost option will remap to 127.0.0.1.
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
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as AddressInfo;
  serverPort = addr.port;
});

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

describe.each(browsers)(
  'Host override with HAR timing correlation - %s',
  (browser: BrowserName) => {
    test('HAR entries have timing data when overrideHost is used', async () => {
      const result = await launchTest({
        url: `http://127.0.0.1:${serverPort}/index.html`,
        browser,
        overrideHost: {
          [`cloudflare.com:${serverPort}`]: `127.0.0.1:${serverPort}`,
        },
      });

      expect(result.success).toBe(true);
      const testId = (result as SuccessfulTestResult).testId;

      try {
        const har = retrieveHAR(testId);
        expect(har).not.toBeNull();

        const styleCssEntries = har!.log.entries.filter((entry: HarEntry) =>
          entry.request.url.includes('/style.css'),
        );

        expect(styleCssEntries.length).toBeGreaterThanOrEqual(1);

        for (const cssEntry of styleCssEntries) {
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
      } finally {
        cleanupTestDirectory(testId);
      }
    }, 120000);
  },
);
