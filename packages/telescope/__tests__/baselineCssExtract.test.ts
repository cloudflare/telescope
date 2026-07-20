import { describe, it, expect } from 'vitest';

import { extractCSSFromHar } from '../src/baselineCssExtract.js';
import type { HarData, HarEntry } from '../src/types.js';

// Build a minimal HAR entry in-memory (only the fields the extractor reads).
function makeEntry(
  url: string,
  mimeType: string,
  text: string | undefined,
  encoding?: string,
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

const toBase64 = (value: string) =>
  Buffer.from(value, 'utf8').toString('base64');

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
      makeEntry('https://x.test/a.css', 'text/css', toBase64(css), 'base64'),
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
