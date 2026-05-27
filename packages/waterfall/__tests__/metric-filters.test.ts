/**
 * Metric filter button visibility tests.
 *
 * Verifies that the event toggle buttons (DCL, Page Load, LCP) are only shown
 * for metrics that are actually present in the HAR's pageTimings. Buttons for
 * missing metrics must not be rendered.
 *
 * Uses the `/interactive` fixture (empty <waterfall-chart> + JS bundle) so
 * custom HAR data can be injected programmatically via the `.har` property.
 */

import { chromium, type Browser, type Page } from 'playwright';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';

import {
  createFixtureServer,
  type FixtureServer,
} from './fixture-server.js';

let browser: Browser;
let server: FixtureServer;

// ── Minimal HAR factory ──────────────────────────────────────────────────────

function makeHar(pageTimings: Record<string, number>) {
  return {
    log: {
      version: '1.2',
      creator: { name: 'test', version: '1' },
      pages: [
        {
          startedDateTime: '2024-01-01T00:00:00.000Z',
          id: 'page_1',
          title: 'Test',
          pageTimings,
        },
      ],
      entries: [
        {
          startedDateTime: '2024-01-01T00:00:00.000Z',
          time: 200,
          request: {
            method: 'GET',
            url: 'https://example.com/',
            httpVersion: 'h2',
            headers: [],
            cookies: [],
            queryString: [],
            headersSize: -1,
            bodySize: 0,
          },
          response: {
            status: 200,
            statusText: 'OK',
            httpVersion: 'h2',
            headers: [],
            cookies: [],
            content: { size: 1000, mimeType: 'text/html' },
            redirectURL: '',
            headersSize: -1,
            bodySize: 1000,
          },
          timings: {
            blocked: 0,
            dns: 0,
            connect: 0,
            ssl: 0,
            send: 10,
            wait: 150,
            receive: 40,
          },
          _resourceType: 'document',
        },
      ],
    },
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function openInteractive(): Promise<Page> {
  const ctx = await browser.newContext({ colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto(`${server.url}/interactive`);
  return page;
}

/** Inject a HAR and wait for the scrubber to appear (signals render complete). */
async function loadHar(
  page: Page,
  pageTimings: Record<string, number>,
): Promise<void> {
  const har = makeHar(pageTimings);
  await page.evaluate((h) => {
    const el = document.querySelector('waterfall-chart') as unknown as {
      har: unknown;
    };
    el.har = h;
  }, har);
  await page.waitForSelector('.wf-scrubber');
}

/** Return the data-event values of all rendered metric toggle buttons. */
async function eventButtonKeys(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-event]')).map(
      (el) => el.dataset.event ?? '',
    ),
  );
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  browser = await chromium.launch();
  server = await createFixtureServer();
});

afterAll(async () => {
  await browser.close();
  await server.close();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('metric filter buttons — all three metrics present', () => {
  let page: Page;

  beforeAll(async () => {
    page = await openInteractive();
    await loadHar(page, { onContentLoad: 340, onLoad: 620, _lcp: 480 });
  });

  it('DCL button is rendered', async () => {
    const keys = await eventButtonKeys(page);
    expect(keys).toContain('ev-dcl');
  });

  it('Page Load button is rendered', async () => {
    const keys = await eventButtonKeys(page);
    expect(keys).toContain('ev-load');
  });

  it('LCP button is rendered', async () => {
    const keys = await eventButtonKeys(page);
    expect(keys).toContain('ev-lcp');
  });

  it('exactly three metric buttons are rendered', async () => {
    const keys = await eventButtonKeys(page);
    expect(keys).toHaveLength(3);
  });
});

describe('metric filter buttons — DCL and Load only (no LCP)', () => {
  let page: Page;

  beforeAll(async () => {
    page = await openInteractive();
    await loadHar(page, { onContentLoad: 340, onLoad: 620 });
  });

  it('DCL button is rendered', async () => {
    const keys = await eventButtonKeys(page);
    expect(keys).toContain('ev-dcl');
  });

  it('Page Load button is rendered', async () => {
    const keys = await eventButtonKeys(page);
    expect(keys).toContain('ev-load');
  });

  it('LCP button is not rendered', async () => {
    const keys = await eventButtonKeys(page);
    expect(keys).not.toContain('ev-lcp');
  });

  it('exactly two metric buttons are rendered', async () => {
    const keys = await eventButtonKeys(page);
    expect(keys).toHaveLength(2);
  });
});

describe('metric filter buttons — no metrics collected', () => {
  let page: Page;

  beforeAll(async () => {
    page = await openInteractive();
    await loadHar(page, {});
  });

  it('no metric buttons are rendered', async () => {
    const keys = await eventButtonKeys(page);
    expect(keys).toHaveLength(0);
  });

  it('metrics group is not rendered', async () => {
    const group = await page.$('.wf-legend-group[aria-label="Toggle metrics"]');
    expect(group).toBeNull();
  });
});
