import { Command, Option } from 'commander';
const program = new Command();
import { BrowserConfig } from './lib/browsers.js';
import { TestRunner } from './lib/testRunner.js';
import { ChromeRunner } from './lib/chromeRunner.js';
import { log } from './lib/helpers.js';
import { normalizeConfig } from './lib/config.js';
import { DEFAULT_OPTIONS } from './lib/defaultOptions.js';

/**
 * Execute a test with raw options.
 * Internal function that handles the core test execution flow.
 * Normalizes options, creates browser instance, runs test, and ensures cleanup.
 *
 * @param {Object} options - Test options (raw from CLI or programmatic use)
 * @returns {Promise<{success: boolean, testId: string, resultsPath: string}>} Test result with ID and results path
 * @private
 */
async function executeTest(options) {
  const config = normalizeConfig(options);

  if (config.flags) {
    const extraArgs = Array.isArray(config.flags)
      ? config.flags
      : config.flags.split(',');
    config.args = extraArgs.map(flag => flag.trim()).filter(Boolean);
  }

  const browserConfig = new BrowserConfig().getBrowserConfig(
    config.browser || 'chrome',
    config,
  );

  if (config.debug) {
    process.env.DEBUG_MODE = true;
  }

  log(config);

  function getRunner(config, browserConfig) {
    if (browserConfig.engine === 'chromium') {
      return new ChromeRunner(config, browserConfig);
    } else {
      return new TestRunner(config, browserConfig);
    }
  }

  const Runner = getRunner(config, browserConfig);

  try {
    await Runner.setupTest();
    await Runner.doNavigation();
    await Runner.postProcess();

    return {
      success: true,
      testId: Runner.TESTID,
      resultsPath: Runner.paths.results,
    };
  } catch (error) {
    // Ensure cleanup runs even on error
    try {
      Runner.cleanup();
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Run a browser performance test.
 * Public programmatic API that wraps executeTest with error handling.
 * Always returns a result object (never throws).
 *
 * @param {Object} options - Test configuration (see CLI --help for available options)
 * @param {string} options.url - URL to test (required)
 * @param {string} [options.browser='chrome'] - Browser engine to use
 * @returns {Promise<Object>} Result object: {success, testId, resultsPath} or {success, error}
 *
 * @example
 * const result = await launchTest({ url: 'https://example.com', browser: 'chrome' });
 * if (result.success) console.log(`Test: ${result.testId}`);
 * else console.error(`Failed: ${result.error}`);
 */
export async function launchTest(options) {
  try {
    return await executeTest(options);
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export default function browserAgent() {
  program
    .name('telescope')
    .description('Cross-browser synthetic testing agent')
    .requiredOption('-u, --url <url>', 'URL to run tests against')
    .addOption(
      new Option('-b, --browser <browser_name>', 'Browser to tests against')
        .default(DEFAULT_OPTIONS.browser)
        .choices([
          'chrome',
          'chrome-beta',
          'canary',
          'edge',
          'safari',
          'firefox',
        ]),
    )
    .addOption(
      new Option(
        '-h, --headers <object>',
        'Any custom headers to apply to requests',
      ),
    )
    .addOption(
      new Option('-c, --cookies <object>', 'Any custom cookies to apply'),
    )
    .addOption(
      new Option(
        '-f, --flags <string>',
        'A comma separated list of Chromium flags to launch Chrome with. See: https://peter.sh/experiments/chromium-command-line-switches/',
      ),
    )
    .addOption(
      new Option(
        '--blockDomains <domains...>',
        'A comma separated list of domains to block',
      ).default(DEFAULT_OPTIONS.blockDomains),
    )
    .addOption(
      new Option(
        '--block <substrings...>',
        'A comma-delimited list of urls to block (based on a substring match)',
      ).default(DEFAULT_OPTIONS.block),
    )
    .addOption(
      new Option(
        '--firefoxPrefs <object>',
        'Any Firefox User Preferences to apply (Firefox only). Example: \'{"network.trr.mode": 2}\'',
      ),
    )
    .addOption(new Option('--cpuThrottle <int>', 'CPU throttling factor'))
    .addOption(
      new Option(
        '--connectionType <string>',
        'Network connection type. By default, no throttling is applied.',
      )
        .default(DEFAULT_OPTIONS.connectionType)
        .choices([
          'cable',
          'dls',
          '4g',
          '3g',
          '3gfast',
          '3gslow',
          '2g',
          'fios',
        ]),
    )
    .addOption(
      new Option('--width <int>', 'Viewport width, in pixels').default(
        String(DEFAULT_OPTIONS.width),
      ),
    )
    .addOption(
      new Option('--height <int>', 'Viewport height, in pixels').default(
        String(DEFAULT_OPTIONS.height),
      ),
    )
    .addOption(
      new Option(
        '--frameRate <int>',
        'Filmstrip frame rate, in frames per second',
      ).default(DEFAULT_OPTIONS.frameRate),
    )
    .addOption(
      new Option('--disableJS', 'Disable JavaScript').default(
        DEFAULT_OPTIONS.disableJS,
      ),
    )
    .addOption(
      new Option('--debug', 'Output debug lines').default(
        DEFAULT_OPTIONS.debug,
      ),
    )
    .addOption(
      new Option(
        '--auth <object>',
        'Basic HTTP authentication (Expects: {"username": "", "password":""}) ',
      ).default(DEFAULT_OPTIONS.auth),
    )
    .addOption(
      new Option(
        '--timeout <int>',
        'Maximum time (in milliseconds) to wait for test to complete',
      ).default(DEFAULT_OPTIONS.timeout),
    )
    .addOption(
      new Option('--html', 'Generate HTML report').default(
        DEFAULT_OPTIONS.html,
      ),
    )
    .addOption(
      new Option('--list', 'Generate list of results in HTML').default(
        DEFAULT_OPTIONS.list,
      ),
    )
    .parse(process.argv);

  const options = program.opts();

  (async () => {
    const result = await launchTest(options);
    if (!result.success) {
      console.error('Test failed:', result.error);
      process.exit(1);
    }
  })();
}
