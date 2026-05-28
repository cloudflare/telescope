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
 * Uses the shared fixture server (see __tests__/fixture-server.ts), which
 * serves minimal HTML pages that load `waterfall.css` and host a
 * pre-rendered chart so surface tokens can be inspected without any JS
 * having to load.
 *
 * Requires `npm run build -w packages/waterfall` to have been run.
 */
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createFixtureServer, type FixtureServer } from './fixture-server.js';

// ── Constants ────────────────────────────────────────────────────────────────

/** Expected computed --wf-panel background-color in light theme (#ffffff). */
const PANEL_LIGHT = 'rgb(255, 255, 255)';
/** Expected computed --wf-panel background-color in dark theme (#1f2937). */
const PANEL_DARK = 'rgb(31, 41, 55)';

/** Fixture names used by these surface tests. */
type SurfaceFixture = 'white-bg' | 'black-bg' | 'static';

// ── Page helpers ─────────────────────────────────────────────────────────────

async function openFixture(
  browser: Browser,
  baseUrl: string,
  fixture: SurfaceFixture,
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
let server: FixtureServer;

beforeAll(async () => {
  browser = await chromium.launch();
  server = await createFixtureServer();
});

afterAll(async () => {
  await browser.close();
  await server.close();
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
  fixture: SurfaceFixture;
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
    fixture: 'static',
    scheme: 'light',
    expected: PANEL_LIGHT,
    label: 'theme-aware host + light OS theme → light surface',
  },
  {
    fixture: 'static',
    scheme: 'dark',
    expected: PANEL_DARK,
    label: 'theme-aware host + dark OS theme → dark surface',
  },
];

describe.each(cases)('surfaces: $label', ({ fixture, scheme, expected }) => {
  it('.wf-toolbar uses the themed --wf-panel surface', async () => {
    const page = await openFixture(browser, server.url, fixture, scheme);
    expect(await bgColor(page, '.wf-toolbar')).toBe(expected);
  });

  it('.wf-list-wrap uses the themed --wf-panel surface', async () => {
    const page = await openFixture(browser, server.url, fixture, scheme);
    expect(await bgColor(page, '.wf-list-wrap')).toBe(expected);
  });
});
