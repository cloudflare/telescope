import { launchTest } from '../index.js';
import fs from 'fs';
import { devices } from 'playwright/test';

import { BrowserConfig } from '../lib/browsers.js';
import { normalizeCLIConfig } from '../lib/config.js';
const browsers = BrowserConfig.getBrowsers();

const device = 'Nexus 10'
const browser = 'chrome'



test('Setting device emulation updates the config', async () => {
    let options = {
        browser: 'chrome',
        device: device,
        url: 'https://www.example.com',
    };
    var config = normalizeCLIConfig(options);

    const result = await launchTest(config);

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('testId');
    expect(result).toHaveProperty('resultsPath');
    expect(result.success).toBe(true);
    expect(fs.existsSync(result.resultsPath)).toBe(true);
});


// describe.each(browsers)('Programmatic API (%s)', browser => {
//   describe.each(Object.keys(devices))(
//       'launchTest executes and returns result object when emulating device: %s',
//       device => {
//         test('Setting device emulation updates the config', async () => {
//             console.log(devices)
//             let options = {
//                 browser,
//                 device: device,
//                 url: '../tests/sandbox/index.html',
//             };
//             options = normalizeCLIConfig(options);
//             let config = new BrowserConfig().getBrowserConfig(browser, options);
//             expect(config && typeof config === 'object').toBe(true);
//                 // test collecting device data for desktop devices
//                 if (device.toLowerCase().includes('desktop')) {
//                     expect(config.isMobile).toBe(false);
//                     expect(config.hasTouch).toBe(false);
//                 }
//                 // test collecting device data for non-desktop devices
//                 else {
//                     expect(config.isMobile).toBe(true);
//                     expect(config.hasTouch).toBe(true);
//                     expect(config.deviceScaleFactor).toBeDefined();
//                 }
            
//             const result = await launchTest(options);

//             expect(result).toHaveProperty('success');
//             expect(result).toHaveProperty('testId');
//             expect(result).toHaveProperty('resultsPath');
//             expect(result.success).toBe(true);
//             expect(fs.existsSync(result.resultsPath)).toBe(true);
//         });
//       },
//     );
// });
