import { describe, expect, test } from 'vitest';
import type { MetricsJson } from '@/lib/types/metrics';
import { getLcp, getCls } from '@/lib/utils/cwv';

describe('getLcp', () => {
  test('returns the last LCP entry using renderTime when available', () => {
    const metrics: MetricsJson = {
      largestContentfulPaint: [
        {
          name: 'largest-contentful-paint',
          startTime: 1000,
          renderTime: 1050,
          size: 100,
        },
        {
          name: 'largest-contentful-paint',
          startTime: 1500,
          renderTime: 1600,
          size: 200,
        },
        {
          name: 'largest-contentful-paint',
          startTime: 2000,
          renderTime: 2100,
          size: 300,
        },
      ],
    } as MetricsJson;

    const result = getLcp(metrics);

    expect(result.value).toBe(2100);
    expect(result.formatted).toBe('2100');
    expect(result.rating).toBe('good');
  });

  test('falls back to startTime when renderTime is 0 (cross-origin image)', () => {
    const metrics: MetricsJson = {
      largestContentfulPaint: [
        {
          name: 'largest-contentful-paint',
          startTime: 2500,
          renderTime: 0,
          size: 100,
        },
      ],
    } as MetricsJson;

    const result = getLcp(metrics);

    expect(result.value).toBe(2500);
    expect(result.formatted).toBe('2500');
    expect(result.rating).toBe('good');
  });

  test('returns undefined when largestContentfulPaint is missing', () => {
    const metrics: MetricsJson = {} as MetricsJson;

    const result = getLcp(metrics);

    expect(result.value).toBe(undefined);
    expect(result.formatted).toBe(null);
    expect(result.rating).toBe(undefined);
  });

  test('returns undefined when largestContentfulPaint array is empty', () => {
    const metrics: MetricsJson = {
      largestContentfulPaint: [],
    } as MetricsJson;

    const result = getLcp(metrics);

    expect(result.value).toBe(undefined);
    expect(result.formatted).toBe(null);
    expect(result.rating).toBe(undefined);
  });

  test('returns undefined when metrics is null', () => {
    const result = getLcp(null);

    expect(result.value).toBe(undefined);
    expect(result.formatted).toBe(null);
    expect(result.rating).toBe(undefined);
  });

  test('returns correct rating for "needs-improvement" threshold', () => {
    const metrics: MetricsJson = {
      largestContentfulPaint: [
        {
          name: 'largest-contentful-paint',
          startTime: 3000,
          renderTime: 3000,
          size: 100,
        },
      ],
    } as MetricsJson;

    const result = getLcp(metrics);

    expect(result.rating).toBe('needs-improvement');
  });

  test('returns correct rating for "poor" threshold', () => {
    const metrics: MetricsJson = {
      largestContentfulPaint: [
        {
          name: 'largest-contentful-paint',
          startTime: 4500,
          renderTime: 4500,
          size: 100,
        },
      ],
    } as MetricsJson;

    const result = getLcp(metrics);

    expect(result.rating).toBe('poor');
  });
});

describe('getCls', () => {
  test('sums layout shifts excluding those with hadRecentInput', () => {
    const metrics: MetricsJson = {
      layoutShifts: [
        {
          name: 'layout-shift',
          startTime: 100,
          value: 0.05,
          hadRecentInput: false,
        },
        {
          name: 'layout-shift',
          startTime: 200,
          value: 0.03,
          hadRecentInput: false,
        },
        {
          name: 'layout-shift',
          startTime: 300,
          value: 0.02,
          hadRecentInput: true,
        }, // excluded
        {
          name: 'layout-shift',
          startTime: 400,
          value: 0.04,
          hadRecentInput: false,
        },
      ],
    } as MetricsJson;

    const result = getCls(metrics);

    expect(result.value).toBe(0.12); // 0.05 + 0.03 + 0.04
    expect(result.formatted).toBe('0.12');
    expect(result.rating).toBe('needs-improvement');
  });

  test('returns 0 when all shifts have hadRecentInput', () => {
    const metrics: MetricsJson = {
      layoutShifts: [
        {
          name: 'layout-shift',
          startTime: 100,
          value: 0.1,
          hadRecentInput: true,
        },
        {
          name: 'layout-shift',
          startTime: 200,
          value: 0.2,
          hadRecentInput: true,
        },
      ],
    } as MetricsJson;

    const result = getCls(metrics);

    expect(result.value).toBe(0);
    expect(result.formatted).toBe('0.00');
    expect(result.rating).toBe('good');
  });

  test('returns undefined when layoutShifts is missing', () => {
    const metrics: MetricsJson = {} as MetricsJson;

    const result = getCls(metrics);

    expect(result.value).toBe(undefined);
    expect(result.formatted).toBe(null);
    expect(result.rating).toBe(undefined);
  });

  test('returns undefined when metrics is null', () => {
    const result = getCls(null);

    expect(result.value).toBe(undefined);
    expect(result.formatted).toBe(null);
    expect(result.rating).toBe(undefined);
  });

  test('handles empty layoutShifts array', () => {
    const metrics: MetricsJson = {
      layoutShifts: [],
    } as MetricsJson;

    const result = getCls(metrics);

    expect(result.value).toBe(0);
    expect(result.formatted).toBe('0.00');
    expect(result.rating).toBe('good');
  });

  test('returns correct rating for "good" threshold', () => {
    const metrics: MetricsJson = {
      layoutShifts: [
        {
          name: 'layout-shift',
          startTime: 100,
          value: 0.1,
          hadRecentInput: false,
        },
      ],
    } as MetricsJson;

    const result = getCls(metrics);

    expect(result.rating).toBe('good');
  });

  test('returns correct rating for "poor" threshold', () => {
    const metrics: MetricsJson = {
      layoutShifts: [
        {
          name: 'layout-shift',
          startTime: 100,
          value: 0.3,
          hadRecentInput: false,
        },
      ],
    } as MetricsJson;

    const result = getCls(metrics);

    expect(result.rating).toBe('poor');
  });

  test('handles shifts with undefined value', () => {
    const metrics: MetricsJson = {
      layoutShifts: [
        {
          name: 'layout-shift',
          startTime: 100,
          value: 0.05,
          hadRecentInput: false,
        },
        {
          name: 'layout-shift',
          startTime: 200,
          value: undefined,
          hadRecentInput: false,
        },
        {
          name: 'layout-shift',
          startTime: 300,
          value: 0.03,
          hadRecentInput: false,
        },
      ],
    } as MetricsJson;

    const result = getCls(metrics);

    expect(result.value).toBe(0.08); // 0.05 + 0 + 0.03
  });
});
