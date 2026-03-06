/**
 * Theme tests — verify that background colors respond correctly to both the
 * system color-scheme preference and the data-theme override attribute.
 *
 * Uses Playwright as a library (Node environment) with a minimal static HTTP
 * server so no external dev server is required.
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';

// ── Static file server ────────────────────────────────────────────────────────

const ROOT = path.resolve(import.meta.dirname, '..');

function createServer(): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const filePath = path.join(
        ROOT,
        req.url === '/' ? '/static.html' : (req.url ?? ''),
      );
      try {
        const data = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        const mime: Record<string, string> = {
          '.html': 'text/html',
          '.css': 'text/css',
          '.js': 'application/javascript',
          '.json': 'application/json',
        };
        res.writeHead(200, { 'Content-Type': mime[ext] ?? 'text/plain' });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
    server.listen(0, () => {
      const addr = server.address() as { port: number };
      resolve({
        url: `http://localhost:${addr.port}`,
        close: () => server.close(),
      });
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Open a page with the given system color scheme and optional data-theme override. */
async function openPage(
  browser: Browser,
  baseUrl: string,
  systemScheme: 'light' | 'dark',
  dataTheme?: 'light' | 'dark',
): Promise<Page> {
  const ctx: BrowserContext = await browser.newContext({
    colorScheme: systemScheme,
  });
  const page = await ctx.newPage();
  await page.goto(`${baseUrl}/static.html`);
  if (dataTheme) {
    await page.evaluate(
      (t) => document.documentElement.setAttribute('data-theme', t),
      dataTheme,
    );
  }
  return page;
}

/** Return the computed background-color of the first element matching selector. */
async function bgColor(page: Page, selector: string): Promise<string> {
  return page.evaluate(
    (sel) => getComputedStyle(document.querySelector(sel)!).backgroundColor,
    selector,
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WHITE = 'rgb(255, 255, 255)'; // --wf-panel in light theme
const DARK_PANEL = 'rgb(31, 41, 55)'; // --wf-panel in dark theme  (#1f2937)
const BRAND_BLUE = 'rgb(37, 99, 235)'; // --wf-brand (#2563eb)

// ── Suite setup ───────────────────────────────────────────────────────────────

let browser: Browser;
let baseUrl: string;
let closeServer: () => void;

beforeAll(async () => {
  browser = await chromium.launch();
  const server = await createServer();
  baseUrl = server.url;
  closeServer = server.close;
});

afterAll(async () => {
  await browser.close();
  closeServer();
});

// ── Tests: light-mode backgrounds ─────────────────────────────────────────────

describe('light mode backgrounds', () => {
  it('legend background is white', async () => {
    const page = await openPage(browser, baseUrl, 'light');
    expect(await bgColor(page, '.wf-legend')).toBe(WHITE);
  });

  it('column headers background is white', async () => {
    const page = await openPage(browser, baseUrl, 'light');
    expect(await bgColor(page, '.wf-col-headers')).toBe(WHITE);
  });

  it('inactive filter button background is white', async () => {
    const page = await openPage(browser, baseUrl, 'light');
    expect(await bgColor(page, '.wf-filter-btn:not(.active)')).toBe(WHITE);
  });

  it('active filter button background is brand blue', async () => {
    const page = await openPage(browser, baseUrl, 'light');
    expect(await bgColor(page, '.wf-filter-btn.active')).toBe(BRAND_BLUE);
  });

  it('toggle button background is white', async () => {
    const page = await openPage(browser, baseUrl, 'light');
    expect(await bgColor(page, '.wf-toggle-cols')).toBe(WHITE);
  });
});

// ── Tests: theme override ─────────────────────────────────────────────────────

describe('theme override via data-theme attribute', () => {
  it('system light, no override → white panel', async () => {
    const page = await openPage(browser, baseUrl, 'light');
    expect(await bgColor(page, '.wf-legend')).toBe(WHITE);
  });

  it('system dark, no override → dark panel', async () => {
    const page = await openPage(browser, baseUrl, 'dark');
    expect(await bgColor(page, '.wf-legend')).toBe(DARK_PANEL);
  });

  it('system dark + data-theme=light → white panel', async () => {
    const page = await openPage(browser, baseUrl, 'dark', 'light');
    expect(await bgColor(page, '.wf-legend')).toBe(WHITE);
  });

  it('system light + data-theme=dark → dark panel', async () => {
    const page = await openPage(browser, baseUrl, 'light', 'dark');
    expect(await bgColor(page, '.wf-legend')).toBe(DARK_PANEL);
  });
});
