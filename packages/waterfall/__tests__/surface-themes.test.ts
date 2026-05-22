/**
 * Surface-theming regression tests.
 *
 * Verifies that the three themed surfaces — `.wf-toolbar`, `.wf-list-wrap`,
 * and `.wf-panel` (detail panel) — render with the correct themed
 * background regardless of the host page's body colour, by combining:
 *
 *   host body bg ∈ { white, black, theme-aware }   ×
 *   OS colour scheme ∈ { light, dark }
 *
 * The fixtures are minimal HTML pages — *not* the demo HTML — that load
 * `waterfall.css` from the built `dist/` output via a `<link>` tag (just
 * like a real consumer would), and host a pre-rendered chart so the
 * surface tokens can be inspected without any JS having to load.
 *
 * Requires `npm run build -w packages/waterfall` to have been run.
 */
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { renderToHTML } from '../dist/render.js';
import type { Har } from '../dist/har.js';

// ── Constants ────────────────────────────────────────────────────────────────

/** Expected computed --wf-panel background-color in light theme (#ffffff). */
const PANEL_LIGHT = 'rgb(255, 255, 255)';
/** Expected computed --wf-panel background-color in dark theme (#1f2937). */
const PANEL_DARK = 'rgb(31, 41, 55)';

const PKG_ROOT = path.resolve(import.meta.dirname, '..');
const FIXTURE_DIR = path.resolve(import.meta.dirname, 'fixtures');
const CSS_PATH = path.resolve(PKG_ROOT, 'dist', 'waterfall.css');
const HAR_PATH = path.resolve(PKG_ROOT, 'public', 'demo.har');

type FixtureName = 'white-bg' | 'black-bg' | 'theme-aware';

// ── Test server ──────────────────────────────────────────────────────────────

/**
 * Test server that serves:
 *   1. The fixture HTML pages with `<!-- WATERFALL_CONTENT -->` replaced
 *      by `renderToHTML(demoHar)` (chart data, not code).
 *   2. The built `dist/waterfall.css` and `dist/waterfall.js` assets,
 *      referenced by the fixtures via `<link>` and `<script>` tags so
 *      consumption is identical to a real-world embed.
 *
 * Self-contained — no dependency on the demo page infrastructure.
 */
function buildServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const har = JSON.parse(fs.readFileSync(HAR_PATH, 'utf8')) as Har;
  const chartInner = renderToHTML(har);

  const pages: Record<FixtureName, string> = {
    'white-bg': spliceContent(
      fs.readFileSync(path.resolve(FIXTURE_DIR, 'white-bg.html'), 'utf8'),
      chartInner,
    ),
    'black-bg': spliceContent(
      fs.readFileSync(path.resolve(FIXTURE_DIR, 'black-bg.html'), 'utf8'),
      chartInner,
    ),
    'theme-aware': spliceContent(
      fs.readFileSync(path.resolve(FIXTURE_DIR, 'theme-aware.html'), 'utf8'),
      chartInner,
    ),
  };

  // Allowlist of asset paths served from dist/. Built artifacts only —
  // the fixtures reference them exactly as a downstream consumer would.
  const ASSETS: Record<string, { file: string; type: string }> = {
    '/waterfall.css': {
      file: path.resolve(PKG_ROOT, 'dist', 'waterfall.css'),
      type: 'text/css',
    },
    '/waterfall.js': {
      file: path.resolve(PKG_ROOT, 'dist', 'waterfall.js'),
      type: 'application/javascript',
    },
  };

  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const requestUrl = req.url ?? '/';

      const asset = ASSETS[requestUrl];
      if (asset) {
        try {
          const data = fs.readFileSync(asset.file);
          res.writeHead(200, { 'Content-Type': asset.type });
          res.end(data);
        } catch {
          res.writeHead(404);
          res.end();
        }
        return;
      }

      const pageKey = requestUrl.replace(/^\//, '').replace(/\.html$/, '');
      if (pageKey in pages) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(pages[pageKey as FixtureName]);
        return;
      }

      res.writeHead(404);
      res.end();
    });

    server.listen(0, () => {
      const addr = server.address() as { port: number };
      resolve({
        url: `http://localhost:${addr.port}`,
        close: () =>
          new Promise((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}

function spliceContent(template: string, chart: string): string {
  return template.replace('<!-- WATERFALL_CONTENT -->', chart);
}

// ── Page helpers ─────────────────────────────────────────────────────────────

async function openFixture(
  browser: Browser,
  baseUrl: string,
  fixture: FixtureName,
  scheme: 'light' | 'dark',
): Promise<Page> {
  const ctx = await browser.newContext({ colorScheme: scheme });
  const page = await ctx.newPage();
  await page.goto(`${baseUrl}/${fixture}`);
  return page;
}

async function bgColor(page: Page, selector: string): Promise<string> {
  return page.evaluate(
    (sel) => getComputedStyle(document.querySelector(sel)!).backgroundColor,
    selector,
  );
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

let browser: Browser;
let baseUrl: string;
let closeServer: () => Promise<void>;

beforeAll(async () => {
  // Self-check: the dist build must exist for this test to work.
  const required = [
    CSS_PATH,
    path.resolve(PKG_ROOT, 'dist', 'waterfall.js'),
    path.resolve(PKG_ROOT, 'dist', 'render.js'),
  ];
  for (const file of required) {
    if (!fs.existsSync(file)) {
      throw new Error(
        `Missing ${file} — run "npm run build -w packages/waterfall" before tests.`,
      );
    }
  }
  browser = await chromium.launch();
  const srv = await buildServer();
  baseUrl = srv.url;
  closeServer = srv.close;
});

afterAll(async () => {
  await browser.close();
  await closeServer();
});

// ─────────────────────────────────────────────────────────────────────────────
// Surface-token assertions
// ─────────────────────────────────────────────────────────────────────────────
//
// `.wf-toolbar` and `.wf-list-wrap` are part of the pre-rendered static
// markup, so they exist immediately and can be inspected without any JS.
//
// `.wf-panel` (the request detail panel) is injected by JS when a row is
// clicked, so it is not asserted here — see the chip-level / detail-panel
// follow-up batch.
// ─────────────────────────────────────────────────────────────────────────────

interface Case {
  fixture: FixtureName;
  scheme: 'light' | 'dark';
  expected: string;
  /** Human-readable label for the case. */
  label: string;
}

/**
 * The four combinations the user requested, plus the theme-aware sanity
 * checks. Expected surface colour is always `--wf-panel` for the active
 * theme — that token resolves to white in light, dark-slate in dark — and
 * it should NOT depend on the host body colour.
 */
const cases: Case[] = [
  {
    fixture: 'white-bg',
    scheme: 'dark',
    expected: PANEL_DARK,
    label: 'white host body + dark OS theme → dark surface',
  },
  {
    fixture: 'black-bg',
    scheme: 'dark',
    expected: PANEL_DARK,
    label: 'black host body + dark OS theme → dark surface',
  },
  {
    fixture: 'white-bg',
    scheme: 'light',
    expected: PANEL_LIGHT,
    label: 'white host body + light OS theme → light surface',
  },
  {
    fixture: 'black-bg',
    scheme: 'light',
    expected: PANEL_LIGHT,
    label: 'black host body + light OS theme → light surface',
  },
  {
    fixture: 'theme-aware',
    scheme: 'light',
    expected: PANEL_LIGHT,
    label: 'theme-aware host + light OS theme → light surface',
  },
  {
    fixture: 'theme-aware',
    scheme: 'dark',
    expected: PANEL_DARK,
    label: 'theme-aware host + dark OS theme → dark surface',
  },
];

describe.each(cases)('surfaces: $label', ({ fixture, scheme, expected }) => {
  it('.wf-toolbar uses the themed --wf-panel surface', async () => {
    const page = await openFixture(browser, baseUrl, fixture, scheme);
    expect(await bgColor(page, '.wf-toolbar')).toBe(expected);
  });

  it('.wf-list-wrap uses the themed --wf-panel surface', async () => {
    const page = await openFixture(browser, baseUrl, fixture, scheme);
    expect(await bgColor(page, '.wf-list-wrap')).toBe(expected);
  });
});
