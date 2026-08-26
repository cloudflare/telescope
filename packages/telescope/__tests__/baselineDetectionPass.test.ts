import { createServer } from 'node:http';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { Page } from 'playwright';

import { runBaselineDetectionPass } from '../src/baselineDetectionPass.js';
import { BrowserConfig } from '../src/browsers.js';
import type { BrowserName } from '../src/types.js';
import { listenServer, shutdownServer } from './testServer.js';

const browsers: BrowserName[] = BrowserConfig.getBrowsers();
let baseUrl: string;
const server = createServer((request, response) => {
  if (request.url === '/blocked.js') {
    response.writeHead(200, { 'Content-Type': 'application/javascript' });
    response.end(`
      const style = document.createElement('style');
      style.textContent = '.blocked-script {}';
      document.head.append(style);
    `);
    return;
  }

  const hasHeader = request.headers['x-baseline-test'] === 'expected';
  const hasCookie = request.headers.cookie?.includes('session=expected');
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.end(`
    ${hasHeader && hasCookie ? '<style>.request-context {}</style>' : ''}
    <script src="/blocked.js"></script>
  `);
});

beforeAll(async () => {
  baseUrl = await listenServer(server);
});

afterAll(async () => {
  await shutdownServer(server);
});

describe.each(browsers)('Baseline detection pass (%s)', browserName => {
  test('mirrors request context and applies page preparation before collecting inline CSS', async () => {
    const browserConfig = new BrowserConfig(browserName).getBrowserConfig(
      browserName,
      { url: baseUrl },
    );

    const sources = await runBaselineDetectionPass({
      browserConfig,
      cookies: {
        name: 'session',
        value: 'expected',
        url: baseUrl,
      },
      headers: { 'x-baseline-test': 'expected' },
      preparePage: async (page: Page) => {
        await page.route('**/blocked.js', route => route.abort());
      },
      timeout: 10_000,
      url: baseUrl,
    });

    expect(sources).toEqual({
      inlineCSSSources: [
        {
          css: '.request-context {}',
          file: `${baseUrl}/ (inline style #1)`,
        },
      ],
    });
  }, 120_000);
});
