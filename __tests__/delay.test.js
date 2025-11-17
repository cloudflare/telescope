import { launchTest } from '../index.js';
import fs from 'fs';

describe('Delaying requests', () => {
  test('launchTest executes and returns result object', async () => {
    const result = await launchTest({
      url: 'https://www.speedpatterns.com/',
      browser: 'chrome',
      delayFirstByte: { '.css$': 2000 },
    });

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('testId');
    expect(result).toHaveProperty('resultsPath');
    expect(result.success).toBe(true);

    expect(
      result.runner.resourceTimings
        .filter(r => r.name.match('.css$'))
        .every(r => r.duration >= 2000),
    ).toBe(true);
  }, 60000);
});
