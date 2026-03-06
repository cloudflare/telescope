/**
 * Theme tests — verify that background colors respond correctly to both the
 * system color-scheme preference and the data-theme override attribute.
 */

import { type Browser } from 'playwright';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import {
  createServer,
  launchBrowser,
  openPage,
  bgColor,
  WHITE,
  DARK_PANEL,
  BRAND_BLUE,
} from './helpers.js';

let browser: Browser;
let baseUrl: string;
let closeServer: () => void;

beforeAll(async () => {
  browser = await launchBrowser();
  const server = await createServer();
  baseUrl = server.url;
  closeServer = server.close;
});

afterAll(async () => {
  await browser.close();
  closeServer();
});

// ── Light-mode backgrounds ────────────────────────────────────────────────────

describe('light mode backgrounds', () => {
  it('column headers background is white', async () => {
    const page = await openPage(browser, baseUrl, 'light');
    expect(await bgColor(page, '.wf-col-headers')).toBe(WHITE);
  });

  it('inactive filter button background is white', async () => {
    const page = await openPage(browser, baseUrl, 'light', {
      htmlPage: 'index.html',
    });
    await page.waitForSelector('waterfall-chart.wf-ready, .wf-scrubber');
    expect(await bgColor(page, '.wf-filter-btn:not(.active)')).toBe(WHITE);
  });

  it('active filter button background is brand blue', async () => {
    const page = await openPage(browser, baseUrl, 'light', {
      htmlPage: 'index.html',
    });
    await page.waitForSelector('waterfall-chart.wf-ready, .wf-scrubber');
    expect(await bgColor(page, '.wf-filter-btn.active')).toBe(BRAND_BLUE);
  });

  it('toggle button background is transparent', async () => {
    const page = await openPage(browser, baseUrl, 'light', {
      htmlPage: 'index.html',
    });
    await page.waitForSelector('waterfall-chart.wf-ready, .wf-scrubber');
    expect(await bgColor(page, '.wf-toggle-cols')).toBe('rgba(0, 0, 0, 0)');
  });
});

// ── Theme override via data-theme attribute ───────────────────────────────────

describe('theme override via data-theme attribute', () => {
  it('system light, no override → white panel', async () => {
    const page = await openPage(browser, baseUrl, 'light');
    expect(await bgColor(page, '.wf-col-headers')).toBe(WHITE);
  });

  it('system dark, no override → dark panel', async () => {
    const page = await openPage(browser, baseUrl, 'dark');
    expect(await bgColor(page, '.wf-col-headers')).toBe(DARK_PANEL);
  });

  it('system dark + data-theme=light → white panel', async () => {
    const page = await openPage(browser, baseUrl, 'dark', {
      dataTheme: 'light',
    });
    expect(await bgColor(page, '.wf-col-headers')).toBe(WHITE);
  });

  it('system light + data-theme=dark → dark panel', async () => {
    const page = await openPage(browser, baseUrl, 'light', {
      dataTheme: 'dark',
    });
    expect(await bgColor(page, '.wf-col-headers')).toBe(DARK_PANEL);
  });
});
