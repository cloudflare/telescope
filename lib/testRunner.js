import playwright from 'playwright';
import {
  mkdirSync,
  rmSync,
  copyFileSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'fs';
import path from 'path';
import url from 'url';
import { exec } from 'child_process';
import {
  start as throttleStart,
  stop as throttleStop,
} from '@sitespeed.io/throttle';
import { networkTypes } from './connectivity.js';
import ffmpeg from 'ffmpeg';
import ejs from 'ejs';
import { log, logTimer, generateTestID } from './helpers.js';

class TestRunner {
  args = [];
  consoleMessages = [];
  browserConfig;
  metrics = {};
  resourceTimings = {};
  paths = {};
  requests = [];
  resultAssets = {
    filmstripFiles: [],
    videoFile: null,
  };

  constructor(options, browserConfig) {
    this.options = options;
    this.testURL = options.url;
    this.selectedBrowser = browserConfig;
    this.TESTID = generateTestID();
    this.setupPaths(this.TESTID);
  }

  setupPaths(testID) {
    this.paths['temporaryContext'] = './tmp/';
    this.paths['results'] = './results/' + testID;
    this.paths['filmstrip'] = this.paths.results + '/filmstrip';
    mkdirSync(this.paths['results'], { recursive: true });

    this.selectedBrowser.recordHar.path =
      this.paths['results'] + '/pageload.har';
    this.selectedBrowser.recordVideo.dir = this.paths['results'];
  }

  /**
   * Set up any necessary request blocking, using the page.route handler
   */
  async setupBlocking(page) {
    await page.route('**/*', route => {
      if (
        this.options.blockDomains.some(d => route.request().url().startsWith(d))
      ) {
        route.abort();
      } else if (
        this.options.block.some(d => route.request().url().includes(d))
      ) {
        route.abort();
      } else {
        route.continue();
      }
    });
    return;
  }
  /**
   * Creates a browser instance using the browser config for the browser to be tested
   * Also merges in any browser-specific settings
   */
  async createBrowser() {
    //turn on logging
    this.selectedBrowser.logger = {
      isEnabled: (name, severity) => true,
      log: (name, severity, message) => {
        console.log(name + ' ' + severity + ' ' + message);
      },
    };
    if (this.options.disableJS) {
      this.selectedBrowser.javaScriptEnabled = false;
    }
    if (this.options.auth) {
      this.selectedBrowser.httpCredentials = this.options.auth;
    }
    const browser = await playwright[
      this.selectedBrowser.engine
    ].launchPersistentContext(
      this.paths['temporaryContext'],
      this.selectedBrowser,
    );
    await this.prepareContext(browser);
    return browser;
  }

  /**
   * Given a browser instance, grab the page and then kick off anything that
   * needs to be attached at the page level
   */
  async createPage(browser) {
    const page = await browser.pages()[0];
    await this.preparePage(page);
    return page;
  }
  setupConsoleMessages(page) {
    //collect console messages
    page.on('console', msg => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
      });
    });
    return;
  }
  async preparePage(page) {
    this.setupConsoleMessages(page);
    await this.setupBlocking(page);
    // page.on('request', data => {
    //     console.log("started: " + data.url());
    //     console.log("started: " + new Date().getTime());
    // })
    page.on('requestfinished', data => {
      let reqData = {};
      // console.info(data);
      reqData.url = data.url();
      reqData.timing = data.timing();
      this.requests.push(reqData);
    });
  }
  /**
   * Prepares the context by kicking off anything that needs to be attached at the context level
   */
  async prepareContext(context) {
    // add any custom headers
    if (this.options.headers) {
      await context.setExtraHTTPHeaders(this.options.headers);
    }

    //add any custom cookies
    if (this.options.cookies) {
      let cookies = this.options.cookies;
      if (!Array.isArray(cookies)) {
        //allow for passing a single cookie
        cookies = [cookies];
      }
      for (const cookie of cookies) {
        if (!cookie.url && (!cookie.domain || !cookie.path)) {
          //set the url to our test url
          cookie.url = this.testURL;
        }
      }
      log(cookies);
      await context.addCookies(cookies);
    }
  }
  /**
   * Triggers the navigation based on the passed in url, grabs a screenshot, and closes the context and browser
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
    //close our browser instance
    await this.browserInstance.close();
  }

  /**
   * Collect all perf metrics
   */
  async collectMetrics() {
    //navigation timing
    this.metrics['navigationTiming'] = await this.collectNavTiming();
    //resource timing
    this.resourceTimings = JSON.parse(
      await this.page.evaluate(() =>
        JSON.stringify(window.performance.getEntriesByType('resource')),
      ),
    );
    //paint timing
    this.metrics['paintTiming'] = JSON.parse(
      await this.page.evaluate(() =>
        JSON.stringify(window.performance.getEntriesByType('paint')),
      ),
    );
    //user timing
    this.metrics['userTiming'] = JSON.parse(
      await this.page.evaluate(() =>
        JSON.stringify(window.performance.getEntriesByType('mark', 'measure')),
      ),
    );

    this.metrics['largestContentfulPaint'] = await this.collectLCP();
    this.metrics['layoutShifts'] = await this.collectLayoutShifts();
  }
  async collectLayoutShifts() {
    await this.page.evaluate(() => {
      window.layoutShifts = [];
      new PerformanceObserver(entryList => {
        for (const entry of entryList.getEntries()) {
          try {
            let event = {
              name: entry.name,
              entryType: entry.entryType,
              startTime: entry['startTime'],
              value: entry['value'],
              hadRecentInput: entry['hadRecentInput'],
              lastInputTime: entry['lastInputTime'],
            };
            if (entry['sources']) {
              event['sources'] = [];
              for (const source of entry.sources) {
                let src = {
                  previousRect: source.previousRect,
                  currentRect: source.currentRect,
                };
                event.sources.push(src);
              }
            }
            window.layoutShifts.push(event);
          } catch (err) {}
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    let layoutShifts = await this.page.evaluate(() => {
      return window.layoutShifts;
    });
    return layoutShifts;
  }
  async collectNavTiming() {
    await this.page.evaluate(() => {
      window.navTimings = [];
      const observer = new PerformanceObserver(list => {
        list.getEntries().forEach(entry => {
          window.navTimings.push(entry);
        });
      });

      observer.observe({ type: 'navigation', buffered: true });
    });
    let navTimings = await this.page.evaluate(() => {
      return window.navTimings;
    });
    return navTimings.length > 0 ? navTimings[0] : {};
  }
  async collectLCP() {
    await this.page.evaluate(() => {
      window.lcpEvents = [];
      new PerformanceObserver(entryList => {
        for (const entry of entryList.getEntries()) {
          try {
            let event = {
              name: entry.name,
              entryType: entry.entryType,
              startTime: entry['startTime'],
              size: entry['size'],
              url: entry['url'],
              id: entry['id'],
              loadTime: entry['loadTime'],
              renderTime: entry['renderTime'],
            };
            if (entry['element']) {
              event['element'] = {
                nodeName: entry.element['nodeName'],
                boundingRect: entry.element.getBoundingClientRect(),
                outerHTML: entry.element.outerHTML,
              };
              if (entry.element['src']) {
                event.element['src'] = entry.element.src;
              }
              if (entry.element['currentSrc']) {
                event.element['currentSrc'] = entry.element.currentSrc;
              }
              try {
                let style = window.getComputedStyle(entry.element);
                if (style.backgroundImage && style.backgroundImage != 'none') {
                  event.element['background-image'] = style.backgroundImage;
                }
                if (style.content && style.content != 'none') {
                  event.element['content'] = style.content;
                }
              } catch (err) {}
            }
            window.lcpEvents.push(event);
          } catch (err) {}
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
    let lcpEvents = await this.page.evaluate(() => {
      return window.lcpEvents;
    });
    return lcpEvents;
  }
  async throttleNetwork() {
    // Only apply throttling if connectionType is explicitly set
    if (!this.options.connectionType) {
      log('No network throttling applied');
      return;
    }

    let start = performance.now();
    let networkType = this.options.connectionType;

    try {
      //TODO: Remove monkey patch in throttle (currently setting dummynet any to any)
      await throttleStart({
        up: networkTypes[networkType].up,
        down: networkTypes[networkType].down,
        rtt: networkTypes[networkType].rtt,
      });
      log('Throttling successfully started');
    } catch (error) {
      console.error('throttling error: ' + error);
    }
    let end = performance.now();
    logTimer('Network Throttle', end, start);
    return;
  }
  /**
   * Setup our test: create the browser, context and page
   */
  async setupTest() {
    this.browserInstance = await this.createBrowser();
    this.page = await this.createPage(this.browserInstance);
    if (this.options.timeout && this.options.timeout > 0) {
      await this.page.setDefaultNavigationTimeout(this.options.timeout);
    }
    await this.throttleNetwork();
  }
  async createFilmStrip() {
    let start = performance.now();
    let paths = this.paths;
    let filmstripFiles = [];
    const frameRate = this.options.frameRate;

    try {
      let process = new ffmpeg(this.videoRecordingFile);
      filmstripFiles = await process.then(
        function (video) {
          return new Promise((resolve, reject) => {
            // Callback mode
            video.fnExtractFrameToJPG(
              paths['filmstrip'],
              {
                frame_rate: frameRate,
                file_name: 'frame_%s',
              },
              function (err, files) {
                if (err) {
                  console.error('Error generating filmstrip frames:', err);
                  reject(err);
                } else {
                  resolve(files);
                }
              },
            );
          });
        },
        function (err) {
          console.error('Error generating filmstrip frames:', err);
        },
      );
    } catch (e) {
      console.error(e.code);
      console.error(e.msg);
    }

    this.resultAssets.filmstrip = filmstripFiles
      .map(filePath => {
        const filename = path.relative(this.paths['results'], filePath);

        const match = filename.match(/(?<num>\d+).jpg$/);
        const num = Number.parseInt(match.groups.num);

        const ms = Math.floor((num * 1000) / frameRate);

        return { num, filename, ms };
      })
      .sort((a, b) => {
        return a.num - b.num;
      });

    logTimer('Filmstrip', performance.now(), start);
  }
  /**
   * Run any post processing on test results
   */
  async postProcess() {
    try {
      // Only stop throttling if it was actually started
      if (this.options.connectionType) {
        await throttleStop();
        log('Throttling successfully stopped');
      }
    } catch (error) {
      console.error('throttling error: ' + error);
    }
    this.fillOutHar();

    //post process
    try {
      writeFileSync(
        this.paths['results'] + '/console.json',
        JSON.stringify(this.consoleMessages),
        'utf8',
      );
    } catch (err) {
      console.error('Error writing console file ' + err);
    }

    try {
      writeFileSync(
        this.paths['results'] + '/metrics.json',
        JSON.stringify(this.metrics),
        'utf8',
      );
    } catch (err) {
      console.error('Error writing metrics file ' + err);
    }
    try {
      writeFileSync(
        this.paths['results'] + '/resources.json',
        JSON.stringify(this.resourceTimings),
        'utf8',
      );
    } catch (err) {
      console.error('Error writing resources file ' + err);
    }

    //create our filmstrip
    await this.createFilmStrip();

    // write config.json
    try {
      writeFileSync(
        this.paths['results'] + '/config.json',
        JSON.stringify({
          url: this.testURL,
          date: new Date().toUTCString(),
          options: this.options,
          browserConfig: this.selectedBrowser,
        }),
        'utf8',
      );
    } catch (err) {
      console.error('Error writing config.json file ' + err);
    }

    if (this.options.html) {
      // Generate HTML report
      copyFileSync(
        url.fileURLToPath(
          import.meta.resolve(
            `../img/${
              this.selectedBrowser.channel || this.selectedBrowser.engine
            }.png`,
          ),
        ),
        this.paths['results'] + '/engine.png',
      );
      const testTemplate = readFileSync(
        url.fileURLToPath(import.meta.resolve('./templates/test.ejs')),
        'utf8',
      ).toString();
      const testHTML = ejs.render(testTemplate, this);

      try {
        const htmlPath = this.paths['results'] + '/index.html';
        writeFileSync(htmlPath, testHTML, 'utf8');

        // Open the HTML report in the browser if --openHtml is set
        if (this.options.openHtml) {
          this.openInBrowser(path.resolve(htmlPath));
        }
      } catch (err) {
        console.error('Error writing html file ' + err);
      }
    }

    if (this.options.list) {
      const files = readdirSync('./results/', { withFileTypes: true });
      const tests = files
        .filter(file => file.isDirectory())
        .map(folder => {
          const configFileName = `./results/${folder.name}/config.json`;
          try {
            const config = readFileSync(configFileName, 'utf8').toString();
            return { folder: folder.name, config: JSON.parse(config) };
          } catch (err) {
            return null;
          }
        })
        .filter(test => test)
        .sort((a, b) => new Date(b.config.date) - new Date(a.config.date));

      const listTemplate = readFileSync(
        url.fileURLToPath(import.meta.resolve('./templates/list.ejs')),
        'utf8',
      ).toString();
      const listHTML = ejs.render(listTemplate, { tests });

      try {
        writeFileSync('./results/index.html', listHTML, 'utf8');
      } catch (err) {
        console.error('Error writing html file ' + err);
      }
    }

    //run cleanup
    this.cleanup();
  }
  mergeEntries(harEntries, lcpURL) {
    for (const request of this.requests) {
      const indexToUpdate = harEntries.findIndex(object => {
        return object.request.url === request.url && !request.rawTimings;
      });
      if (indexToUpdate !== -1) {
        //we'll do our calculations now
        let connectEnd =
          request.timing.secureConnectionStart > 0
            ? request.timing.secureConnectionStart
            : request.timing.connectEnd;
        let secureStart = request.timing.secureConnectionStart
          ? request.timing.secureConnectionStart
          : -1;
        let secureEnd = request.timing.secureConnectionStart
          ? request.timing.connectEnd
          : -1;

        // create a new object with the updated values
        const updatedObject = {
          ...harEntries[indexToUpdate],
          _dns_start: request.timing.domainLookupStart,
          _dns_end: request.timing.domainLookupEnd,
          _connect_start: request.timing.connectStart,
          _connect_end: connectEnd,
          _secure_start: secureStart,
          _secure_end: secureEnd,
          _request_start: request.timing.requestStart,
          _request_end: request.timing.responseStart,
          _response_start: request.timing.responseStart,
          _response_end: request.timing.responseEnd,
        };
        if (request.url == lcpURL) {
          updatedObject._is_lcp = true;
        }
        // replace the object at the specified index with the updated object
        harEntries.splice(indexToUpdate, 1, updatedObject);
      }
    }
    return harEntries;
  }
  fillOutHar() {
    let start = performance.now();
    //grab our har file
    const harData = JSON.parse(
      readFileSync(this.paths['results'] + '/pageload.har'),
    );

    //first, TTFB
    let TTFB =
      this.metrics.navigationTiming.responseStart -
      this.metrics.navigationTiming.navigationStart;
    harData.log.pages[0].pageTimings._TTFB = TTFB;
    // now our LCP
    let lcp =
      this.metrics.largestContentfulPaint[
        this.metrics.largestContentfulPaint.length - 1
      ];
    let lcpURL = null;
    if (lcp) {
      harData.log.pages[0].pageTimings._LCP = lcp.startTime;
      if (lcp.url) {
        //let's see if we can find it in our resources
        lcpURL = lcp.url;
      }
    }

    //now lets add the raw timings we collected
    let mergedEntries = this.mergeEntries(harData.log.entries, lcpURL);
    harData.log.entries = mergedEntries;
    try {
      writeFileSync(
        this.paths['results'] + '/pageload.har',
        JSON.stringify(harData),
        'utf8',
      );
    } catch (err) {
      console.error('Error writing har file ' + err);
    }
    logTimer('Har Edit', performance.now(), start);
  }
  /**
   * Opens a file in the default browser
   */
  openInBrowser(filePath) {
    let command = '';
    if (process.platform === 'darwin') {
      command = `open "${filePath}"`;
    } else if (process.platform === 'win32') {
      command = `start "" "${filePath}"`;
    } else {
      command = `xdg-open "${filePath}"`;
    }

    exec(command, (err) => {
      if (err) {
        console.error('Error opening HTML report:', err);
      }
    });
  }

  /**
   * Cleans up after our test
   */
  cleanup() {
    log('Cleanup started');
    rmSync(this.paths['temporaryContext'], { recursive: true, force: true });
    log('Cleanup ended');
    console.log('Test ID:' + this.TESTID);
  }
}
export { TestRunner };
