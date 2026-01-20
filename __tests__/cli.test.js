import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { BrowserConfig } from '../lib/browsers.js';
const browsers = BrowserConfig.getBrowsers();

let testId;
let outputLogs;
let errLogs;
let harJSON = null;
let metrics = null;
let config = null;
let singleBrowser = null; // A browser for tests that is known to be available
let lastBrowserUsed = null; // The last browser that was available

function retrieveResults(testId, fileName, resultType, safeBrowser) {
  if (!testId) {
    console.error('Invalid test id:', testId);
    return null;
  }

  const rootPath = 'results/';
  const safeTestPath = path.normalize(testId).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(rootPath, safeTestPath, fileName);

  if (filePath.indexOf(rootPath) !== 0) {
    console.error('Invalid test', resultType, path, filePath);
    return null;
  }

  try {
    const fileData = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(fileData);
    return json;
  } catch (error) {
    console.error(
      'Error retrieving',
      resultType,
      'using',
      safeBrowser,
      'for test',
      testId,
      ':',
      error,
    );
    return null;
  }
}

function retrieveHAR(testId, safeBrowser) {
  return retrieveResults(testId, 'pageload.har', 'result', safeBrowser);
}

function retrieveConfig(testId, safeBrowser) {
  return retrieveResults(testId, 'config.json', 'config', safeBrowser);
}

function retrieveMetrics(testId, safeBrowser) {
  return retrieveResults(testId, 'metrics.json', 'metrics', safeBrowser);
}

describe.each(browsers)('Basic Test: %s', browser => {
  beforeAll(() => {
    testId = null;
    outputLogs = null;
    harJSON = null;
    metrics = null;
    config = null;

    const safeBrowser = browser.replace(/[^a-z0-9-]/, '');

    const args = [
      'node',
      'cli.js',
      '--url',
      'https://www.example.com',
      '-b',
      safeBrowser,
    ];

    const output = spawnSync(args[0], args.slice(1));
    outputLogs = output.stdout.toString();
    const match = outputLogs.match(/Test ID:(.*)/);
    if (match && match.length > 1) {
      testId = match[1].trim();
    }
    harJSON = retrieveHAR(testId, safeBrowser);
    metrics = retrieveMetrics(testId, safeBrowser);
  });
  afterAll(() => {
    singleBrowser = lastBrowserUsed; // record working browser to be used in other tests
  });

  it('runs the test and creates a test ID', async () => {
    expect(testId).toBeTruthy();
  });
  it('generates a Har file', async () => {
    expect(harJSON).toBeTruthy();

    if (harJSON) {
      lastBrowserUsed = browser;
    }
  });

  it(`uses ${BrowserConfig.browserConfigs[browser].engine} as the browser`, async () => {
    expect(harJSON.log.browser.name).toBe(
      BrowserConfig.browserConfigs[browser].engine,
    );
  });
  it(`captures navigation timing`, async () => {
    expect(metrics.navigationTiming.startTime).toBeGreaterThanOrEqual(0);
  });
  it(`captures fIRS and fRHS only in chromium browsers`, async () => {
    if (BrowserConfig.browserConfigs[browser].engine === 'chromium') {
      expect(
        metrics.navigationTiming.firstInterimResponseStart,
      ).toBeGreaterThanOrEqual(0);
      expect(
        metrics.navigationTiming.finalResponseHeadersStart,
      ).toBeGreaterThanOrEqual(0);
    } else {
      expect(metrics.navigationTiming).not.toHaveProperty(
        'firstInterimResponseStart',
      );
      expect(metrics.navigationTiming).not.toHaveProperty(
        'finalResponseHeadersStart',
      );
    }
  });
});

describe('CLI parameter array collapsing', () => {
  describe('Single string', () => {
    beforeAll(() => {
      testId = null;
      outputLogs = null;
      config = null;

      const safeBrowser = singleBrowser.replace(/[^a-z0-9-]/, '');

      const args = [
        'node',
        'cli.js',
        '--dry',
        '--block',
        'one',
        '--url',
        'https://www.example.com',
        '-b',
        safeBrowser,
      ];

      const output = spawnSync(args[0], args.slice(1));
      outputLogs = output.stdout.toString();
      const match = outputLogs.match(/Test ID:(.*)/);
      if (match && match.length > 1) {
        testId = match[1].trim();
      }
      config = retrieveConfig(testId, safeBrowser);
    });

    it('generates a Configuration file', async () => {
      expect(config).toBeTruthy();
    });

    it('Block one', async () => {
      expect(config.options.block).toEqual(['one']);
    });
  });

  describe('Two string options', () => {
    beforeAll(() => {
      testId = null;
      outputLogs = null;
      config = null;

      const safeBrowser = singleBrowser.replace(/[^a-z0-9-]/, '');

      const args = [
        'node',
        'cli.js',
        '--dry',
        '--block',
        'one',
        '--block',
        'two',
        '--url',
        'https://www.example.com',
        '-b',
        safeBrowser,
      ];

      const output = spawnSync(args[0], args.slice(1));
      outputLogs = output.stdout.toString();
      const match = outputLogs.match(/Test ID:(.*)/);
      if (match && match.length > 1) {
        testId = match[1].trim();
      }
      config = retrieveConfig(testId, safeBrowser);
    });

    it('generates a Configuration file', async () => {
      expect(config).toBeTruthy();
    });

    it('Block one and two', async () => {
      expect(config.options.block).toEqual(['one', 'two']);
    });
  });

  describe('Two comma separated strings', () => {
    beforeAll(() => {
      testId = null;
      outputLogs = null;
      config = null;

      const safeBrowser = singleBrowser.replace(/[^a-z0-9-]/, '');

      const args = [
        'node',
        'cli.js',
        '--dry',
        '--block',
        'one,two',
        '--url',
        'https://www.example.com',
        '-b',
        safeBrowser,
      ];

      const output = spawnSync(args[0], args.slice(1));
      outputLogs = output.stdout.toString();
      const match = outputLogs.match(/Test ID:(.*)/);
      if (match && match.length > 1) {
        testId = match[1].trim();
      }
      config = retrieveConfig(testId, safeBrowser);
    });

    it('generates a Configuration file', async () => {
      expect(config).toBeTruthy();
    });

    it('Block one and two', async () => {
      expect(config.options.block).toEqual(['one', 'two']);
    });
  });

  describe('JSON array', () => {
    beforeAll(() => {
      testId = null;
      outputLogs = null;
      config = null;

      const safeBrowser = singleBrowser.replace(/[^a-z0-9-]/, '');

      const args = [
        'node',
        'cli.js',
        '--dry',
        '--block',
        '[ "one", "two" ]',
        '--url',
        'https://www.example.com',
        '-b',
        safeBrowser,
      ];

      const output = spawnSync(args[0], args.slice(1));
      outputLogs = output.stdout.toString();
      const match = outputLogs.match(/Test ID:(.*)/);
      if (match && match.length > 1) {
        testId = match[1].trim();
      }
      config = retrieveConfig(testId, safeBrowser);
    });

    it('generates a Configuration file', async () => {
      expect(config).toBeTruthy();
    });

    it('Block one and two', async () => {
      expect(config.options.block).toEqual(['one', 'two']);
    });
  });

  describe('Two JSON arrays', () => {
    beforeAll(() => {
      testId = null;
      outputLogs = null;
      config = null;

      const safeBrowser = singleBrowser.replace(/[^a-z0-9-]/, '');

      const args = [
        'node',
        'cli.js',
        '--dry',
        '--block',
        '[ "one" ]',
        '--block',
        '[ "two" ]',
        '--url',
        'https://www.example.com',
        '-b',
        safeBrowser,
      ];

      const output = spawnSync(args[0], args.slice(1));
      outputLogs = output.stdout.toString();
      const match = outputLogs.match(/Test ID:(.*)/);
      if (match && match.length > 1) {
        testId = match[1].trim();
      }
      config = retrieveConfig(testId, safeBrowser);
    });

    it('generates a Configuration file', async () => {
      expect(config).toBeTruthy();
    });

    it('Block one and two', async () => {
      expect(config.options.block).toEqual(['one', 'two']);
    });
  });

  describe('Two options with JSON arrays', () => {
    beforeAll(() => {
      testId = null;
      outputLogs = null;
      config = null;

      const safeBrowser = singleBrowser.replace(/[^a-z0-9-]/, '');

      const args = [
        'node',
        'cli.js',
        '--dry',
        '--block',
        '[ "one", "two" ]',
        '--block',
        '[ "three", "four" ]',
        '--url',
        'https://www.example.com',
        '-b',
        safeBrowser,
      ];

      const output = spawnSync(args[0], args.slice(1));
      outputLogs = output.stdout.toString();
      const match = outputLogs.match(/Test ID:(.*)/);
      if (match && match.length > 1) {
        testId = match[1].trim();
      }
      config = retrieveConfig(testId, safeBrowser);
    });

    it('Generates a Configuration file', async () => {
      expect(config).toBeTruthy();
    });

    it('Block one, two, three and four', async () => {
      expect(config.options.block).toEqual(['one', 'two', 'three', 'four']);
    });
  });

  describe('Bad JSON option should fail', () => {
    beforeAll(() => {
      testId = null;
      outputLogs = null;
      config = null;

      const safeBrowser = singleBrowser.replace(/[^a-z0-9-]/, '');

      const args = [
        'node',
        'cli.js',
        '--dry',
        '--block',
        "[ 'one', 'two' ]",
        '--url',
        'https://www.example.com',
        '-b',
        safeBrowser,
      ];

      const output = spawnSync(args[0], args.slice(1));
      outputLogs = output.stdout.toString();
      errLogs = output.stderr.toString();
      console.error(errLogs);
    });

    it('Problem parsing block command line option', async () => {
      const match = errLogs.match(/Error: Problem parsing (.*)/);
      expect(match.length).toBeGreaterThan(1);
    });
  });
});
