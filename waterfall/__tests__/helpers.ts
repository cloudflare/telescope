/**
 * Shared test helpers — static file server + Playwright page factories.
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, type Browser, type Page } from 'playwright';

export const ROOT = path.resolve(import.meta.dirname, '..');

// ── Static file server ────────────────────────────────────────────────────────

/**
 * Explicit allowlist of URL paths the test server is permitted to serve.
 * Mapping: request path → relative file path from ROOT.
 *
 * Using an allowlist (rather than joining req.url directly into a filesystem
 * path) prevents path-traversal attacks where a crafted URL such as
 * `/../../../etc/passwd` could read arbitrary files from disk.
 */
const ALLOWED_PATHS: Record<string, string> = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/interactive.html': 'interactive.html',
  '/src-attr.html': 'src-attr.html',
  '/waterfall.css': 'waterfall.css',
  '/src/demo/demo.css': 'src/demo/demo.css',
  '/src/demo/theme.js': 'src/demo/theme.js',
  '/src/demo/progressive.js': 'src/demo/progressive.js',
  '/src/demo/interactive.js': 'src/demo/interactive.js',
  // dist/ ES module bundle — index.js and its sibling chunk files
  '/dist/index.js': 'dist/index.js',
  '/dist/waterfall-chart.js': 'dist/waterfall-chart.js',
  '/dist/render.js': 'dist/render.js',
  '/dist/config.js': 'dist/config.js',
  '/dist/formatters.js': 'dist/formatters.js',
  '/dist/helpers.js': 'dist/helpers.js',
  '/dist/har.js': 'dist/har.js',
};

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
};

export function createServer(): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const requestPath = req.url ?? '/';
      const relativePath = ALLOWED_PATHS[requestPath];

      if (!relativePath) {
        res.writeHead(404);
        res.end();
        return;
      }

      // `relativePath` is a value from the ALLOWED_PATHS allowlist above, not
      // derived from req.url, so path traversal is not possible. The check
      // below is a defence-in-depth guard that verifies the resolved path stays
      // within ROOT even if the allowlist were ever accidentally widened.
      const filePath = path.resolve(ROOT, relativePath);
      if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
        res.writeHead(403);
        res.end();
        return;
      }
      try {
        const data = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'text/plain' });
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
 * Open a demo page with the given system color-scheme.
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
    /** Which demo page to load. Defaults to 'index.html' (progressive enhancement). */
    htmlPage?: 'index.html' | 'interactive.html';
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

  await page.goto(`${baseUrl}/${opts.htmlPage ?? 'index.html'}`);

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
