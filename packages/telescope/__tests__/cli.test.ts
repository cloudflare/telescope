import { spawnSync } from 'child_process';
import { describe, it, expect, beforeAll } from 'vitest';

import {
  retrieveHAR,
  retrieveMetrics,
  cleanupTestDirectory,
} from './helpers.js';

import { BrowserConfig } from '../src/browsers.js';
import type { HarData, Metrics, HTTPHeader } from '../src/types.js';

const browsers = BrowserConfig.getBrowsers();

describe.each(browsers)('Basic Test: %s', browser => {
  let harJSON: HarData | null;
  let metrics: Metrics | null;
  let testId: string | undefined;

  beforeAll(() => {
    try {
      const args = [
        'node',
        'dist/src/cli.js',
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
    } finally {
      cleanupTestDirectory(testId);
    }
  });

  it('runs the test and creates a test ID', async () => {
    expect(testId).toBeTruthy();
  });

  it('generates a Har file', async () => {
    expect(harJSON).toBeTruthy();
  });

  it(`uses ${BrowserConfig.browserConfigs[browser].engine} as the browser`, async () => {
    expect(harJSON?.log.browser.name).toBe(
      BrowserConfig.browserConfigs[browser].engine,
    );
  });

  it(`captures navigation timing`, async () => {
    expect(metrics?.navigationTiming.startTime).toBeGreaterThanOrEqual(0);
  });

  it(`captures fIRS and fRHS only in chromium and webkit browsers`, async () => {
    if (
      ['chromium', 'webkit'].includes(
        BrowserConfig.browserConfigs[browser].engine,
      )
    ) {
      expect(
        metrics?.navigationTiming.firstInterimResponseStart,
      ).toBeGreaterThanOrEqual(0);
      expect(
        metrics?.navigationTiming.finalResponseHeadersStart,
      ).toBeGreaterThanOrEqual(0);
    } else {
      expect(metrics?.navigationTiming).not.toHaveProperty(
        'firstInterimResponseStart',
      );
      expect(metrics?.navigationTiming).not.toHaveProperty(
        'finalResponseHeadersStart',
      );
    }
  });
});

describe.each(browsers)('Changed User Agent: %s', browser => {
  const agentIE6 =
    'Mozilla/5.0 (Windows; U; MSIE 6.0; Windows NT 5.1; SV1; .NET CLR 2.0.50727)';
  let harJSON: HarData | null;
  let testId: string | undefined;

  beforeAll(() => {
    try {
      const args = [
        'node',
        'dist/src/cli.js',
        '--url',
        'https://www.example.com',
        '--userAgent',
        agentIE6,
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
    } finally {
      cleanupTestDirectory(testId);
    }
  });

  it('runs the test and creates a test ID', async () => {
    expect(testId).toBeTruthy();
  });

  it('generates a Har file', async () => {
    expect(harJSON).toBeTruthy();
  });

  it('User Agent Changed', async () => {
    if (harJSON) {
      const htmlUserAgent = harJSON.log.entries[0].request.headers.find(
        (hdr: HTTPHeader) => hdr.name === 'User-Agent',
      );

      if (htmlUserAgent) {
        expect(htmlUserAgent.value).toBe(agentIE6);
      } else {
        throw new Error('Missing User-Agent header');
      }
    } else {
      throw new Error('Missing HAR file');
    }
  });
});

describe.each(browsers)('Add to User Agent: %s', browser => {
  const agentExtraText = ' TELESCOPE_TEST';
  let harJSON: HarData | null;
  let testId: string | undefined;

  beforeAll(() => {
    try {
      const args = [
        'node',
        'dist/src/cli.js',
        '--url',
        'https://www.example.com',
        '--agentExtra',
        agentExtraText,
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
    } finally {
      cleanupTestDirectory(testId);
    }
  });

  it('runs the test and creates a test ID', async () => {
    expect(testId).toBeTruthy();
  });

  it('generates a Har file', async () => {
    expect(harJSON).toBeTruthy();
  });

  it('Appended to User Agent', async () => {
    if (harJSON) {
      const htmlUserAgent = harJSON.log.entries[0].request.headers.find(
        (hdr: HTTPHeader) => hdr.name === 'User-Agent',
      );

      if (htmlUserAgent) {
        expect(htmlUserAgent.value.endsWith(agentExtraText)).toBe(true);
      } else {
        throw new Error('Missing User-Agent header');
      }
    } else {
      throw new Error('Missing HAR file');
    }
  });
});
