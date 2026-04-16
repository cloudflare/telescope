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

import { retrieveHAR } from './helpers.js';

import { launchTest } from '../src/index.js';
import { BrowserConfig } from '../src/browsers.js';

const browsers: BrowserName[] = BrowserConfig.getBrowsers();

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const allowedFiles = ['index.html', 'style.css'];

  const fixturesDir = join(
    dirname(dirname(fileURLToPath(import.meta.url))),
    'tests',
    'duplicate-requests',
  );
  server = createServer(async (req, res) => {
    const fileName = allowedFiles.find(
      f => req.url === '/' + f || (f === 'index.html' && req.url === '/'),
    );
    if (!fileName) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const filePath = join(fixturesDir, fileName);
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
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

describe.each(browsers)(
  'Duplicate request HAR entries - %s',
  (browser: BrowserName) => {
    test('each duplicate-URL HAR entry gets its own timing data', async () => {
      const result = await launchTest({
        url: `${baseUrl}/index.html`,
        browser,
      });

      expect(result.success).toBe(true);

      const har = retrieveHAR((result as SuccessfulTestResult).testId);
      expect(har).not.toBeNull();

      const styleCssEntries = har!.log.entries.filter((entry: HarEntry) =>
        entry.request.url.endsWith('/style.css'),
      );

      // The page loads style.css via <link> and fetches it twice via JS,
      // so we expect at least 2 HAR entries (browser may serve the 2nd from cache,
      // but we should see at least 2 entries with the same URL in the HAR)
      expect(styleCssEntries.length).toBeGreaterThanOrEqual(2);

      // Each entry for the same URL should have its own timing data populated
      const entriesWithTimingData = styleCssEntries.filter(
        (entry: HarEntry) => entry._dns_start !== undefined,
      );

      expect(entriesWithTimingData.length).toBe(styleCssEntries.length);
    }, 120000);
  },
);
