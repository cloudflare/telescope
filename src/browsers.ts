import fs from 'fs';
import type {
  BrowserName,
  BrowserConfigOptions,
  BrowserConfigEntry,
  LaunchOptions,
} from './types.js';

// should browsers be headless? defaults to false unless running in CI
const headless = !!process.env.CI;

type BrowserConfigs = Record<BrowserName, BrowserConfigEntry>;

class BrowserConfig {
  defaultChromiumArgs: string[] = [
    '--allow-running-insecure-content',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-breakpad',
    '--disable-client-side-phishing-detection',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-domain-reliability',
    '--disable-fetching-hints-at-navigation-start',
    '--disable-hang-monitor',
    '--disable-ipc-flooding-protection',
    '--disable-prompt-on-repost',
    '--disable-renderer-backgrounding',
    '--disable-sync',
    '--metrics-recording-only',
    '--mute-audio',
    '--new-window',
    '--no-default-browser-check',
    '--no-first-run',
    '--password-store=basic',
    '--use-mock-keychain',
    '--window-position="0,0"',
    '--window-size="1366,768"',
    '--remote-debugging-port=0',
  ];

  defaultIgnoreArgs: string[] = [
    //this one is causing padding on the video oddly...
    //since the reported issue is the opposite: https://bugs.chromium.org/p/chromium/issues/detail?id=1277272
    // '--enable-automation',
    '--no-sandbox',
  ];

  defaultBrowserOptions: Pick<
    BrowserConfigOptions,
    'headless' | 'viewport' | 'recordHar' | 'recordVideo'
  > = {
    headless,
    viewport: { width: 1366, height: 768 },
    recordHar: {
      path: './results/example.har',
    },
    recordVideo: {
      dir: './recordings',
      size: { width: 1366, height: 768 },
    },
  };

  static browserConfigs: BrowserConfigs = {
    chrome: {
      engine: 'chromium',
      channel: 'chrome',
      headless,
      flags: true,
      args: [],
    },
    'chrome-beta': {
      engine: 'chromium',
      channel: 'chrome-beta',
      headless,
      flags: true,
      args: [],
    },
    //canary seems to be failing 3/14
    canary: {
      engine: 'chromium',
      channel: 'chrome-canary',
      headless,
      flags: true,
      args: [],
    },
    firefox: {
      engine: 'firefox',
      headless,
      firefoxUserPrefs: {},
      mozLog: false,
    },
    safari: {
      engine: 'webkit',
      headless,
    },
    edge: {
      engine: 'chromium',
      channel: 'msedge',
      headless,
      flags: true,
      args: [],
    },
  };

  browser: BrowserName | undefined;

  constructor(browser?: BrowserName) {
    this.browser = browser;
  }

  static getBrowsers(): BrowserName[] {
    // only run firefox in CI (for now)
    return process.env.CI
      ? ['firefox']
      : (Object.keys(BrowserConfig.browserConfigs) as BrowserName[]);
  }

  addFirefoxPrefs(prefs: Record<string, string | number | boolean>): void {
    const userPrefLines: string[] = [];
    for (const [key, value] of Object.entries(prefs)) {
      let prefline = '';
      if (typeof value == 'boolean') {
        prefline = `user_pref("${key}", ${value});\n`;
      } else {
        prefline = `user_pref("${key}", "${value}");\n`;
      }
      userPrefLines.push(prefline);
    }
    userPrefLines.forEach(s => fs.appendFileSync('./tmp/user.js', s));
  }

  createUserDataDir(browserConfig: BrowserConfigEntry): void {
    //let's make sure there's a user directory
    const userDataDir = './tmp';
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir);
    }
    if (browserConfig.engine == 'firefox') {
      //let's copy over our starter user.js
      // eventually, it'd be nice to avoid this but playwright doesn't
      // let you set firefox user pref on an persisted context
      fs.copyFile('./support/firefox/user.js', './tmp/user.js', err => {
        if (err) {
          console.error('Error Creating User Data Directory:', err);
        }
      });
    }
  }

  getBrowserConfig(
    browser: BrowserName,
    options: LaunchOptions,
  ): BrowserConfigOptions {
    //check for browser and see if it has value
    if (
      !Object.prototype.hasOwnProperty.call(
        BrowserConfig.browserConfigs,
        browser,
      )
    ) {
      throw new Error('Invalid browser name');
    }

    const baseConfig = BrowserConfig.browserConfigs[browser];
    const browserConfig: BrowserConfigOptions = {
      ...baseConfig,
      ...this.defaultBrowserOptions,
    };

    // Handle Chromium-specific args
    if ('args' in baseConfig && baseConfig.args) {
      browserConfig.args = [...baseConfig.args, ...this.defaultChromiumArgs];
      if (options.args) {
        browserConfig.args = [...browserConfig.args, ...options.args];
      }
      browserConfig.ignoreDefaultArgs = this.defaultIgnoreArgs;
    }

    // Handle Firefox preferences
    if (
      'firefoxUserPrefs' in baseConfig &&
      baseConfig.firefoxUserPrefs &&
      options.firefoxPrefs
    ) {
      this.createUserDataDir(baseConfig);
      this.addFirefoxPrefs(options.firefoxPrefs);
      browserConfig.firefoxUserPrefs = options.firefoxPrefs || {};
    }

    // Handle Firefox mozLog
    if ('mozLog' in baseConfig && baseConfig.mozLog) {
      //quick test for firefox
      browserConfig.env = {
        MOZ_LOG_FILE: 'moz.log',
        MOZ_LOG:
          'timestamp,nsHttp:{0:d},nsSocketTransport:{0:d},nsHostResolver:{0:d},pipnss:5',
      };
    }

    if (options.width) {
      browserConfig.viewport.width = options.width;
      browserConfig.recordVideo.size.width = options.width;
    }
    if (options.height) {
      browserConfig.viewport.height = options.height;
      browserConfig.recordVideo.size.height = options.height;
    }

    return browserConfig;
  }
}

export { BrowserConfig };
