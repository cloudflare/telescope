import { TestRunner } from './testRunner.js';
import { log } from './helpers.js';
import type { PriorityInfo } from './types.js';
import type { BrowserContext, Page, CDPSession } from 'playwright';

const TELESCOPE_ID_HEADER = 'x-telescope-id';

class ChromeRunner extends TestRunner {
  /**
   * Given a browser instance, grab the page and then kick off anything that
   * needs to be attached at the page level
   */
  async createPage(browser: BrowserContext): Promise<Page> {
    const page = browser.pages()[0];
    const client: CDPSession = await page.context().newCDPSession(page);

    if (this.options.priority) {
      await this.collectPriorities(client);
    }

    if (this.options.cpuThrottle) {
      log('CPU THROTTLE ' + this.options.cpuThrottle);
      await client.send('Emulation.setCPUThrottlingRate', {
        rate: this.options.cpuThrottle,
      });
    }
    await this.preparePage(page);

    return page;
  }

  /**
   * Subscribe to the CDP Network events that report resource fetch priorities.
   *
   * Only called when the `priority` option is enabled — collecting priorities
   * relies on the `x-telescope-id` request header to map CDP request IDs onto
   * HAR entries, and injecting that header disables the browser HTTP cache.
   * See https://github.com/cloudflare/telescope/issues/327.
   */
  async collectPriorities(client: CDPSession): Promise<void> {
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
  }
}

export { ChromeRunner };
