import fs from 'fs';
import { devices } from 'playwright';
import type { SuccessfulTestResult } from '../src/index.js';
import { launchTest } from '../src/index.js';
import { BrowserConfig } from '../src/browsers.js';
import { normalizeCLIConfig } from '../src/config.js';
import type {
  LaunchOptions,
  BrowserConfigOptions,
  CustomDeviceDescriptor,
} from '../src/types.js';
import { describe, it, expect, beforeAll } from 'vitest';

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
        let config_options: LaunchOptions;
        let config: BrowserConfigOptions;

        beforeAll(() => {
          config_options = normalizeCLIConfig({
            browser,
            device: device,
            url: '../tests/sandbox/index.html',
          });
          config = new BrowserConfig().getBrowserConfig(
            browser,
            config_options,
          );
        });

        it(`Test device emulation does not set default width and height values for browser: ${browser}`, () => {
          expect(config_options && typeof config_options === 'object').toBe(
            true,
          );
          expect(config_options.width).toBeUndefined();
          expect(config_options.height).toBeUndefined();
        });
        it(`Setting device emulation creates a valid config object for browser: ${browser}`, () => {
          expect(config && typeof config === 'object').toBe(true);
        });
        // test collecting device data for desktop devices
        if (device.toLowerCase().includes('desktop')) {
          it(`Setting device emulation sets isMobile to false for desktop devices for browser: ${browser}`, () => {
            expect(config.isMobile).toBe(false);
          });
          it(`Setting device emulation sets hasTouch to false for desktop devices for browser: ${browser}`, () => {
            expect(config.hasTouch).toBe(false);
          });
        }
        // test collecting device data for non-desktop devices
        else {
          it(`Setting device emulation sets isMobile to true for non-desktop devices for browser: ${browser}`, () => {
            expect(config.isMobile).toBe(true);
          });
          it(`Setting device emulation sets hasTouch to true for non-desktop devices for browser: ${browser}`, () => {
            expect(config.hasTouch).toBe(true);
          });
          it(`Setting device emulation sets deviceScaleFactor for non-desktop devices for browser: ${browser}`, () => {
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
        let config_options: LaunchOptions;
        let config: BrowserConfigOptions;

        beforeAll(() => {
          config_options = normalizeCLIConfig({
            browser,
            device: device,
            url: '../tests/sandbox/index.html',
            width: 1122,
            height: 3344,
          });
          config = new BrowserConfig().getBrowserConfig(
            browser,
            config_options,
          );
        });

        it(`Test device emulation allows width and height values to override device settings for browser: ${browser}`, () => {
          expect(config_options && typeof config_options === 'object').toBe(
            true,
          );
          expect(config_options.width).toBe(1122);
          expect(config_options.height).toBe(3344);
        });
        // test collecting device data for desktop devices
        if (device.toLowerCase().includes('desktop')) {
          it(`Setting device emulation sets isMobile to false for desktop devices for browser: ${browser}`, () => {
            expect(config.isMobile).toBe(false);
          });
          it(`Setting device emulation sets hasTouch to false for desktop devices for browser: ${browser}`, () => {
            expect(config.hasTouch).toBe(false);
          });
        }
        // test collecting device data for non-desktop devices
        else {
          it(`Setting device emulation sets isMobile to true for non-desktop devices for browser: ${browser}`, () => {
            expect(config.isMobile).toBe(true);
          });
          it(`Setting device emulation sets hasTouch to true for non-desktop devices for browser: ${browser}`, () => {
            expect(config.hasTouch).toBe(true);
          });
          it(`Setting device emulation sets deviceScaleFactor for non-desktop devices for browser: ${browser}`, () => {
            expect(config.deviceScaleFactor).toBeDefined();
          });
        }
        it(`Setting device emulation sets viewport width to override value for browser: ${browser}`, () => {
          expect(config.viewport.width).toBe(1122);
        });
        it(`Setting device emulation sets viewport height to override value for browser: ${browser}`, () => {
          expect(config.viewport.height).toBe(3344);
        });
        it(`Setting device emulation sets recordVideo width to override value for browser: ${browser}`, () => {
          expect(config.recordVideo.size.width).toBe(1122);
        });
        it(`Setting device emulation sets recordVideo height to override value for browser: ${browser}`, () => {
          expect(config.recordVideo.size.height).toBe(3344);
        });
      },
    );
  },
);

describe.each(browsers)('Device Emulation Tests', browser => {
  // device emulation causes timeouts in canary and beta for chrome,
  // telescope is not guarunteed to work in canary or beta
  describe.each(target_devices)(
    'launchTest executes and returns result object when emulating device: %s',
    device => {
      let result: Awaited<ReturnType<typeof launchTest>>;
      beforeAll(async () => {
        let options = {
          browser,
          device: device,
          url: 'https://www.example.com/',
        };
        const launchOptions = normalizeCLIConfig(options);
        result = await launchTest(launchOptions);
      }, 60000);
      it(`launchTest returns a result with success property for browser: ${browser}`, () => {
        expect(result).toHaveProperty('success');
      });
      it(`launchTest returns a result with testId property for browser: ${browser}`, () => {
        expect(result).toHaveProperty('testId');
      });
      it(`launchTest returns a result with resultsPath property for browser: ${browser}`, () => {
        expect(result).toHaveProperty('resultsPath');
      });
      it(`launchTest succeeds for browser: ${browser}`, () => {
        expect(result.success).toBe(true);
      });
      it(`launchTest resultsPath exists on disk for browser: ${browser}`, () => {
        expect(
          fs.existsSync((result as SuccessfulTestResult).resultsPath),
        ).toBe(true);
      });
    },
  );
});

// Expected engine for each device's defaultBrowserType
const deviceBrowserExpectations: {
  device: string;
  expectedBrowser: string;
  expectedEngine: string;
}[] = [
  { device: 'iPhone 15', expectedBrowser: 'safari', expectedEngine: 'webkit' },
  { device: 'Pixel 7', expectedBrowser: 'chrome', expectedEngine: 'chromium' },
  {
    device: 'Desktop Safari',
    expectedBrowser: 'safari',
    expectedEngine: 'webkit',
  },
  {
    device: 'Desktop Chrome',
    expectedBrowser: 'chrome',
    expectedEngine: 'chromium',
  },
  {
    device: 'Desktop Firefox',
    expectedBrowser: 'firefox',
    expectedEngine: 'firefox',
  },
];

describe('Device default browser resolution', () => {
  describe.each(deviceBrowserExpectations)(
    'Device only (no -b): $device',
    ({ device, expectedBrowser, expectedEngine }) => {
      let config_options: LaunchOptions;
      let config: BrowserConfigOptions;

      beforeAll(() => {
        config_options = normalizeCLIConfig({
          device,
          url: '../tests/sandbox/index.html',
        });
        config = new BrowserConfig().getBrowserConfig(
          config_options.browser!,
          config_options,
        );
      });

      it(`resolves browser to "${expectedBrowser}"`, () => {
        expect(config_options.browser).toBe(expectedBrowser);
      });

      it(`resolves engine to "${expectedEngine}"`, () => {
        expect(config.engine).toBe(expectedEngine);
      });
    },
  );

  describe.each(deviceBrowserExpectations)(
    'Device + explicit -b override: $device',
    ({ device }) => {
      let config_options: LaunchOptions;
      let config: BrowserConfigOptions;

      beforeAll(() => {
        config_options = normalizeCLIConfig({
          device,
          browser: 'firefox',
          url: '../tests/sandbox/index.html',
        });
        config = new BrowserConfig().getBrowserConfig(
          config_options.browser!,
          config_options,
        );
      });

      it('explicit -b overrides device default browser', () => {
        expect(config_options.browser).toBe('firefox');
      });

      it('engine matches the explicit browser, not the device', () => {
        expect(config.engine).toBe('firefox');
      });
    },
  );

  describe('Browser only (no device)', () => {
    it('uses the provided browser', () => {
      const config_options = normalizeCLIConfig({
        browser: 'safari',
        url: '../tests/sandbox/index.html',
      });
      expect(config_options.browser).toBe('safari');

      const config = new BrowserConfig().getBrowserConfig(
        config_options.browser!,
        config_options,
      );
      expect(config.engine).toBe('webkit');
    });
  });

  describe('Neither device nor browser', () => {
    it('defaults to chrome/chromium', () => {
      const config_options = normalizeCLIConfig({
        url: '../tests/sandbox/index.html',
      });
      expect(config_options.browser).toBe('chrome');

      const config = new BrowserConfig().getBrowserConfig(
        config_options.browser!,
        config_options,
      );
      expect(config.engine).toBe('chromium');
    });
  });
});
