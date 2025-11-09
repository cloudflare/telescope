import { launchTest } from '../index.js';
import fs from 'fs';

describe('Programmatic API', () => {
  test('launchTest executes and returns result object', async () => {
    const result = await launchTest({
      url: 'https://www.example.com',
      browser: 'chrome',
    });

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('testId');
    expect(result).toHaveProperty('resultsPath');
    expect(result.success).toBe(true);
    expect(fs.existsSync(result.resultsPath)).toBe(true);
  }, 60000);

  test('launchTest handles errors gracefully', async () => {
    const result = await launchTest({
      url: 'not-a-valid-url',
      browser: 'chrome',
    });

    expect(result.success).toBe(false);
    expect(result).toHaveProperty('error');
  });

  test('launchTest accepts programmatic options', async () => {
    const result = await launchTest({
      url: 'https://www.example.com',
      browser: 'chrome',
      width: 1920,
      height: 1080,
      cookies: [{ name: 'test', value: 'value' }],
    });

    expect(result.success).toBe(true);
  }, 60000);
});
