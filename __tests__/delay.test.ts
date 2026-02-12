import { launchTest, SuccessfulTestResult } from '../src/index.js';
import { BrowserConfig } from '../src/browsers.js';

import type { DelayMethod } from '../src/delay.js';

const browsers = BrowserConfig.getBrowsers();

describe.each(browsers)('Delaying response - %s', browser => {
  test.each(['fulfill', 'continue'] as DelayMethod[])(
    'launchTest delays .CSS responses by 2000ms (using "%s" method)',
    async (delayImplementationName: DelayMethod) => {
      const result = await launchTest({
        url: 'https://www.speedpatterns.com/',
        browser: browser,
        // debug: true,
        list: true,
        delay: { '\.css$': 2000 },
        delayUsing: delayImplementationName,
      });

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('testId');
      expect(result).toHaveProperty('resultsPath');

      expect(
        (result as SuccessfulTestResult).runner.resourceTimings
          .filter((r: any) => r.name.match('.css$'))
          .every((r: any) => r.duration >= 2000),
      ).toBe(true);
    },
    60000,
  );
});
