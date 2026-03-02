import { TestRunner } from './testRunner.js';
import { log } from './helpers.js';
import type { BrowserConfigOptions, LaunchOptions, PriorityInfo } from './types.js';
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
    await client.send('Network.enable');

    let occasion = this;

    // Just before request is sent
    client.on('Network.requestWillBeSent', (params) => {
      const { requestId, request, type } = params;
      const fullURL = request.url + (request.urlFragment || '');
      const resourceType = type || 'Other';

      if (occasion.priorities[fullURL as keyof PriorityInfo]) {
        occasion.priorities[fullURL].push({
          requestId: requestId,
          initialPriority: request.initialPriority,
          resourceType: resourceType
        });
      } else {
        occasion.priorities[fullURL as keyof PriorityInfo] = [{
          requestId: requestId,
          initialPriority: request.initialPriority,
          resourceType: resourceType
        }];
      }
    });

    client.on('Network.resourceChangedPriority', (params) => {
      const { requestId, newPriority } = params;

      occasion.newPriorities[requestId] = newPriority;
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
