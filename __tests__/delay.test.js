import { launchTest } from '../index.js';
import { BrowserConfig } from '../lib/browsers.js';

const browsers = BrowserConfig.getBrowsers();

describe.each(browsers)('Delaying first byte of the response - %s', browser => {
  test('launchTest executes and delays .CSS responses by 2000ms', async () => {
    const result = await launchTest({
      url: 'https://www.speedpatterns.com/',
      browser: browser,
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
