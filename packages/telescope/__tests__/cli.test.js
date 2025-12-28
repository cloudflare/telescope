import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { BrowserConfig } from '../lib/browsers.js';
const browsers = BrowserConfig.getBrowsers();

let testId;
let outputLogs;
let harJSON = null;
let metrics = null;

function retrieveResults(testId) {
  if (!testId) {
    console.error('Invalid test id:', testId);
    return null;
  }

  const rootPath = 'results/';
  const safeTestPath = path.normalize(testId).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(rootPath, safeTestPath, 'pageload.har');

  if (filePath.indexOf(rootPath) !== 0) {
    console.error('Invalid test result path', filePath);
    return null;
  }

  try {
    const fileData = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(fileData);
    return json;
  } catch (error) {
    console.error('Error retrieving results for test', testId, ':', error);
    return null;
  }
}

function retrieveMetrics(testId) {
  const rootPath = 'results/';
  const safeTestPath = path.normalize(testId).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(rootPath, safeTestPath, 'metrics.json');

  if (filePath.indexOf(rootPath) !== 0) {
    console.error('Invalid test metrics path', filePath);
    return null;
  }

  try {
    const fileData = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(fileData);
    return json;
  } catch (error) {
    console.error('Error retrieving metrics for test', testId, ':', error);
    return null;
  }
}

describe.each(browsers)('Basic Test: %s', browser => {
  beforeAll(() => {
    testId = null;
    outputLogs = null;
    harJSON = null;
    metrics = null;

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
    harJSON = retrieveResults(testId);
    metrics = retrieveMetrics(testId);
  });

  it('runs the test and creates a test ID', async () => {
    expect(testId).toBeTruthy();
  });
  it('generates a Har file', async () => {
    expect(harJSON).toBeTruthy();
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
