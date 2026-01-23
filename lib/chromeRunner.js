import { TestRunner } from './testRunner.js';
import { log } from './helpers.js';
import path from 'path';

class ChromeRunner extends TestRunner {
  constructor(options, browserConfig) {
    //call parent
    super(options, browserConfig);
    this.cdpClient = null;
  }
  /**
   * Given a browser instance, grab the page and then kick off anything that
   * needs to be attached at the page level
   */
  async createPage(browser) {
    const page = await browser.pages()[0];
    this.cdpClient = await page.context().newCDPSession(page);
    if (this.options.cpuThrottle) {
      log('CPU THROTTLE ' + this.options.cpuThrottle);
      await this.cdpClient.send('Emulation.setCPUThrottlingRate', {
        rate: this.options.cpuThrottle,
      });
    }
    await this.preparePage(page);

    return page;
  }
  
  /**
   * Overrides doNavigation to detach CDP client before closing browser
   */
  async doNavigation() {
    try {
      await this.page.goto(this.testURL, { waitUntil: 'networkidle' });
    } catch (err) {
      // If navigation timed out, set the context offline and continue.
      if (err && (err.name === 'TimeoutError' || /Timeout/.test(err.message))) {
        await this.page.context().setOffline(true);
      } else {
        throw err;
      }
    }
    // grab our screenshot
    await this.page.screenshot({
      path: this.paths['results'] + '/screenshot.png',
    });

    //grab the videoname
    this.videoRecordingFile = await this.page.video().path();
    this.resultAssets.videoFile = path.relative(
      this.paths['results'],
      this.videoRecordingFile,
    );
    //collect metrics
    await this.collectMetrics();

    // Detach CDP client before closing browser
    if (this.cdpClient) {
      try {
        log('Detaching CDP client');
        await this.cdpClient.detach();
        this.cdpClient = null;
      } catch (err) {
        // Log but don't fail if detach errors
        log('CDP client detach error: ' + err.message);
      }
    }

    //close our browser instance
    await this.browserInstance.close();
  }
}
export { ChromeRunner };
