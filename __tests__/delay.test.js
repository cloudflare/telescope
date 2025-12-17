import { launchTest } from '../index.js';
import { BrowserConfig } from '../lib/browsers.js';
import { DELAY_IMPLEMENTATIONS } from '../lib/delay.js';

const browsers = BrowserConfig.getBrowsers();

describe.each(['firefox'])('Delaying response - %s', browser => {
  test.each(Object.keys(DELAY_IMPLEMENTATIONS))(
    'launchTest delays .CSS responses by 2000ms (using "%s" method)',
    async delayImplementationName => {
      const result = await launchTest({
        url: 'https://www.speedpatterns.com/',
        browser: browser,
        debug: true,
        delay: { '\.css$': 2000 },
        delayUsing: delayImplementationName,
      });

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('testId');
      expect(result).toHaveProperty('resultsPath');

      expect(
        result.runner.resourceTimings
          .filter(r => r.name.match('.css$'))
          .every(r => r.duration >= 2000),
      ).toBe(true);
    },
    60000,
  );
});
