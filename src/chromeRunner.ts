import { TestRunner } from './testRunner.js';
import { log } from './helpers.js';
import type { BrowserConfigOptions, LaunchOptions } from './types.js';
import type { BrowserContext, Page, CDPSession } from 'playwright';

class ChromeRunner extends TestRunner {
  constructor(options: LaunchOptions, browserConfig: BrowserConfigOptions) {
    //call parent
    super(options, browserConfig);
  }

  /**
   * Given a browser instance, grab the page and then kick off anything that
   * needs to be attached at the page level
   */
  async createPage(browser: BrowserContext): Promise<Page> {
    const page = browser.pages()[0];
    const client: CDPSession = await page.context().newCDPSession(page);
    if (this.options.cpuThrottle) {
      log('CPU THROTTLE ' + this.options.cpuThrottle);
      await client.send('Emulation.setCPUThrottlingRate', {
        rate: this.options.cpuThrottle,
      });
    }
    await this.preparePage(page);

    return page;
  }
}

export { ChromeRunner };
