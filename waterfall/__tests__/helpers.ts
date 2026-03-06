/**
 * Shared test helpers — static file server + Playwright page factories.
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, type Browser, type Page } from 'playwright';

export const ROOT = path.resolve(import.meta.dirname, '..');

// ── Static file server ────────────────────────────────────────────────────────

export function createServer(): Promise<{ url: string; close: () => void }> {
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

// ── Browser / page helpers ────────────────────────────────────────────────────

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch();
}

/**
 * Open static.html with the given system color-scheme.
 * If `storedTheme` is provided it is written to localStorage before navigation,
 * simulating a returning user with a saved preference.
 * If `dataTheme` is provided it is set on <html> after navigation (useful for
 * tests that set the override directly rather than via localStorage).
 */
export async function openPage(
  browser: Browser,
  baseUrl: string,
  systemScheme: 'light' | 'dark',
  opts: {
    storedTheme?: 'light' | 'dark';
    dataTheme?: 'light' | 'dark';
    /** Which demo page to load. Defaults to 'static.html'. */
    htmlPage?: 'static.html' | 'index.html' | 'progressive.html';
  } = {},
): Promise<Page> {
  const ctx = await browser.newContext({ colorScheme: systemScheme });
  const page = await ctx.newPage();

  if (opts.storedTheme) {
    await page.addInitScript(
      (v) => localStorage.setItem('wf-theme', v),
      opts.storedTheme,
    );
  }

  await page.goto(`${baseUrl}/${opts.htmlPage ?? 'static.html'}`);

  if (opts.dataTheme) {
    await page.evaluate(
      (t) => document.documentElement.setAttribute('data-theme', t),
      opts.dataTheme,
    );
  }

  return page;
}

/** Return the computed background-color of the first element matching selector. */
export async function bgColor(page: Page, selector: string): Promise<string> {
  return page.evaluate(
    (sel) => getComputedStyle(document.querySelector(sel)!).backgroundColor,
    selector,
  );
}

// ── Color constants ───────────────────────────────────────────────────────────

export const WHITE = 'rgb(255, 255, 255)'; // --wf-panel light  (#ffffff)
export const DARK_PANEL = 'rgb(31, 41, 55)'; // --wf-panel dark   (#1f2937)
export const BRAND_BLUE = 'rgb(30, 64, 175)'; // --wf-brand        (#1e40af)
