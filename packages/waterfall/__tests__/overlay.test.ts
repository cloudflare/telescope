/**
 * Overlay tests — event-line (metric) labels and the scrubber.
 *
 * Fixtures used:
 *   /progressive  — pre-rendered chart + JS upgrade. Used for assertions
 *                   about pre-rendered event-line data attributes that
 *                   exist before and after upgrade.
 *   /interactive  — empty <waterfall-chart> + JS bundle. Used for the
 *                   scrubber tests because the scrubber is JS-injected
 *                   and needs accurate post-layout pixel positions. The
 *                   default demo HAR is injected via .har after load.
 */

import { chromium, type Browser, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';

import {
  createFixtureServer,
  type FixtureServer,
} from './fixture-server.js';
import type { Har } from '../dist/har.js';

const PKG_ROOT = path.resolve(import.meta.dirname, '..');
const DEMO_HAR: Har = JSON.parse(
  fs.readFileSync(path.resolve(PKG_ROOT, 'public', 'demo.har'), 'utf8'),
);

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

// ── Helpers ──────────────────────────────────────────────────────────────────

async function openProgressive(): Promise<Page> {
  const ctx = await browser.newContext({ colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto(`${server.url}/progressive`);
  // Wait for JS upgrade (scrubber injected).
  await page.waitForSelector('.wf-scrubber');
  return page;
}

async function openInteractiveWithDemoHar(): Promise<Page> {
  const ctx = await browser.newContext({ colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto(`${server.url}/interactive`);
  await page.evaluate((h) => {
    const el = document.querySelector('waterfall-chart') as unknown as {
      har: unknown;
    };
    el.har = h;
  }, DEMO_HAR);
  await page.waitForSelector('.wf-scrubber');
  return page;
}

async function afterStyle(
  page: Page,
  selector: string,
  prop: string,
): Promise<string> {
  return page.evaluate(
    ([sel, p]) =>
      getComputedStyle(document.querySelector(sel as string)!, '::after')[
        p as keyof CSSStyleDeclaration
      ] as string,
    [selector, prop],
  );
}

async function elemStyle(
  page: Page,
  selector: string,
  prop: string,
): Promise<string> {
  return page.evaluate(
    ([sel, p]) =>
      getComputedStyle(document.querySelector(sel as string)!)[
        p as keyof CSSStyleDeclaration
      ] as string,
    [selector, prop],
  );
}

/** Wait for the scrubber background transition to become visible or hidden. */
async function waitScrubberBg(
  page: Page,
  condition: 'visible' | 'hidden',
): Promise<void> {
  await page.waitForFunction((c) => {
    const el = document.querySelector('.wf-scrubber') as HTMLElement | null;
    if (!el) return false;
    const bg = getComputedStyle(el).backgroundColor;
    const hidden =
      bg === 'transparent' ||
      bg === '' ||
      (bg.startsWith('rgba') && bg.endsWith(', 0)'));
    return c === 'hidden' ? hidden : !hidden;
  }, condition);
}

/**
 * Move the mouse to a pixel position relative to the overlay's bounding rect.
 * Returns the overlay rect for further calculations.
 */
async function moveToOverlayPct(
  page: Page,
  pct: number,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const rect = await page.evaluate(() => {
    const el = document.querySelector('.wf-events-overlay')!;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  await page.mouse.move(rect.x + rect.width * pct, rect.y + rect.height / 2);
  return rect;
}

/**
 * Find a percentage position along the overlay that is not within `gapPx`
 * of any event line — used to test free-moving scrubber behaviour without
 * accidentally triggering snap.
 */
async function findFreeSpotPct(page: Page, gapPx = 24): Promise<number> {
  return page.evaluate((gap) => {
    const overlay = document.querySelector('.wf-events-overlay')!;
    const rect = overlay.getBoundingClientRect();
    const lines = Array.from(
      overlay.querySelectorAll<HTMLElement>('.wf-event-line'),
    );
    const linePcts = lines.map((l) => parseFloat(l.style.left) / 100);

    // Scan candidate positions; return the first that's >gap from every line.
    for (let pct = 0.05; pct < 1; pct += 0.05) {
      const x = pct * rect.width;
      const ok = linePcts.every(
        (lp) => Math.abs(lp * rect.width - x) > gap,
      );
      if (ok) return pct;
    }
    return 0.5; // fallback
  }, gapPx);
}

// ── Event-line (metric) label — static properties ────────────────────────────

describe('event-line labels (pre-rendered)', () => {
  let page: Page;
  beforeAll(async () => {
    page = await openProgressive();
  });

  // data-label format (name + numeric value + " ms")
  it('DCL event line has well-formed data-label', async () => {
    const label = await page.$eval(
      '.wf-event--dcl',
      (el) => (el as HTMLElement).dataset.label ?? '',
    );
    expect(label).toMatch(/^DCL \d+(\.\d+)? ms$/);
  });

  it('Load event line has well-formed data-label', async () => {
    const label = await page.$eval(
      '.wf-event--load',
      (el) => (el as HTMLElement).dataset.label ?? '',
    );
    expect(label).toMatch(/^Load \d+(\.\d+)? ms$/);
  });

  it('LCP event line has well-formed data-label', async () => {
    const label = await page.$eval(
      '.wf-event--lcp',
      (el) => (el as HTMLElement).dataset.label ?? '',
    );
    expect(label).toMatch(/^LCP \d+(\.\d+)? ms$/);
  });

  // data-name (short name only)
  it('DCL event line has correct data-name', async () => {
    const name = await page.$eval(
      '.wf-event--dcl',
      (el) => (el as HTMLElement).dataset.name ?? '',
    );
    expect(name).toBe('DCL');
  });

  it('Load event line has correct data-name', async () => {
    const name = await page.$eval(
      '.wf-event--load',
      (el) => (el as HTMLElement).dataset.name ?? '',
    );
    expect(name).toBe('Load');
  });

  it('LCP event line has correct data-name', async () => {
    const name = await page.$eval(
      '.wf-event--lcp',
      (el) => (el as HTMLElement).dataset.name ?? '',
    );
    expect(name).toBe('LCP');
  });

  // Pill colours (these are CSS-defined constants, not derived from HAR)
  it('DCL label pill background is DCL accent colour', async () => {
    const bg = await afterStyle(page, '.wf-event--dcl', 'backgroundColor');
    expect(bg).toBe('rgb(208, 96, 208)'); // #d060d0
  });

  it('Load label pill background is Load accent colour', async () => {
    const bg = await afterStyle(page, '.wf-event--load', 'backgroundColor');
    expect(bg).toBe('rgb(64, 96, 208)'); // #4060d0
  });

  it('LCP label pill background is LCP accent colour (green)', async () => {
    const bg = await afterStyle(page, '.wf-event--lcp', 'backgroundColor');
    expect(bg).toBe('rgb(48, 160, 80)'); // #30a050
  });

  it('DCL label text colour is --wf-panel (white in light mode)', async () => {
    const color = await afterStyle(page, '.wf-event--dcl', 'color');
    expect(color).toBe('rgb(255, 255, 255)');
  });

  it('Load label text colour is --wf-panel (white in light mode)', async () => {
    const color = await afterStyle(page, '.wf-event--load', 'color');
    expect(color).toBe('rgb(255, 255, 255)');
  });

  // Typography
  it('DCL label has no text-transform', async () => {
    const tt = await afterStyle(page, '.wf-event--dcl', 'textTransform');
    expect(tt).toBe('none');
  });

  it('DCL label has no letter-spacing', async () => {
    const ls = await afterStyle(page, '.wf-event--dcl', 'letterSpacing');
    expect(['normal', '0px']).toContain(ls);
  });

  // Labels always visible
  it('DCL label pill is always visible (opacity 1)', async () => {
    const opacity = await afterStyle(page, '.wf-event--dcl', 'opacity');
    expect(parseFloat(opacity)).toBe(1);
  });

  it('Load label pill is always visible (opacity 1)', async () => {
    const opacity = await afterStyle(page, '.wf-event--load', 'opacity');
    expect(parseFloat(opacity)).toBe(1);
  });

  it('LCP label pill is always visible (opacity 1)', async () => {
    const opacity = await afterStyle(page, '.wf-event--lcp', 'opacity');
    expect(parseFloat(opacity)).toBe(1);
  });

  // Default content is name-only (no value)
  it('DCL label pill shows name only by default (no ms value)', async () => {
    const content = await afterStyle(page, '.wf-event--dcl', 'content');
    // content is the CSS string value of attr(data-name), rendered as e.g. '"DCL"'
    expect(content).toContain('DCL');
    expect(content).not.toContain('ms');
  });

  it('Load label pill shows name only by default', async () => {
    const content = await afterStyle(page, '.wf-event--load', 'content');
    expect(content).toContain('Load');
    expect(content).not.toContain('ms');
  });

  it('LCP label pill shows name only by default', async () => {
    const content = await afterStyle(page, '.wf-event--lcp', 'content');
    expect(content).toContain('LCP');
    expect(content).not.toContain('ms');
  });
});

// ── Scrubber — free movement ─────────────────────────────────────────────────

describe('scrubber free movement', () => {
  let page: Page;

  beforeAll(async () => {
    page = await openInteractiveWithDemoHar();
  });

  it('scrubber element exists after JS upgrade', async () => {
    expect(await page.$('.wf-scrubber')).not.toBeNull();
  });

  it('scrubber is hidden before any mousemove', async () => {
    const bg = await elemStyle(page, '.wf-scrubber', 'backgroundColor');
    const isHidden =
      bg === 'transparent' ||
      bg === '' ||
      (bg.startsWith('rgba') && bg.endsWith(', 0)'));
    expect(isHidden).toBe(true);
  });

  it('scrubber label is hidden before any mousemove', async () => {
    const display = await elemStyle(page, '.wf-scrubber__label', 'display');
    expect(display).toBe('none');
  });

  it('scrubber becomes visible after mousemove into the timeline', async () => {
    // Pick a position that is at least 24px from any event line so we
    // don't accidentally snap. Computed dynamically so the test does not
    // depend on the specific timings in the demo HAR.
    const pct = await findFreeSpotPct(page);
    await moveToOverlayPct(page, pct);
    await waitScrubberBg(page, 'visible');
    const bg = await elemStyle(page, '.wf-scrubber', 'backgroundColor');
    const isHidden =
      bg === 'transparent' ||
      bg === '' ||
      (bg.startsWith('rgba') && bg.endsWith(', 0)'));
    expect(isHidden).toBe(false);
  });

  it('scrubber label is visible when scrubber is free-moving', async () => {
    // Still in the free-spot position from previous test.
    const display = await elemStyle(page, '.wf-scrubber__label', 'display');
    expect(display).not.toBe('none');
  });

  it('scrubber label shows "NNN ms" (with space) when not snapped', async () => {
    const text = await page.$eval(
      '.wf-scrubber__label',
      (el) => el.textContent ?? '',
    );
    expect(text).toMatch(/^\d+ ms$/);
  });

  it('scrubber label text colour is --wf-panel (white in light mode)', async () => {
    const color = await elemStyle(page, '.wf-scrubber__label', 'color');
    expect(color).toBe('rgb(255, 255, 255)');
  });

  it('scrubber label has no text-transform', async () => {
    const tt = await elemStyle(page, '.wf-scrubber__label', 'textTransform');
    expect(tt).toBe('none');
  });

  it('scrubber label has no letter-spacing', async () => {
    const ls = await elemStyle(page, '.wf-scrubber__label', 'letterSpacing');
    expect(['normal', '0px']).toContain(ls);
  });

  it('no event line has --snapped class while scrubber is free', async () => {
    const snapped = await page.$$('.wf-event-line--snapped');
    expect(snapped).toHaveLength(0);
  });

  it('scrubber hides after mouseleave', async () => {
    const box = await page.$eval('.wf-list-wrap', (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y };
    });
    await page.mouse.move(box.x - 20, box.y - 20);
    await waitScrubberBg(page, 'hidden');
    const bg = await elemStyle(page, '.wf-scrubber', 'backgroundColor');
    const isHidden =
      bg === 'transparent' ||
      bg === '' ||
      (bg.startsWith('rgba') && bg.endsWith(', 0)'));
    expect(isHidden).toBe(true);
  });

  it('scrubber label hides after mouseleave', async () => {
    // Already outside after previous test.
    const display = await elemStyle(page, '.wf-scrubber__label', 'display');
    expect(display).toBe('none');
  });
});

// ── Scrubber — snap to metric ────────────────────────────────────────────────

describe('scrubber snap to metric', () => {
  let page: Page;

  beforeAll(async () => {
    page = await openInteractiveWithDemoHar();
  });

  /**
   * Move to just inside the snap threshold (2 px) of the DCL event line.
   * Returns the DCL line's absolute x position.
   */
  async function snapToDcl(): Promise<number> {
    const { lineX, overlayRect } = await page.evaluate(() => {
      const overlay = document.querySelector('.wf-events-overlay')!;
      const dcl = overlay.querySelector('.wf-event--dcl') as HTMLElement;
      const rect = overlay.getBoundingClientRect();
      const linePct = parseFloat(dcl.style.left) / 100;
      return {
        lineX: rect.x + linePct * rect.width,
        overlayRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    });
    // 2px left of the DCL line — well within the 8px threshold.
    await page.mouse.move(lineX - 2, overlayRect.y + overlayRect.height / 2);
    await page.waitForSelector('.wf-event-line--snapped');
    return lineX;
  }

  it('scrubber snaps to DCL line when cursor is within threshold', async () => {
    await snapToDcl();
    const snapped = await page.$$('.wf-event-line--snapped');
    expect(snapped).toHaveLength(1);
    const cls = await snapped[0]!.evaluate((el) => el.className);
    expect(cls).toContain('wf-event--dcl');
  });

  it('scrubber line is hidden when snapped', async () => {
    const bg = await elemStyle(page, '.wf-scrubber', 'backgroundColor');
    const isHidden =
      bg === 'transparent' ||
      bg === '' ||
      (bg.startsWith('rgba') && bg.endsWith(', 0)'));
    expect(isHidden).toBe(true);
  });

  it('scrubber label is hidden when snapped', async () => {
    const display = await elemStyle(page, '.wf-scrubber__label', 'display');
    expect(display).toBe('none');
  });

  it('DCL metric label pill becomes visible when snapped', async () => {
    const opacity = await afterStyle(page, '.wf-event--dcl', 'opacity');
    expect(parseFloat(opacity)).toBe(1);
  });

  it('DCL metric label shows full value (with ms and space) when snapped', async () => {
    const content = await afterStyle(page, '.wf-event--dcl', 'content');
    expect(content).toContain('DCL');
    expect(content).toMatch(/\d+ ms/);
  });

  it('unsnapped DCL metric label reverts to name-only content', async () => {
    // Move to a free spot — far from every event line.
    const pct = await findFreeSpotPct(page);
    await moveToOverlayPct(page, pct);
    await waitScrubberBg(page, 'visible');

    const snapped = await page.$$('.wf-event-line--snapped');
    expect(snapped).toHaveLength(0);

    const content = await afterStyle(page, '.wf-event--dcl', 'content');
    expect(content).toContain('DCL');
    expect(content).not.toMatch(/\d+ ms/);
  });

  it('scrubber is visible and label shows ms value after unsnap', async () => {
    // Still in the free-spot position from previous test.
    const bg = await elemStyle(page, '.wf-scrubber', 'backgroundColor');
    const isHidden =
      bg === 'transparent' ||
      bg === '' ||
      (bg.startsWith('rgba') && bg.endsWith(', 0)'));
    expect(isHidden).toBe(false);

    const display = await elemStyle(page, '.wf-scrubber__label', 'display');
    expect(display).not.toBe('none');

    const text = await page.$eval(
      '.wf-scrubber__label',
      (el) => el.textContent ?? '',
    );
    expect(text).toMatch(/^\d+ ms$/);
  });

  it('unsnaps all metric labels after mouseleave', async () => {
    await snapToDcl();
    const box = await page.$eval('.wf-list-wrap', (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y };
    });
    await page.mouse.move(box.x - 20, box.y - 20);
    await waitScrubberBg(page, 'hidden');
    const snapped = await page.$$('.wf-event-line--snapped');
    expect(snapped).toHaveLength(0);
  });
});
