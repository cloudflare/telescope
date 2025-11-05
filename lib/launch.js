import { BrowserConfig } from './browsers.js';
import { TestRunner } from './testRunner.js';
import { ChromeRunner } from './chromeRunner.js';

/**
 * @typedef {Parameters<import('playwright').BrowserContext['addCookies']>[0][number]} Cookie
 */

/**
 * @typedef {Object} LaunchOptions
 * @property {string} url
 * @property {string} browser
 * @property {Record<string, string>=} headers
 * @property {Cookie|Array<Cookie>=} cookies
 * @property {string[]=} args
 * @property {string[]=} blockDomains
 * @property {string[]=} block
 * @property {Record<string, unknown>=} firefoxPrefs
 * @property {number=} cpuThrottle
 * @property {keyof typeof import('./connectivity.js').networkTypes=} connectionType
 * @property {number=} width
 * @property {number=} height
 * @property {number=} frameRate
 * @property {boolean=} disableJS
 * @property {boolean=} debug
 * @property {import('playwright').HTTPCredentials=} auth
 * @property {number=} timeout
 * @property {boolean=} html
 * @property {boolean=} list
 */

/**
 * @param {LaunchOptions} options
 * @param {BrowserConfig} browserConfig
 * @returns {TestRunner|ChromeRunner}
 */
function getRunner(options, browserConfig) {
  if (browserConfig.engine === 'chromium') {
    return new ChromeRunner(options, browserConfig);
  } else {
    return new TestRunner(options, browserConfig);
  }
}

/**
 * Launches a browser instance with the specified options.
 * @param {LaunchOptions} options - The launch options.
 */
export async function launch(options) {
  if (options.flags) {
    options.args = options.flags.split(',');
  }

  const browserConfig = new BrowserConfig().getBrowserConfig(
    options.browser,
    options,
  );

  const Runner = getRunner(options, browserConfig);

  await Runner.setupTest();
  await Runner.doNavigation();
  await Runner.postProcess();
}
