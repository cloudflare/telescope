import { describe, expect, test } from 'vitest';
import {
  getFcpRating,
  getLcpRating,
  getClsRating,
  getTtfbRating,
} from '@/lib/utils/ratings';

describe('getFcpRating', () => {
  test('returns "good" for values <= 1800ms', () => {
    expect(getFcpRating(0)).toBe('good');
    expect(getFcpRating(1000)).toBe('good');
    expect(getFcpRating(1800)).toBe('good');
  });

  test('returns "needs-improvement" for values > 1800ms and <= 3000ms', () => {
    expect(getFcpRating(1801)).toBe('needs-improvement');
    expect(getFcpRating(2500)).toBe('needs-improvement');
    expect(getFcpRating(3000)).toBe('needs-improvement');
  });

  test('returns "poor" for values > 3000ms', () => {
    expect(getFcpRating(3001)).toBe('poor');
    expect(getFcpRating(5000)).toBe('poor');
    expect(getFcpRating(10000)).toBe('poor');
  });

  test('returns undefined for undefined', () => {
    expect(getFcpRating(undefined)).toBe(undefined);
  });

  test('returns undefined for null', () => {
    expect(getFcpRating(null)).toBe(undefined);
  });
});

describe('getLcpRating', () => {
  test('returns "good" for values <= 2500ms', () => {
    expect(getLcpRating(0)).toBe('good');
    expect(getLcpRating(1500)).toBe('good');
    expect(getLcpRating(2500)).toBe('good');
  });

  test('returns "needs-improvement" for values > 2500ms and <= 4000ms', () => {
    expect(getLcpRating(2501)).toBe('needs-improvement');
    expect(getLcpRating(3000)).toBe('needs-improvement');
    expect(getLcpRating(4000)).toBe('needs-improvement');
  });

  test('returns "poor" for values > 4000ms', () => {
    expect(getLcpRating(4001)).toBe('poor');
    expect(getLcpRating(5000)).toBe('poor');
    expect(getLcpRating(10000)).toBe('poor');
  });

  test('returns undefined for undefined', () => {
    expect(getLcpRating(undefined)).toBe(undefined);
  });

  test('returns undefined for null', () => {
    expect(getLcpRating(null)).toBe(undefined);
  });
});

describe('getClsRating', () => {
  test('returns "good" for values <= 0.1', () => {
    expect(getClsRating(0)).toBe('good');
    expect(getClsRating(0.05)).toBe('good');
    expect(getClsRating(0.1)).toBe('good');
  });

  test('returns "needs-improvement" for values > 0.1 and <= 0.25', () => {
    expect(getClsRating(0.11)).toBe('needs-improvement');
    expect(getClsRating(0.2)).toBe('needs-improvement');
    expect(getClsRating(0.25)).toBe('needs-improvement');
  });

  test('returns "poor" for values > 0.25', () => {
    expect(getClsRating(0.26)).toBe('poor');
    expect(getClsRating(0.5)).toBe('poor');
    expect(getClsRating(1.0)).toBe('poor');
  });

  test('returns undefined for undefined', () => {
    expect(getClsRating(undefined)).toBe(undefined);
  });

  test('returns undefined for null', () => {
    expect(getClsRating(null)).toBe(undefined);
  });
});

describe('getTtfbRating', () => {
  test('returns "good" for values <= 800ms', () => {
    expect(getTtfbRating(0)).toBe('good');
    expect(getTtfbRating(500)).toBe('good');
    expect(getTtfbRating(800)).toBe('good');
  });

  test('returns "needs-improvement" for values > 800ms and <= 1800ms', () => {
    expect(getTtfbRating(801)).toBe('needs-improvement');
    expect(getTtfbRating(1000)).toBe('needs-improvement');
    expect(getTtfbRating(1800)).toBe('needs-improvement');
  });

  test('returns "poor" for values > 1800ms', () => {
    expect(getTtfbRating(1801)).toBe('poor');
    expect(getTtfbRating(3000)).toBe('poor');
    expect(getTtfbRating(5000)).toBe('poor');
  });

  test('returns undefined for undefined', () => {
    expect(getTtfbRating(undefined)).toBe(undefined);
  });

  test('returns undefined for null', () => {
    expect(getTtfbRating(null)).toBe(undefined);
  });
});
