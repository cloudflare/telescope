import { Command, Option } from 'commander';
const program = new Command();
import { BrowserConfig } from './lib/browsers.js';
import { TestRunner } from './lib/testRunner.js';
import { ChromeRunner } from './lib/chromeRunner.js';
import { log } from './lib/helpers.js';
import { normalizeConfig } from './lib/config.js';

/**
 * Execute a test with raw options.
 *
 * @param {Object} options - Test options (raw from CLI or programmatic use)
 * @returns {Promise<{success: boolean, testId: string, resultsPath: string}>}
 * @private
 */
async function executeTest(options) {
  const rawOptions = { ...options };

  if (rawOptions.flags) {
    const extraArgs = Array.isArray(rawOptions.flags)
      ? rawOptions.flags
      : rawOptions.flags.split(',');
    rawOptions.args = extraArgs.map(flag => flag.trim()).filter(Boolean);
  }

  const browserConfig = new BrowserConfig().getBrowserConfig(
    rawOptions.browser || 'chrome',
    rawOptions,
  );

  const config = normalizeConfig(rawOptions);

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
 * Returns `{success: true, testId, resultsPath}` on success or `{success: false, error}` on failure.
 *
 * @param {Object} options - Test configuration (see CLI --help for available options)
 * @param {string} options.url - URL to test (required)
 * @param {string} [options.browser='chrome'] - Browser engine to use
 * @returns {Promise<Object>} Test result with success status and either test data or error
 *
 * @example
 * const result = await launchTest({ url: 'https://example.com', browser: 'chrome' });
 * if (result.success) console.log(`Test: ${result.testId}`);
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
    .name('browser-agent')
    .description('Cross-browser synthetic testing agent')
    .requiredOption('-u, --url <url>', 'URL to run tests against')
    .addOption(
      new Option('-b, --browser <browser_name>', 'Browser to tests against')
        .default('chrome')
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
      ).default([]),
    )
    .addOption(
      new Option(
        '--block <substrings...>',
        'A comma-delimited list of urls to block (based on a substring match)',
      ).default([]),
    )
    .addOption(
      new Option(
        '--firefoxPrefs <object>',
        'Any Firefox User Preferences to apply (Firefox only)',
      ),
    )
    .addOption(new Option('--cpuThrottle <int>', 'CPU throttling factor'))
    .addOption(
      new Option(
        '--connectionType <string>',
        'Network connection type. By default, no throttling is applied.',
      )
        .default(false)
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
      new Option('--width <int>', 'Viewport width, in pixels').default('1366'),
    )
    .addOption(
      new Option('--height <int>', 'Viewport height, in pixels').default('768'),
    )
    .addOption(
      new Option(
        '--frameRate <int>',
        'Filmstrip frame rate, in frames per second',
      ).default(1),
    )
    .addOption(new Option('--disableJS', 'Disable JavaScript').default(false))
    .addOption(new Option('--debug', 'Output debug lines').default(false))
    .addOption(
      new Option(
        '--auth <object>',
        'Basic HTTP authentication (Expects: {"username": "", "password":""}) ',
      ).default(false),
    )
    .addOption(
      new Option(
        '--timeout <int>',
        'Maximum time (in milliseconds) to wait for test to complete',
      ).default(30000),
    )
    .addOption(new Option('--html', 'Generate HTML report').default(false))
    .addOption(
      new Option('--list', 'Generate list of results in HTML').default(false),
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
