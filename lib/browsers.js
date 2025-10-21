import fs from 'fs';

class BrowserConfig {
  defaultChromiumArgs = [
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
  defaultIgnoreArgs = [
    //this one is causing padding on the video oddly...
    //since the reported issue is the opposite: https://bugs.chromium.org/p/chromium/issues/detail?id=1277272
    // '--enable-automation',
    '--no-sandbox',
  ];
  defaultBrowserOptions = {
    headless: false,
    viewport: { width: 1366, height: 768 },
    recordHar: {
      path: './results/example.har',
    },
    recordVideo: {
      dir: './recordings',
      size: { width: 1366, height: 768 },
    },
  };
  static browserConfigs = {
    chrome: {
      engine: 'chromium',
      channel: 'chrome',
      headless: false,
      flags: true,
      args: [],
    },
    'chrome-beta': {
      engine: 'chromium',
      channel: 'chrome-beta',
      headless: false,
      flags: true,
      args: [],
    },
    //canary seems to be failing 3/14
    canary: {
      engine: 'chromium',
      channel: 'chrome-canary',
      headless: false,
      flags: true,
      args: [],
    },
    firefox: {
      engine: 'firefox',
      headless: false,
      firefoxUserPrefs: {},
      mozLog: false,
    },
    safari: {
      engine: 'webkit',
      headless: false,
    },
    edge: {
      engine: 'chromium',
      channel: 'msedge',
      headless: false,
      flags: true,
      args: [],
    },
  };
  constructor(browser) {
    this.browser = browser;
  }
  static getBrowsers() {
    return Object.keys(BrowserConfig.browserConfigs);
  }
  addFirefoxPrefs(prefs) {
    let userPrefLines = [];
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
  createUserDataDir(browserConfig) {
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
  getBrowserConfig(browser, options) {
    //check for browser and see if it has value

    if (!BrowserConfig.browserConfigs.hasOwnProperty(browser)) {
      throw new Error('Invalid browser name');
    }

    let browserConfig = Object.assign(
      {},
      BrowserConfig.browserConfigs[browser],
      this.defaultBrowserOptions,
    );
    if (browserConfig.args) {
      browserConfig.args = [...browserConfig.args, ...this.defaultChromiumArgs];
      if (options.args) {
        browserConfig.args = [...browserConfig.args, ...options.args];
      }
      browserConfig.ignoreDefaultArgs = this.defaultIgnoreArgs;
    }
    if (browserConfig.firefoxUserPrefs && options.firefoxPrefs) {
      this.createUserDataDir(browserConfig);
      this.addFirefoxPrefs(JSON.parse(options.firefoxPrefs));
      browserConfig.firefoxUserPrefs = options.firefoxPrefs
        ? JSON.parse(options.firefoxPrefs)
        : {};
    }
    if (browserConfig.mozLog) {
      //quick test for firefox
      browserConfig.env = {
        MOZ_LOG_FILE: 'moz.log',
        MOZ_LOG:
          'timestamp,nsHttp:{0:d},nsSocketTransport:{0:d},nsHostResolver:{0:d},pipnss:5',
      };
    }
    if (options.width) {
      browserConfig.viewport.width = parseFloat(options.width * 1);
      browserConfig.recordVideo.size.width = parseFloat(options.width * 1);
    }
    if (options.height) {
      browserConfig.viewport.height = parseFloat(options.height * 1);
      browserConfig.recordVideo.size.height = parseFloat(options.height * 1);
    }
    return browserConfig;
  }
}

export { BrowserConfig };
