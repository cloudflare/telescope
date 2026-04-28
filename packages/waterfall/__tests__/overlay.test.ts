/**
 * Overlay tests — event-line (metric) labels and the scrubber.
 *
 * Event-line label tests use index.html (pre-rendered, progressive enhancement)
 * for data-label / data-name and pill style properties; snap/visibility tests
 * use interactive.html (JS upgraded, HAR injectable) because the scrubber is
 * injected by the custom element and snapping requires the accurate pixel
 * positions that JS computes.
 *
 * index.html    = progressive enhancement (pre-rendered children, JS upgrades in place)
 * interactive.html = fully dynamic (builds DOM from scratch, .har injectable)
 */

import { type Browser, type Page } from 'playwright';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createServer, launchBrowser } from './helpers.js';

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

// ── Helpers ───────────────────────────────────────────────────────────────────

async function openUrl(url: string): Promise<Page> {
  const ctx = await browser.newContext({ colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto(url);
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
    // "transparent" or "rgba(0,0,0,0)" means hidden; anything with alpha > 0 means visible.
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
async function moveToOverlayPct(page: Page, pct: number): Promise<DOMRect> {
  const rect: DOMRect = await page.evaluate(() => {
    const el = document.querySelector('.wf-events-overlay')!;
    return el.getBoundingClientRect().toJSON() as DOMRect;
  });
  await page.mouse.move(rect.x + rect.width * pct, rect.y + rect.height / 2);
  return rect;
}

// ── Event-line (metric) label — static properties ─────────────────────────────

describe('event-line labels (index.html)', () => {
  let page: Page;
  beforeAll(async () => {
    page = await openUrl(`${baseUrl}/index.html`);
  });

  // data-label (full value with space before unit)
  it('DCL event line has correct data-label', async () => {
    const label = await page.$eval(
      '.wf-event--dcl',
      (el) => (el as HTMLElement).dataset.label ?? '',
    );
    expect(label).toBe('DCL 340 ms');
  });

  it('Load event line has correct data-label', async () => {
    const label = await page.$eval(
      '.wf-event--load',
      (el) => (el as HTMLElement).dataset.label ?? '',
    );
    expect(label).toBe('Load 620 ms');
  });

  it('LCP event line has correct data-label', async () => {
    const label = await page.$eval(
      '.wf-event--lcp',
      (el) => (el as HTMLElement).dataset.label ?? '',
    );
    expect(label).toBe('LCP 480 ms');
  });

  // data-name (short name only, no value)
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

  // Pill colours
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

// ── Scrubber — free movement ──────────────────────────────────────────────────

describe('scrubber free movement (interactive.html)', () => {
  let page: Page;

  beforeAll(async () => {
    page = await openUrl(`${baseUrl}/interactive.html`);
    await page.waitForSelector('.wf-scrubber');
  });

  it('scrubber element exists after JS upgrade', async () => {
    expect(await page.$('.wf-scrubber')).not.toBeNull();
  });

  it('scrubber is hidden before any mousemove', async () => {
    const bg = await elemStyle(page, '.wf-scrubber', 'backgroundColor');
    // transparent / rgba with 0 alpha = hidden
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
    // Move to 30% ��� away from the event lines (DCL ≈55%, Load ≈100%)
    await moveToOverlayPct(page, 0.3);
    await waitScrubberBg(page, 'visible');
    const bg = await elemStyle(page, '.wf-scrubber', 'backgroundColor');
    const isHidden =
      bg === 'transparent' ||
      bg === '' ||
      (bg.startsWith('rgba') && bg.endsWith(', 0)'));
    expect(isHidden).toBe(false);
  });

  it('scrubber label is visible when scrubber is free-moving', async () => {
    // Still at 30% from previous test.
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
    const box = await page.$eval('.wf-list-wrap', (el) =>
      el.getBoundingClientRect().toJSON(),
    );
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

// ��─ Scrubber — snap to metric ─────────────────────────────────────────────────

describe('scrubber snap to metric (interactive.html)', () => {
  let page: Page;

  beforeAll(async () => {
    page = await openUrl(`${baseUrl}/interactive.html`);
    await page.waitForSelector('.wf-scrubber');
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
        overlayRect: rect.toJSON(),
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
    // Already snapped from previous test.
    const bg = await elemStyle(page, '.wf-scrubber', 'backgroundColor');
    const isHidden =
      bg === 'transparent' ||
      bg === '' ||
      (bg.startsWith('rgba') && bg.endsWith(', 0)'));
    expect(isHidden).toBe(true);
  });

  it('scrubber label is hidden when snapped', async () => {
    // Already snapped from previous test.
    const display = await elemStyle(page, '.wf-scrubber__label', 'display');
    expect(display).toBe('none');
  });

  it('DCL metric label pill becomes visible when snapped', async () => {
    // Already snapped — opacity should already be 1 (no transition needed).
    const opacity = await afterStyle(page, '.wf-event--dcl', 'opacity');
    expect(parseFloat(opacity)).toBe(1);
  });

  it('DCL metric label shows full value (with ms and space) when snapped', async () => {
    // Already snapped. The ::after content switches to attr(data-label).
    const content = await afterStyle(page, '.wf-event--dcl', 'content');
    expect(content).toContain('DCL');
    expect(content).toMatch(/\d+ ms/);
  });

  it('unsnapped DCL metric label reverts to name-only content', async () => {
    // Move far away from DCL (to 10% of overlay width).
    await moveToOverlayPct(page, 0.1);
    await waitScrubberBg(page, 'visible');

    const snapped = await page.$$('.wf-event-line--snapped');
    expect(snapped).toHaveLength(0);

    const content = await afterStyle(page, '.wf-event--dcl', 'content');
    expect(content).toContain('DCL');
    expect(content).not.toMatch(/\d+ ms/);
  });

  it('scrubber is visible and label shows ms value after unsnap', async () => {
    // Still at 10% from previous test.
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
    // Snap to DCL first.
    await snapToDcl();
    // Then leave.
    const box = await page.$eval('.wf-list-wrap', (el) =>
      el.getBoundingClientRect().toJSON(),
    );
    await page.mouse.move(box.x - 20, box.y - 20);
    await waitScrubberBg(page, 'hidden');
    const snapped = await page.$$('.wf-event-line--snapped');
    expect(snapped).toHaveLength(0);
  });
});
