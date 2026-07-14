import { TestRunner } from './testRunner.js';
import { log } from './helpers.js';
import type { BrowserConfigOptions, LaunchOptions, PriorityInfo } from './types.js';
import type { BrowserContext, Page, CDPSession } from 'playwright';

const TELESCOPE_ID_HEADER = 'x-telescope-id';

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
    await client.send('Network.enable');

    // Just before request is sent
    client.on('Network.requestWillBeSent', (params) => {
      const { requestId, request } = params;

      this.priorities[requestId as keyof PriorityInfo] = {
        initialPriority: request.initialPriority,
      };
    });

    // We want all the headers
    client.on('Network.requestWillBeSentExtraInfo', (params) => {
      const { requestId, headers } = params;

      const telescopeHeader = Object.entries(headers)
        .filter(header => header[0].toLowerCase() === TELESCOPE_ID_HEADER)[0];

      if (telescopeHeader) {
        const telescopeId = telescopeHeader[1];
        this.telescopeIdToRequestId[telescopeId] = requestId;
      }
    });

    client.on('Network.resourceChangedPriority', (params) => {
      const { requestId, newPriority } = params;

      this.newPriorities[requestId] = newPriority;
    });

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
