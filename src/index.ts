import { Command, Option } from 'commander';
const program = new Command();
import { BrowserConfig } from './browsers.js';
import { TestRunner } from './testRunner.js';
import { ChromeRunner } from './chromeRunner.js';
import { log } from './helpers.js';
import { normalizeCLIConfig } from './config.js';
import { DEFAULT_OPTIONS } from './defaultOptions.js';
import type {
  LaunchOptions,
  BrowserConfigOptions,
  SuccessfulTestResult,
  FailedTestResult,
  TestResult,
  CLIOptions,
  Cookie,
} from './types.js';

// Re-export types for library consumers
export type {
  LaunchOptions,
  TestResult,
  SuccessfulTestResult,
  FailedTestResult,
  Cookie,
};

/**
 * Telescope class for programmatic usage.
 * Provides an object-oriented interface to the testing functionality.
 *
 * @example
 * const telescope = new Telescope({ url: 'https://example.com', browser: 'chrome' });
 * const result = await telescope.run();
 */
export class Telescope {
  private options: LaunchOptions;

  constructor(options: LaunchOptions) {
    this.options = options;
  }

  /**
   * Run the test with the configured options.
   * @returns Test result with ID and results path, or error information
   */
  async run(): Promise<TestResult> {
    return launchTest(this.options);
  }
}

/**
 * Get the appropriate runner based on the browser engine
 */
function getRunner(
  options: LaunchOptions,
  browserConfig: BrowserConfigOptions,
): TestRunner {
  if (browserConfig.engine === 'chromium') {
    return new ChromeRunner(options, browserConfig);
  } else {
    return new TestRunner(options, browserConfig);
  }
}

/**
 * Execute a test with raw options.
 * Internal function that handles the core test execution flow.
 * Normalizes options, creates browser instance, runs test, and ensures cleanup.
 *
 * @param options - Test options (raw from CLI or programmatic use)
 * @returns Test result with ID and results path
 * @throws If the test fails
 * @private
 */
async function executeTest(
  options: LaunchOptions,
): Promise<SuccessfulTestResult> {
  const config: LaunchOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  const browserConfig = new BrowserConfig().getBrowserConfig(
    config.browser || 'chrome',
    config,
  );

  if (config.debug) {
    process.env.DEBUG_MODE = 'true';
  }

  log(config);

  const Runner = getRunner(config, browserConfig);

  try {
    await Runner.saveConfig();

    // Bail out early if we're just doing a dry run
    if (config.dry) {
      await Runner.cleanup();

      return {
        success: true,
        dry: true,
        testId: Runner.TESTID,
        resultsPath: Runner.paths.results,
      };
    }

    await Runner.setupTest();
    await Runner.doNavigation();
    await Runner.postProcess();

    return {
      success: true,
      testId: Runner.TESTID,
      resultsPath: Runner.paths.results,
    };
  } catch (error) {
    // Ensure cleanup runs even on error (closes browser + removes temp files)
    try {
      await Runner.cleanup();
    } catch (_cleanupError) {
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
 * @param options - Test configuration (see CLI --help for available options)
 * @returns Result object: {success, testId, resultsPath} or {success, error}
 *
 * @example
 * const result = await launchTest({ url: 'https://example.com', browser: 'chrome' });
 * if (result.success) console.log(`Test: ${result.testId}`);
 * else console.error(`Failed: ${result.error}`);
 */
export async function launchTest(options: LaunchOptions): Promise<TestResult> {
  try {
    return await executeTest(options);
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

export default function browserAgent(): void {
  program
    .name('telescope')
    .description('Cross-browser synthetic testing agent')
    .requiredOption('-u, --url <url>', 'URL to run tests against')
    .addOption(
      new Option('-b, --browser <browser_name>', 'Browser to run tests with')
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
          'dsl',
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
        'Basic HTTP authentication (Expects: {"username": "", "password": ""})',
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
      new Option(
        '--openHtml',
        'Open HTML report in browser (requires --html)',
      ).default(DEFAULT_OPTIONS.openHtml),
    )
    .addOption(
      new Option('--list', 'Generate list of results in HTML').default(
        DEFAULT_OPTIONS.list,
      ),
    )
    .addOption(
      new Option(
        '--overrideHost <object>',
        'Override the hostname of a URI with another host (Expects: {"example.com": "example.org"})',
      ),
    )
    .addOption(
      new Option(
        '--zip',
        'Zip the results of the test into the results directory.',
      ).default(DEFAULT_OPTIONS.zip),
    )
    .addOption(
      new Option(
        '--dry',
        'Dry run (do not run test, just save config and cleanup)',
      ).default(DEFAULT_OPTIONS.dry),
    )
    .parse(process.argv);

  const cliOptions = program.opts() as CLIOptions;
  let options: LaunchOptions;

  try {
    options = normalizeCLIConfig(cliOptions);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }

  // Capture the CLI command for repeatability
  if (process.argv.length > 2) {
    options.command = process.argv.slice(2);
  }

  (async () => {
    const result = await launchTest(options);
    if (!result.success) {
      console.error('Test failed:', result.error);
      process.exit(1);
    }
  })();
}
