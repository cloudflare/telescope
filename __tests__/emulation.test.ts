import fs from 'fs';
import { launchTest, SuccessfulTestResult } from '../src/index.js';
import { BrowserConfig } from '../src/browsers.js';
import { normalizeCLIConfig } from '../src/config.js';

const browsers = BrowserConfig.getBrowsers();
const target_devices = [
  'iPhone 15',
  'iPad Pro 11',
  'Pixel 7',
  'Desktop Chrome',
  'Desktop Safari',
  'Desktop Firefox',
];

//test for other options
describe.each(browsers)(
  'Device Emulation CLI + Config tests using device properties',
  browser => {
    describe.each(target_devices)(
      'Setting device emulation updates the config for device: %s',
      device => {
        let options = {
          browser,
          deviceName: device,
          url: '../tests/sandbox/index.html',
        };
        var config_options = normalizeCLIConfig(options);
        let config = new BrowserConfig().getBrowserConfig(
          browser,
          config_options,
        );
        test(`Setting device emulation creates a valid config object for browser: ${browser}`, () => {
          expect(config && typeof config === 'object').toBe(true);
        });
        // test collecting device data for desktop devices
        if (device.toLowerCase().includes('desktop')) {
          test(`Setting device emulation sets isMobile to false for desktop devices for browser: ${browser}`, () => {
            expect(config.isMobile).toBe(false);
          });
          test(`Setting device emulation sets hasTouch to false for desktop devices for browser: ${browser}`, () => {
            expect(config.hasTouch).toBe(false);
          });
        }
        // test collecting device data for non-desktop devices
        else {
          test(`Setting device emulation sets isMobile to true for non-desktop devices for browser: ${browser}`, () => {
            expect(config.isMobile).toBe(true);
          });
          test(`Setting device emulation sets hasTouch to true for non-desktop devices for browser: ${browser}`, () => {
            expect(config.hasTouch).toBe(true);
          });
          test(`Setting device emulation sets deviceScaleFactor for non-desktop devices for browser: ${browser}`, () => {
            expect(config.deviceScaleFactor).toBeDefined();
          });
        }
      },
    );
  },
);

describe.each(browsers)(
  'Device Emulation CLI + Config tests with width + height overrides',
  browser => {
    describe.each(target_devices)(
      'Setting device emulation updates the config for device: %s',
      device => {
        let options = {
          browser,
          deviceName: device,
          url: '../tests/sandbox/index.html',
          width: '1122',
          height: '3344',
        };
        var config_options = normalizeCLIConfig(options);
        let config = new BrowserConfig().getBrowserConfig(
          browser,
          config_options,
        );
        // test collecting device data for desktop devices
        if (device.toLowerCase().includes('desktop')) {
          test(`Setting device emulation sets isMobile to false for desktop devices for browser: ${browser}`, () => {
            expect(config.isMobile).toBe(false);
          });
          test(`Setting device emulation sets hasTouch to false for desktop devices for browser: ${browser}`, () => {
            expect(config.hasTouch).toBe(false);
          });
        }
        // test collecting device data for non-desktop devices
        else {
          test(`Setting device emulation sets isMobile to true for non-desktop devices for browser: ${browser}`, () => {
            expect(config.isMobile).toBe(true);
          });
          test(`Setting device emulation sets hasTouch to true for non-desktop devices for browser: ${browser}`, () => {
            expect(config.hasTouch).toBe(true);
          });
          test(`Setting device emulation sets deviceScaleFactor for non-desktop devices for browser: ${browser}`, () => {
            expect(config.deviceScaleFactor).toBeDefined();
          });
        }
        test(`Setting device emulation sets viewport width to override value for browser: ${browser}`, () => {
          expect(config.viewport.width).toBe(1122);
        });
        test(`Setting device emulation sets viewport height to override value for browser: ${browser}`, () => {
          expect(config.viewport.height).toBe(3344);
        });
        test(`Setting device emulation sets recordVideo width to override value for browser: ${browser}`, () => {
          expect(config.recordVideo.size.width).toBe(1122);
        });
        test(`Setting device emulation sets recordVideo height to override value for browser: ${browser}`, () => {
          expect(config.recordVideo.size.height).toBe(3344);
        });
      },
    );
  },
);

describe.each(browsers)('Device Emulation Tests', browser => {
  describe.each(target_devices)(
    'launchTest executes and returns result object when emulating device: %s',
    device => {
      let result: Awaited<ReturnType<typeof launchTest>>;
      beforeAll(async () => {
        let options = {
          browser,
          deviceName: device,
          url: 'https://www.example.com/',
        };
        const launchOptions = normalizeCLIConfig(options);
        result = await launchTest(launchOptions);
      }, 30000);
      test(`launchTest returns a result with success property for browser: ${browser}`, () => {
        expect(result).toHaveProperty('success');
      });
      test(`launchTest returns a result with testId property for browser: ${browser}`, () => {
        expect(result).toHaveProperty('testId');
      });
      test(`launchTest returns a result with resultsPath property for browser: ${browser}`, () => {
        expect(result).toHaveProperty('resultsPath');
      });
      test(`launchTest succeeds for browser: ${browser}`, () => {
        expect(result.success).toBe(true);
      });
      test(`launchTest resultsPath exists on disk for browser: ${browser}`, () => {
        expect(
          fs.existsSync((result as SuccessfulTestResult).resultsPath),
        ).toBe(true);
      });
    },
  );
});
