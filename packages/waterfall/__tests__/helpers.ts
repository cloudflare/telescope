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
  '/': 'public/index.html',
  '/index.html': 'public/index.html',
  '/interactive.html': 'public/interactive.html',
  '/src-attr.html': 'public/src-attr.html',
  // Demo helper assets (referenced by the demo HTML pages at /demo.css,
  // /theme.js, etc. — they live in public/, not src/demo/ as a previous
  // version of this file assumed).
  '/demo.css': 'public/demo.css',
  '/theme.js': 'public/theme.js',
  '/progressive.js': 'public/progressive.js',
  '/interactive.js': 'public/interactive.js',
  '/demo.har': 'public/demo.har',
  // Drop-in build artifacts referenced by demo pages as /waterfall/…
  // Map them to the actual built files under dist/.
  '/waterfall/waterfall.css': 'dist/waterfall.css',
  '/waterfall/waterfall.js': 'dist/waterfall.js',
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
export const BRAND_SUBTLE = 'rgb(219, 234, 254)'; // --wf-brand-subtle (#dbeafe)
