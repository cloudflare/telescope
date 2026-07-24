import playwright from 'playwright';
import { afterAll, beforeAll, describe, it, expect } from 'vitest';

import type { Browser, Page } from 'playwright';

import { BrowserConfig } from '../src/browsers.js';
import {
  extractCSSFromHar,
  harvestInlineStyles,
} from '../src/baselineCssExtract.js';
import { BASE64 } from '../src/types.js';
import type { HarData, HarEntry, HARContentEncoding } from '../src/types.js';

// Build a minimal HAR entry in-memory (only the fields the extractor reads).
function makeEntry(
  url: string,
  mimeType: string,
  text: string | undefined,
  encoding?: HARContentEncoding,
): HarEntry {
  return {
    request: { url, method: 'GET', headers: [] },
    response: {
      status: 200,
      content: { size: text?.length ?? 0, mimeType, text, encoding },
    },
    time: 0,
    startedDateTime: '1970-01-01T00:00:00.000Z',
  };
}

function makeHar(entries: HarEntry[]): HarData {
  return {
    log: { pages: [], entries, browser: { name: 'test', version: '0' } },
  };
}

const toBase64 = (value: string) => Buffer.from(value, 'utf8').toString(BASE64);

describe('extractCSSFromHar — external stylesheets', () => {
  it('extracts a text/css response as one source with the URL as file', () => {
    const har = makeHar([
      makeEntry('https://x.test/a.css', 'text/css', '.a { color: red; }'),
    ]);

    expect(extractCSSFromHar(har)).toEqual([
      { css: '.a { color: red; }', file: 'https://x.test/a.css' },
    ]);
  });

  it('matches text/css even with a charset parameter', () => {
    const har = makeHar([
      makeEntry('https://x.test/a.css', 'text/css; charset=utf-8', '.a {}'),
    ]);

    expect(extractCSSFromHar(har)).toHaveLength(1);
  });

  it('decodes base64-encoded CSS bodies', () => {
    const css = '.a { color: blue; }';
    const har = makeHar([
      makeEntry('https://x.test/a.css', 'text/css', toBase64(css), BASE64),
    ]);

    expect(extractCSSFromHar(har)[0].css).toBe(css);
  });

  it('preserves entry order across multiple stylesheets', () => {
    const har = makeHar([
      makeEntry('https://x.test/1.css', 'text/css', '.one {}'),
      makeEntry('https://x.test/2.css', 'text/css', '.two {}'),
    ]);

    expect(extractCSSFromHar(har).map(source => source.file)).toEqual([
      'https://x.test/1.css',
      'https://x.test/2.css',
    ]);
  });
});

describe('extractCSSFromHar — ignored and edge cases', () => {
  it('returns an empty array when there are no entries', () => {
    expect(extractCSSFromHar(makeHar([]))).toEqual([]);
  });

  it('ignores entries with no response body text', () => {
    const har = makeHar([
      makeEntry('https://x.test/a.css', 'text/css', undefined),
    ]);

    expect(extractCSSFromHar(har)).toEqual([]);
  });

  it('ignores non-CSS resources', () => {
    const har = makeHar([
      makeEntry('https://x.test/img.png', 'image/png', 'notcss'),
      makeEntry(
        'https://x.test/app.js',
        'application/javascript',
        'const a = 1;',
      ),
      makeEntry('https://x.test/', 'text/html', '<html></html>'),
    ]);

    expect(extractCSSFromHar(har)).toEqual([]);
  });
});

// Inline `<style>` blocks are read from the live DOM rather than the HAR, so
// these tests drive a real page per rendering engine in the selected matrix
// (CI runs Firefox only; locally all engines run). setContent leaves the page
// on `about:blank`, which is what `file` reflects.
const engines = [
  ...new Set(
    BrowserConfig.getBrowsers().map(
      name => BrowserConfig.browserConfigs[name].engine,
    ),
  ),
];

describe.each(engines)('harvestInlineStyles — %s', engine => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await playwright[engine].launch({ headless: true });
  }, 120000);

  afterAll(async () => {
    await browser.close();
  });

  // Load `html` into a fresh page, run `fn` against it, then discard the page.
  async function withPage<T>(
    html: string,
    fn: (page: Page) => Promise<T>,
  ): Promise<T> {
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'load' });
      return await fn(page);
    } finally {
      await page.close();
    }
  }

  const harvest = (html: string) =>
    withPage(html, page => harvestInlineStyles(page));

  it('harvests a single <style> block as one source', async () => {
    const sources = await harvest('<style>.a { color: red; }</style>');

    expect(sources).toEqual([
      { css: '.a { color: red; }', file: 'about:blank (inline style #1)' },
    ]);
  });

  it('harvests multiple <style> blocks in document order', async () => {
    const sources = await harvest(
      '<style>.one {}</style><style>.two {}</style>',
    );

    expect(sources).toEqual([
      { css: '.one {}', file: 'about:blank (inline style #1)' },
      { css: '.two {}', file: 'about:blank (inline style #2)' },
    ]);
  });

  // The whole reason for reading the live DOM instead of parsing HTML: styles a
  // page injects at runtime are present in the rendered document.
  it('captures <style> blocks injected by JavaScript after load', async () => {
    const sources = await harvest(
      `<script>
        const style = document.createElement('style');
        style.textContent = '.js { color: green; }';
        document.head.appendChild(style);
      </script>`,
    );

    expect(sources).toEqual([
      { css: '.js { color: green; }', file: 'about:blank (inline style #1)' },
    ]);
  });

  it('returns an empty array when there are no <style> blocks', async () => {
    expect(await harvest('<p>no styles here</p>')).toEqual([]);
  });

  it('skips empty and whitespace-only <style> blocks', async () => {
    const sources = await harvest(
      '<style></style><style>   </style><style>.a {}</style>',
    );

    expect(sources).toEqual([
      { css: '.a {}', file: 'about:blank (inline style #1)' },
    ]);
  });

  // Read-only is what lets this run after metrics collection without perturbing
  // performance measurements; assert it leaves the document untouched.
  it('does not modify the DOM', async () => {
    await withPage(
      '<style>.a { color: red; }</style><main>hi</main>',
      async page => {
        const before = await page.content();

        await harvestInlineStyles(page);

        expect(await page.content()).toBe(before);
      },
    );
  });
});
