import { describe, expect, test } from 'vitest';
import type { MetricsJson, NavigationTiming } from '@/lib/types/metrics';
import {
  getFcp,
  getTtfb,
  selectTtfbField,
  extractTransferSize,
  extractDuration,
} from '@/lib/utils/extractors';

describe('getFcp', () => {
  test('extracts FCP from paintTiming array', () => {
    const metrics: MetricsJson = {
      paintTiming: [
        { name: 'first-paint', startTime: 1000 },
        { name: 'first-contentful-paint', startTime: 1200 },
      ],
    } as MetricsJson;

    const result = getFcp(metrics);

    expect(result.value).toBe(1200);
    expect(result.formatted).toBe('1200');
    expect(result.rating).toBe('good');
  });

  test('returns undefined when paintTiming is missing', () => {
    const metrics: MetricsJson = {} as MetricsJson;

    const result = getFcp(metrics);

    expect(result.value).toBe(undefined);
    expect(result.formatted).toBe(null);
    expect(result.rating).toBe(undefined);
  });

  test('returns undefined when first-contentful-paint entry is missing', () => {
    const metrics: MetricsJson = {
      paintTiming: [{ name: 'first-paint', startTime: 1000 }],
    } as MetricsJson;

    const result = getFcp(metrics);

    expect(result.value).toBe(undefined);
    expect(result.formatted).toBe(null);
    expect(result.rating).toBe(undefined);
  });

  test('returns undefined when metrics is null', () => {
    const result = getFcp(null);

    expect(result.value).toBe(undefined);
    expect(result.formatted).toBe(null);
    expect(result.rating).toBe(undefined);
  });

  test('returns correct rating for "needs-improvement"', () => {
    const metrics: MetricsJson = {
      paintTiming: [{ name: 'first-contentful-paint', startTime: 2500 }],
    } as MetricsJson;

    const result = getFcp(metrics);

    expect(result.rating).toBe('needs-improvement');
  });

  test('returns correct rating for "poor"', () => {
    const metrics: MetricsJson = {
      paintTiming: [{ name: 'first-contentful-paint', startTime: 3500 }],
    } as MetricsJson;

    const result = getFcp(metrics);

    expect(result.rating).toBe('poor');
  });
});

describe('selectTtfbField', () => {
  test('returns "firstInterimResponseStart" when present and > 0', () => {
    const nav: NavigationTiming = {
      firstInterimResponseStart: 100,
      responseStart: 200,
    } as NavigationTiming;

    expect(selectTtfbField(nav)).toBe('firstInterimResponseStart');
  });

  test('returns "responseStart" when firstInterimResponseStart is 0', () => {
    const nav: NavigationTiming = {
      firstInterimResponseStart: 0,
      responseStart: 200,
    } as NavigationTiming;

    expect(selectTtfbField(nav)).toBe('responseStart');
  });

  test('returns "responseStart" when firstInterimResponseStart is undefined', () => {
    const nav: NavigationTiming = {
      responseStart: 200,
    } as NavigationTiming;

    expect(selectTtfbField(nav)).toBe('responseStart');
  });

  test('returns "responseStart" when firstInterimResponseStart is null', () => {
    const nav: NavigationTiming = {
      firstInterimResponseStart: null as any,
      responseStart: 200,
    } as NavigationTiming;

    expect(selectTtfbField(nav)).toBe('responseStart');
  });
});

describe('getTtfb', () => {
  test('calculates TTFB using responseStart when firstInterimResponseStart is missing', () => {
    const metrics: MetricsJson = {
      navigationTiming: {
        fetchStart: 100,
        responseStart: 500,
      } as NavigationTiming,
    } as MetricsJson;

    const result = getTtfb(metrics);

    expect(result.value).toBe(400); // 500 - 100
    expect(result.formatted).toBe('400');
    expect(result.rating).toBe('good');
  });

  test('calculates TTFB using firstInterimResponseStart when present and > 0', () => {
    const metrics: MetricsJson = {
      navigationTiming: {
        fetchStart: 100,
        firstInterimResponseStart: 300,
        responseStart: 500,
      } as NavigationTiming,
    } as MetricsJson;

    const result = getTtfb(metrics);

    expect(result.value).toBe(200); // 300 - 100
    expect(result.formatted).toBe('200');
    expect(result.rating).toBe('good');
  });

  test('returns undefined when navigationTiming is missing', () => {
    const metrics: MetricsJson = {} as MetricsJson;

    const result = getTtfb(metrics);

    expect(result.value).toBe(undefined);
    expect(result.formatted).toBe(null);
    expect(result.rating).toBe(undefined);
  });

  test('returns undefined when metrics is null', () => {
    const result = getTtfb(null);

    expect(result.value).toBe(undefined);
    expect(result.formatted).toBe(null);
    expect(result.rating).toBe(undefined);
  });

  test('returns undefined when responseStart is missing', () => {
    const metrics: MetricsJson = {
      navigationTiming: {
        fetchStart: 100,
      } as NavigationTiming,
    } as MetricsJson;

    const result = getTtfb(metrics);

    expect(result.value).toBe(undefined);
    expect(result.formatted).toBe(null);
    expect(result.rating).toBe(undefined);
  });

  test('handles fetchStart being 0', () => {
    const metrics: MetricsJson = {
      navigationTiming: {
        fetchStart: 0,
        responseStart: 500,
      } as NavigationTiming,
    } as MetricsJson;

    const result = getTtfb(metrics);

    expect(result.value).toBe(500);
  });

  test('returns correct rating for "needs-improvement"', () => {
    const metrics: MetricsJson = {
      navigationTiming: {
        fetchStart: 0,
        responseStart: 1000,
      } as NavigationTiming,
    } as MetricsJson;

    const result = getTtfb(metrics);

    expect(result.rating).toBe('needs-improvement');
  });

  test('returns correct rating for "poor"', () => {
    const metrics: MetricsJson = {
      navigationTiming: {
        fetchStart: 0,
        responseStart: 2000,
      } as NavigationTiming,
    } as MetricsJson;

    const result = getTtfb(metrics);

    expect(result.rating).toBe('poor');
  });
});

describe('extractTransferSize', () => {
  test('returns transferSize from navigationTiming', () => {
    const metrics: MetricsJson = {
      navigationTiming: {
        transferSize: 1024,
      } as NavigationTiming,
    } as MetricsJson;

    expect(extractTransferSize(metrics)).toBe(1024);
  });

  test('returns undefined when navigationTiming is missing', () => {
    const metrics: MetricsJson = {} as MetricsJson;

    expect(extractTransferSize(metrics)).toBe(undefined);
  });

  test('returns undefined when metrics is null', () => {
    expect(extractTransferSize(null)).toBe(undefined);
  });

  test('returns undefined when transferSize is missing', () => {
    const metrics: MetricsJson = {
      navigationTiming: {} as NavigationTiming,
    } as MetricsJson;

    expect(extractTransferSize(metrics)).toBe(undefined);
  });
});

describe('extractDuration', () => {
  test('returns duration from navigationTiming', () => {
    const metrics: MetricsJson = {
      navigationTiming: {
        duration: 5000,
      } as NavigationTiming,
    } as MetricsJson;

    expect(extractDuration(metrics)).toBe(5000);
  });

  test('returns undefined when navigationTiming is missing', () => {
    const metrics: MetricsJson = {} as MetricsJson;

    expect(extractDuration(metrics)).toBe(undefined);
  });

  test('returns undefined when metrics is null', () => {
    expect(extractDuration(null)).toBe(undefined);
  });

  test('returns undefined when duration is missing', () => {
    const metrics: MetricsJson = {
      navigationTiming: {} as NavigationTiming,
    } as MetricsJson;

    expect(extractDuration(metrics)).toBe(undefined);
  });
});
