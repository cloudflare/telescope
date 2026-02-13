import type { AddressInfo } from 'node:net';

import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DelayMethod } from '../src/delay.js';
import type { ResourceTiming } from '../src/types.js';
import type { SuccessfulTestResult } from '../src/index.js';

import { launchTest } from '../src/index.js';
import { BrowserConfig } from '../src/browsers.js';

const browsers = BrowserConfig.getBrowsers();

let server: Server;
let baseUrl: string;

const DELAY = 2000;

beforeAll(async () => {
  const allowedFiles = ['index.html', 'delayed_style.css', 'telescope.png'];

  const fixturesDir = join(
    dirname(dirname(fileURLToPath(import.meta.url))),
    'tests',
    'delay',
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
        png: 'image/png',
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

describe.each(browsers)('Delaying response - %s', browser => {
  const delayMethods: DelayMethod[] = ['continue', 'fulfill'];

  test.each(delayMethods)(
    `launchTest delays .CSS responses by ${DELAY}ms (using "%s" method)`,
    async (delayImplementationName: DelayMethod) => {
      const result = await launchTest({
        url: `${baseUrl}/index.html`,
        browser: browser,
        // debug: true,
        list: true,
        delay: { 'delayed_style.css$': DELAY },
        delayUsing: delayImplementationName,
      });

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('testId');
      expect(result).toHaveProperty('resultsPath');

      expect(
        (result as SuccessfulTestResult).runner.resourceTimings
          .filter((r: ResourceTiming) => r.name.match('telescope.png$'))
          .every((r: ResourceTiming) => r.startTime >= DELAY),
      ).toBe(true);

      /**
       * ResourceTiming durations are not pupulated properly when using delay:
       * - firefox when using 'fulfill' method
       * - safari when using 'continue' method
       *
       * This can be improved in the future
       */
      const resourceTimingDurationSupported =
        !(browser === 'firefox' && delayImplementationName === 'fulfill') &&
        !(browser === 'safari' && delayImplementationName === 'continue');

      expect(
        (result as SuccessfulTestResult).runner.resourceTimings
          .filter((r: ResourceTiming) => r.name.match('.css$'))
          .every((r: ResourceTiming) => r.duration >= DELAY),
      ).toBe(resourceTimingDurationSupported);
    },
    DELAY + 2000,
  );
});
