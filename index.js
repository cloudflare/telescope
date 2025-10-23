import { Command, Option } from 'commander';
const program = new Command();
import { BrowserConfig } from './lib/browsers.js';
import { TestRunner } from './lib/TestRunner.js';
import { ChromeRunner } from './lib/ChromeRunner.js';
import { log } from './lib/helpers.js';

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
  if (options.debug) {
    process.env.DEBUG_MODE = true;
  }
  log(options);
  //setup flags
  if (options.flags) {
    //chrome flags
    let flags = options.flags;
    options.args = flags.split(',');
  }
  let browserConfig = new BrowserConfig().getBrowserConfig(
    options.browser,
    options,
  );

  function getRunner(options, browserConfig) {
    if (browserConfig.engine === 'chromium') {
      return new ChromeRunner(options, browserConfig);
    } else {
      return new TestRunner(options, browserConfig);
    }
  }
  const Runner = getRunner(options, browserConfig);

  (async () => {
    await Runner.setupTest();
    await Runner.doNavigation();
    await Runner.postProcess();
  })();
}
