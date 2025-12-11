import { launchTest } from '../index.js';
import fs from 'fs';

import { BrowserConfig } from '../lib/browsers.js';
const browsers = BrowserConfig.getBrowsers();

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
    expect(fs.existsSync(result.resultsPath)).toBe(true);
  }, 60000);

  // test('launchTest handles errors gracefully', async () => {
  //   const result = await launchTest({
  //     url: 'not-a-valid-url',
  //     browser,
  //   });

  //   expect(result.success).toBe(false);
  //   expect(result).toHaveProperty('error');
  // });

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
