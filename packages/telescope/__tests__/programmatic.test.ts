import { launchTest, Telescope } from '../src/index.js';
import { describe, expect, test, it } from 'vitest';
import fs from 'fs';

import { BrowserConfig } from '../src/browsers.js';
import type { SuccessfulTestResult } from '../src/types.js';

const browsers = BrowserConfig.getBrowsers();

describe('Programmatic API: http(s)-only restriction', () => {
  it.each([
    ['ftp://example.com'],
    ['file:///tmp/page.html'],
    ['about:blank'],
    ['data:text/html,<h1>hi</h1>'],
    ['//example.com'], // no scheme -- programmatic API does NOT partially auto-prefix
  ])('launchTest rejects non-http(s) URL: %s', async input => {
    const result = await launchTest({ url: input });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(
        /Only http:\/\/ and https:\/\/ URLs are supported/,
      );
    }
  });

  it('Telescope.run() rejects non-http(s) URLs', async () => {
    const telescope = new Telescope({ url: 'ftp://example.com' });
    const result = await telescope.run();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(
        /Only http:\/\/ and https:\/\/ URLs are supported/,
      );
    }
  });
});

describe.each(browsers)('Programmatic API (%s)', browser => {
  test('launchTest executes and returns result object', async () => {
    const result = await launchTest({
      url: 'https://www.example.com',
      browser,
    });

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('testId');
    expect(result).toHaveProperty('resultsPath');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(fs.existsSync((result as SuccessfulTestResult).resultsPath)).toBe(
        true,
      );
    }
  }, 60000);

  test('launchTest handles errors gracefully', async () => {
    const result = await launchTest({
      url: '❗-a-valid-url',
      browser,
    });

    expect(result.success).toBe(false);
    expect(result).toHaveProperty('error');
  });

  test('launchTest accepts programmatic options', async () => {
    const result = await launchTest({
      url: 'https://www.example.com',
      browser,
      width: 1920,
      height: 1080,
      cookies: [{ name: 'test', value: 'value' }],
    });

    expect(result.success).toBe(true);
  }, 60000);
});
