import { launchTest } from '../index.js';
import fs from 'fs';

describe('Delaying requests', () => {
  test('launchTest executes and returns result object', async () => {
    const result = await launchTest({
      url: 'https://www.speedpatterns.com/',
      browser: 'firefox',
      delayRequests: { '.css$': 2000, '.js$': 5000 },
    });

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('testId');
    expect(result).toHaveProperty('resultsPath');
    expect(result.success).toBe(true);

    // TODO read resources and check if they were delayed
    // expect(
    //   result.resources // !!! this is incorrect !!!
    //     .filter(r => r.name.match('.css$'))
    //     .reduce((delayed, r) => {
    //       if (!delayed && r.duration >= 2000) {
    //         console.log(r.name, r.duration);
    //         return true;
    //       } else {
    //         return delayed;
    //       }
    //     }, false),
    // ).toBeEqual(true);
  }, 60000);
});
