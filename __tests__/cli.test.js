import { spawnSync } from 'child_process';

import { retrieveHAR, retrieveMetrics } from './helpers.js';

import { BrowserConfig } from '../lib/browsers.js';
const browsers = BrowserConfig.getBrowsers();

describe.each(browsers)('Basic Test: %s', browser => {
  let harJSON;
  let metrics;
  let testId;

  beforeAll(() => {
    const args = [
      'node',
      'cli.js',
      '--url',
      'https://www.example.com',
      '-b',
      browser,
    ];

    const output = spawnSync(args[0], args.slice(1));
    const outputLogs = output.stdout.toString();
    const match = outputLogs.match(/Test ID:(.*)/);
    if (match && match.length > 1) {
      testId = match[1].trim();
    }
    harJSON = retrieveHAR(testId);
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
