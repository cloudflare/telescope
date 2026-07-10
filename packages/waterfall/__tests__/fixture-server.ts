/**
 * Shared fixture server for browser tests.
 *
 * Serves the minimal HTML fixtures in __tests__/fixtures/ along with the
 * built `dist/waterfall.css` and `dist/waterfall.js` assets — exactly as a
 * downstream consumer would consume them via `<link>` / `<script>` tags.
 *
 * Fixtures supported:
 *   /static                  pre-rendered chart, no JS
 *   /progressive             pre-rendered chart + JS bundle (upgrade in place)
 *   /interactive             empty <waterfall-chart> + JS bundle (HAR injected
 *                            via the `.har` property from test code)
 *   /white-bg, /black-bg     static fixtures with fixed host body bg
 *                            (used by surface-themes tests)
 *
 * All fixtures with a `<!-- WATERFALL_CONTENT -->` placeholder receive the
 * pre-rendered chart for the supplied HAR (or a default demo HAR).
 *
 * Usage:
 *
 *   import { createFixtureServer } from './fixture-server.js';
 *
 *   const server = await createFixtureServer();
 *   await page.goto(`${server.url}/static`);
 *   ...
 *   await server.close();
 *
 * To inject a different HAR for the pre-rendered fixtures, pass it explicitly:
 *
 *   const server = await createFixtureServer({ har: customHar });
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { renderToHTML } from '../dist/render.js';
import type { Har } from '../dist/har.js';

const PKG_ROOT = path.resolve(import.meta.dirname, '..');
const FIXTURE_DIR = path.resolve(import.meta.dirname, 'fixtures');
const DEFAULT_HAR_PATH = path.resolve(PKG_ROOT, 'public', 'demo.har');

/**
 * All fixtures registered with the server. Each entry maps a request path
 * (without the leading `/`, no extension) to a fixture HTML file and a flag
 * for whether to splice the pre-rendered chart into a
 * `<!-- WATERFALL_CONTENT -->` placeholder.
 */
const FIXTURES: Record<string, { file: string; preRender: boolean }> = {
  static: { file: 'static.html', preRender: true },
  progressive: { file: 'progressive-fixture.html', preRender: true },
  interactive: { file: 'interactive-fixture.html', preRender: false },
  'white-bg': { file: 'white-bg.html', preRender: true },
  'black-bg': { file: 'black-bg.html', preRender: true },
};

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

export interface FixtureServer {
  url: string;
  close: () => Promise<void>;
}

export interface CreateFixtureServerOptions {
  /** HAR to render into pre-rendering fixtures. Defaults to the demo HAR. */
  har?: Har;
}

/**
 * Verify required build outputs exist before any tests run.
 * Throws with an actionable message if the build is missing.
 */
function assertBuildExists(): void {
  const required = [
    ASSETS['/waterfall.css']!.file,
    ASSETS['/waterfall.js']!.file,
    path.resolve(PKG_ROOT, 'dist', 'render.js'),
  ];
  for (const file of required) {
    if (!fs.existsSync(file)) {
      throw new Error(
        `Missing ${file} — run "npm run build -w packages/waterfall" before tests.`,
      );
    }
  }
}

/**
 * Create a self-contained HTTP server that serves the fixture pages and the
 * built waterfall assets. The server listens on an ephemeral port and is
 * returned with the chosen URL plus a close() helper.
 */
export async function createFixtureServer(
  options: CreateFixtureServerOptions = {},
): Promise<FixtureServer> {
  assertBuildExists();

  const har =
    options.har ??
    (JSON.parse(fs.readFileSync(DEFAULT_HAR_PATH, 'utf8')) as Har);
  const chartInner = renderToHTML(har);

  // Pre-resolve every fixture's body once so request handling is just a map lookup.
  const renderedPages: Record<string, string> = {};
  for (const [key, { file, preRender }] of Object.entries(FIXTURES)) {
    const template = fs.readFileSync(path.resolve(FIXTURE_DIR, file), 'utf8');
    renderedPages[key] = preRender
      ? template.replace('<!-- WATERFALL_CONTENT -->', chartInner)
      : template;
  }

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
      if (pageKey in renderedPages) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderedPages[pageKey]);
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
