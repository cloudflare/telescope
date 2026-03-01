import { TestRunner } from './testRunner.js';
import { log } from './helpers.js';
class ChromeRunner extends TestRunner {
  constructor(options, browserConfig) {
    //call parent
    super(options, browserConfig);
  }
  /**
   * Given a browser instance, grab the page and then kick off anything that
   * needs to be attached at the page level
   */
  async createPage(browser) {
    const page = await browser.pages()[0];
    const client = await page.context().newCDPSession(page);
    await client.send('Network.enable');

    let occasion = this;

    // Just before request is sent
    client.on('Network.requestWillBeSent', (params) => {
      const { requestId, request, type } = params;
      const fullURL = request.url + (request.urlFragment || '');
      const resourceType = type || 'Other';

      if (occasion.priorities[fullURL]) {
        occasion.priorities[fullURL].push({
          requestId: requestId,
          initial_priority: request.initialPriority,
          resourceType: resourceType
        });
      } else {
        occasion.priorities[fullURL] = [{
          requestId: requestId,
          initial_priority: request.initialPriority,
          resourceType: resourceType
        }];
      }
    });

    client.on('Network.resourceChangedPriority', (params) => {
      const { requestId, newPriority } = params;

      occasion.new_priorities[requestId] = newPriority;
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
