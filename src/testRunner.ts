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
import AdmZip from 'adm-zip';
import type {
  BrowserConfigOptions,
  LaunchOptions,
  TestPaths,
  ResultAssets,
  Metrics,
  ConsoleMessage,
  RequestData,
  ResourceTiming,
  HarData,
  HarEntry,
  LCPEvent,
  LayoutShift,
  NavigationTiming,
  FilmstripFrame,
  ConnectionType,
  SavedConfig,
} from './types.js';
import type { BrowserContext, Page, Route, Request } from 'playwright';

class TestRunner {
  args: string[] = [];
  consoleMessages: ConsoleMessage[] = [];
  browserConfig: BrowserConfigOptions;
  metrics?: Metrics;
  resourceTimings: ResourceTiming[] = [];
  paths: TestPaths = {} as TestPaths;
  requests: RequestData[] = [];
  resultAssets: ResultAssets = {
    filmstripFiles: [],
    videoFile: null,
  };
  options: LaunchOptions;
  testURL: string;
  selectedBrowser: BrowserConfigOptions;
  TESTID: string;
  videoRecordingFile: string = '';
  browserInstance: BrowserContext | null = null;
  page: Page | null = null;

  constructor(options: LaunchOptions, browserConfig: BrowserConfigOptions) {
    this.options = options;
    this.testURL = options.url;
    this.selectedBrowser = browserConfig;
    this.browserConfig = browserConfig;
    this.TESTID = generateTestID();
    this.setupPaths(this.TESTID);
  }

  setupPaths(testID: string): void {
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
  async setupBlocking(page: Page): Promise<void> {
    if (this.options.blockDomains && this.options.blockDomains.length > 0) {
      const domains: string[] = [];

      this.options.blockDomains.forEach(domain => {
        domains.push('//' + domain + '/'); /* Domain part of URL */
      });

      const domain_rx = new RegExp(domains.join('|'));

      await page.route(domain_rx, async (route: Route) => {
        route.abort();
      });
    }

    if (this.options.block && this.options.block.length > 0) {
      const blocks_rx = new RegExp(this.options.block.join('|'));

      await page.route(blocks_rx, async (route: Route) => {
        route.abort();
      });
    }

    return;
  }

  /**
   * Set up any hostname overrides that have been requested
   */
  async setupHostOverrides(
    page: Page,
    overrides: Record<string, string>,
  ): Promise<void> {
    const domains: string[] = [];

    Object.keys(overrides).forEach(original => {
      domains.push('//(' + original + ')/'); /* Domain part of URL */
    });
    const domain_rx = new RegExp(domains.join('|'));

    await page.route(domain_rx, async (route: Route, request: Request) => {
      const original_url = request.url();
      const parts = domain_rx.exec(original_url);
      const original_domain = parts?.findLast(d => !!d); /* Grab what matched */
      if (!original_domain) {
        route.fallback();
        return;
      }
      const host_rx = new RegExp('//' + original_domain);
      const new_url = original_url.replace(
        host_rx,
        '//' + overrides[original_domain],
      );

      const all_headers = await request.allHeaders();
      const headers = {
        ...all_headers,
        'X-Host': original_domain,
      };

      route.fallback({ headers, url: new_url });
    });

    return;
  }

  /**
   * Creates a browser instance using the browser config for the browser to be tested
   * Also merges in any browser-specific settings
   */
  async createBrowser(): Promise<BrowserContext> {
    //turn on logging
    this.selectedBrowser.logger = {
      isEnabled: (_name: string, _severity: string) => true,
      log: (name: string, severity: string, message: string) => {
        console.log(name + ' ' + severity + ' ' + message);
      },
    };
    if (this.options.disableJS) {
      this.selectedBrowser.javaScriptEnabled = false;
    }
    if (this.options.auth) {
      this.selectedBrowser.httpCredentials = this.options.auth;
    }

    const engine = this.selectedBrowser.engine;
    const browserType = playwright[engine];

    const browser = await browserType.launchPersistentContext(
      this.paths['temporaryContext'],
      this.selectedBrowser as Parameters<
        typeof browserType.launchPersistentContext
      >[1],
    );
    await this.prepareContext(browser);
    return browser;
  }

  /**
   * Given a browser instance, grab the page and then kick off anything that
   * needs to be attached at the page level
   */
  async createPage(browser: BrowserContext): Promise<Page> {
    const page = browser.pages()[0];
    await this.preparePage(page);
    return page;
  }

  setupConsoleMessages(page: Page): void {
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

  async preparePage(page: Page): Promise<void> {
    this.setupConsoleMessages(page);

    if (this.options.overrideHost) {
      this.setupHostOverrides(page, this.options.overrideHost);
    }

    await this.setupBlocking(page);
    page.on('requestfinished', data => {
      const reqData: RequestData = {
        url: data.url(),
        timing: data.timing(),
      };
      this.requests.push(reqData);
    });
  }

  /**
   * Prepares the context by kicking off anything that needs to be attached at the context level
   */
  async prepareContext(context: BrowserContext): Promise<void> {
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
  async doNavigation(): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      await this.page.goto(this.testURL, { waitUntil: 'networkidle' });
    } catch (err) {
      // If navigation timed out, set the context offline and continue.
      if (
        err &&
        ((err as Error).name === 'TimeoutError' ||
          /Timeout/.test((err as Error).message))
      ) {
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
    const video = this.page.video();
    if (video) {
      this.videoRecordingFile = await video.path();
      this.resultAssets.videoFile = path.relative(
        this.paths['results'],
        this.videoRecordingFile,
      );
    }
    //collect metrics
    await this.collectMetrics();
    //close our browser instance
    if (this.browserInstance) {
      await this.browserInstance.close();
    }
  }

  /**
   * Collect all perf metrics
   */
  async collectMetrics(): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    //resource timing
    this.resourceTimings = JSON.parse(
      await this.page.evaluate(() =>
        JSON.stringify(window.performance.getEntriesByType('resource')),
      ),
    ) as ResourceTiming[];

    // Collect all metrics and assign as single object
    this.metrics = {
      navigationTiming: await this.collectNavTiming(),
      paintTiming: JSON.parse(
        await this.page.evaluate(() =>
          JSON.stringify(window.performance.getEntriesByType('paint')),
        ),
      ),
      userTiming: JSON.parse(
        await this.page.evaluate(() =>
          JSON.stringify([
            ...window.performance.getEntriesByType('mark'),
            ...window.performance.getEntriesByType('measure'),
          ]),
        ),
      ),
      largestContentfulPaint: await this.collectLCP(),
      layoutShifts: await this.collectLayoutShifts(),
    };
  }

  async collectLayoutShifts(): Promise<LayoutShift[]> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    // This code runs in the browser context - use string to avoid TypeScript DOM checking
    await this.page.evaluate(`
      window.layoutShifts = [];
      new PerformanceObserver((entryList) => {
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
    `);
    const layoutShifts =
      await this.page.evaluate<LayoutShift[]>(`window.layoutShifts`);
    return layoutShifts || [];
  }

  async collectNavTiming(): Promise<NavigationTiming> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    // This code runs in the browser context
    await this.page.evaluate(`
      window.navTimings = [];
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          window.navTimings.push(entry);
        });
      });
      observer.observe({ type: 'navigation', buffered: true });
    `);
    const navTimings =
      await this.page.evaluate<NavigationTiming[]>(`window.navTimings`);
    return navTimings && navTimings.length > 0
      ? navTimings[0]
      : ({} as NavigationTiming);
  }

  async collectLCP(): Promise<LCPEvent[]> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    // This code runs in the browser context
    await this.page.evaluate(`
      window.lcpEvents = [];
      new PerformanceObserver((entryList) => {
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
    `);
    const lcpEvents = await this.page.evaluate<LCPEvent[]>(`window.lcpEvents`);
    return lcpEvents || [];
  }

  async throttleNetwork(): Promise<void> {
    // Only apply throttling if connectionType is explicitly set
    if (!this.options.connectionType) {
      log('No network throttling applied');
      return;
    }

    const start = performance.now();
    const networkType = this.options.connectionType as Exclude<
      ConnectionType,
      false
    >;

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
    const end = performance.now();
    logTimer('Network Throttle', end, start);
    return;
  }

  /**
   * Setup our test: create the browser, context and page
   */
  async setupTest(): Promise<void> {
    this.browserInstance = await this.createBrowser();
    this.page = await this.createPage(this.browserInstance);
    if (this.options.timeout && this.options.timeout > 0) {
      await this.page.setDefaultNavigationTimeout(this.options.timeout);
    }
    await this.throttleNetwork();
  }

  async createFilmStrip(): Promise<void> {
    const start = performance.now();
    const paths = this.paths;
    let filmstripFiles: string[] = [];
    const frameRate = this.options.frameRate || 1;

    try {
      const process = new ffmpeg(this.videoRecordingFile);
      filmstripFiles = await process.then(
        function (video) {
          return new Promise<string[]>((resolve, reject) => {
            // Callback mode
            video.fnExtractFrameToJPG(
              paths['filmstrip'],
              {
                frame_rate: frameRate,
                file_name: 'frame_%s',
              },
              function (err: Error | null, files: string[]) {
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
          return [];
        },
      );
    } catch (e) {
      const error = e as { code?: string; msg?: string };
      console.error(error.code);
      console.error(error.msg);
    }

    this.resultAssets.filmstrip = filmstripFiles
      .map((filePath): FilmstripFrame => {
        const filename = path.relative(this.paths['results'], filePath);

        const match = filename.match(/(?<num>\d+).jpg$/);
        const num = Number.parseInt(match?.groups?.num || '0');

        const ms = Math.floor((num * 1000) / frameRate);

        return { num, filename, ms };
      })
      .sort((a, b) => {
        return a.num - b.num;
      });

    logTimer('Filmstrip', performance.now(), start);
  }

  /**
   * Save configuration file used to run the test
   */
  async saveConfig(): Promise<void> {
    // write config.json
    try {
      const config: SavedConfig = {
        url: this.testURL,
        date: new Date().toUTCString(),
        options: this.options,
        browserConfig: this.selectedBrowser,
      };
      writeFileSync(
        this.paths['results'] + '/config.json',
        JSON.stringify(config),
        'utf8',
      );
    } catch (err) {
      console.error('Error writing config.json file ' + err);
    }
  }

  /**
   * Run any post processing on test results
   */
  async postProcess(): Promise<void> {
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

    // Get the directory of the current file for resolving relative paths
    // When running from source (Jest/ts-node): lib/testRunner.ts -> lib/ -> project root is ../
    // When running compiled (node): dist/lib/testRunner.js -> dist/lib/ -> project root is ../../
    const currentDir = path.dirname(url.fileURLToPath(import.meta.url));
    const isCompiledDist = currentDir.includes('/dist/');
    const projectRoot = isCompiledDist
      ? path.resolve(currentDir, '../..')
      : path.resolve(currentDir, '..');

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

    if (this.options.html) {
      // Generate HTML report
      // img/ is at project root
      copyFileSync(
        path.resolve(
          projectRoot,
          `img/${
            this.selectedBrowser.channel || this.selectedBrowser.engine
          }.png`,
        ),
        this.paths['results'] + '/engine.png',
      );
      const testTemplate = readFileSync(
        path.resolve(currentDir, './templates/test.ejs'),
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
          } catch (_err) {
            return null;
          }
        })
        .filter((test): test is NonNullable<typeof test> => test !== null)
        .sort(
          (a, b) =>
            new Date(b.config.date).getTime() -
            new Date(a.config.date).getTime(),
        );

      const listTemplate = readFileSync(
        path.resolve(currentDir, './templates/list.ejs'),
        'utf8',
      ).toString();
      const listHTML = ejs.render(listTemplate, { tests });

      try {
        writeFileSync('./results/index.html', listHTML, 'utf8');
      } catch (err) {
        console.error('Error writing html file ' + err);
      }
    }

    // handle the zipping
    if (this.options.zip) {
      try {
        const outputZip = `./results/${this.TESTID}.zip`;
        const zip = new AdmZip();
        zip.addLocalFolder(this.paths['results']);
        zip.writeZip(outputZip);
      } catch (err) {
        console.error('Error creating zip file:', err);
      }
    }

    //run cleanup
    await this.cleanup();
  }

  mergeEntries(harEntries: HarEntry[], lcpURL: string | null): HarEntry[] {
    for (const request of this.requests) {
      const indexToUpdate = harEntries.findIndex(object => {
        return object.request.url === request.url && !request.rawTimings;
      });
      if (indexToUpdate !== -1) {
        //we'll do our calculations now
        const connectEnd =
          request.timing.secureConnectionStart > 0
            ? request.timing.secureConnectionStart
            : request.timing.connectEnd;
        const secureStart = request.timing.secureConnectionStart
          ? request.timing.secureConnectionStart
          : -1;
        const secureEnd = request.timing.secureConnectionStart
          ? request.timing.connectEnd
          : -1;

        // create a new object with the updated values
        const updatedObject: HarEntry = {
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

  fillOutHar(): void {
    const start = performance.now();
    //grab our har file
    const harData: HarData = JSON.parse(
      readFileSync(this.paths['results'] + '/pageload.har', 'utf8'),
    );

    //first, TTFB
    const navTiming = this.metrics?.navigationTiming;
    if (navTiming) {
      const TTFB = navTiming.responseStart - navTiming.navigationStart;
      harData.log.pages[0].pageTimings._TTFB = TTFB;
    }

    // now our LCP
    const lcpEvents = this.metrics?.largestContentfulPaint;
    let lcpURL: string | null = null;
    if (lcpEvents && lcpEvents.length > 0) {
      const lcp = lcpEvents[lcpEvents.length - 1];
      if (lcp) {
        harData.log.pages[0].pageTimings._LCP = lcp.startTime;
        if (lcp.url) {
          //let's see if we can find it in our resources
          lcpURL = lcp.url;
        }
      }
    }

    //now lets add the raw timings we collected
    const mergedEntries = this.mergeEntries(harData.log.entries, lcpURL);
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
  openInBrowser(filePath: string): void {
    let command = '';
    if (process.platform === 'darwin') {
      command = `open "${filePath}"`;
    } else if (process.platform === 'win32') {
      command = `start "" "${filePath}"`;
    } else {
      command = `xdg-open "${filePath}"`;
    }

    exec(command, err => {
      if (err) {
        console.error('Error opening HTML report:', err);
      }
    });
  }

  /**
   * Cleans up after our test - closes browser and removes temp files
   */
  async cleanup(): Promise<void> {
    log('Cleanup started');
    // Close browser instance if it exists (prevents Jest open handles)
    if (this.browserInstance) {
      try {
        await this.browserInstance.close();
        log('Browser instance closed');
      } catch (err) {
        log('Error closing browser instance: ' + (err as Error).message);
      }
      this.browserInstance = null as unknown as BrowserContext;
    }
    rmSync(this.paths['temporaryContext'], { recursive: true, force: true });
    log('Cleanup ended');
    console.log('Test ID:' + this.TESTID);
  }
}

export { TestRunner };
