import { describe, expect, test } from 'vitest';
import {
  formatDuration,
  formatMs,
  formatDecimal,
  formatKb,
} from '@/lib/utils/formatters';

describe('formatDuration', () => {
  test('formats sub-millisecond values with 2 decimal places', () => {
    expect(formatDuration(0.5)).toBe('0.50ms');
    expect(formatDuration(0.99)).toBe('0.99ms');
    expect(formatDuration(0.01)).toBe('0.01ms');
  });

  test('formats values under 1000ms as rounded milliseconds', () => {
    expect(formatDuration(1)).toBe('1ms');
    expect(formatDuration(50.6)).toBe('51ms');
    expect(formatDuration(999.4)).toBe('999ms');
    expect(formatDuration(999.9)).toBe('1000ms');
  });

  test('formats values 1000ms and above as seconds with 2 decimals', () => {
    expect(formatDuration(1000)).toBe('1.00s');
    expect(formatDuration(1500)).toBe('1.50s');
    expect(formatDuration(2345)).toBe('2.35s');
    expect(formatDuration(10000)).toBe('10.00s');
  });

  test('handles zero', () => {
    expect(formatDuration(0)).toBe('0.00ms');
  });

  test('handles negative values', () => {
    // Negative values always fail the < 1 check, so they fall through to < 1000 or seconds
    expect(formatDuration(-0.5)).toBe('-0.50ms');
    expect(formatDuration(-500)).toBe('-500.00ms');
    expect(formatDuration(-1500)).toBe('-1500.00ms');
  });
});

describe('formatMs', () => {
  test('rounds to nearest integer', () => {
    expect(formatMs(123.4)).toBe('123');
    expect(formatMs(123.5)).toBe('124');
    expect(formatMs(123.9)).toBe('124');
  });

  test('handles zero', () => {
    expect(formatMs(0)).toBe('0');
  });

  test('handles negative values', () => {
    expect(formatMs(-123.4)).toBe('-123');
    expect(formatMs(-123.6)).toBe('-124');
  });

  test('returns null for undefined', () => {
    expect(formatMs(undefined)).toBe(null);
  });

  test('returns null for null', () => {
    expect(formatMs(null)).toBe(null);
  });
});

describe('formatDecimal', () => {
  test('formats to 2 decimal places', () => {
    expect(formatDecimal(1.234)).toBe('1.23');
    expect(formatDecimal(1.235)).toBe('1.24');
    expect(formatDecimal(1.999)).toBe('2.00');
  });

  test('handles integers', () => {
    expect(formatDecimal(5)).toBe('5.00');
    expect(formatDecimal(0)).toBe('0.00');
  });

  test('handles negative values', () => {
    expect(formatDecimal(-1.234)).toBe('-1.23');
  });

  test('returns null for undefined', () => {
    expect(formatDecimal(undefined)).toBe(null);
  });

  test('returns null for null', () => {
    expect(formatDecimal(null)).toBe(null);
  });
});

describe('formatKb', () => {
  test('converts bytes to kilobytes with 1 decimal place', () => {
    expect(formatKb(1024)).toBe('1.0');
    expect(formatKb(2048)).toBe('2.0');
    expect(formatKb(1536)).toBe('1.5');
  });

  test('handles values under 1KB', () => {
    expect(formatKb(512)).toBe('0.5');
    expect(formatKb(100)).toBe('0.1');
  });

  test('handles zero', () => {
    expect(formatKb(0)).toBe('0.0');
  });

  test('handles large values', () => {
    expect(formatKb(1048576)).toBe('1024.0'); // 1MB
    expect(formatKb(5242880)).toBe('5120.0'); // 5MB
  });

  test('returns null for undefined', () => {
    expect(formatKb(undefined)).toBe(null);
  });

  test('returns null for null', () => {
    expect(formatKb(null)).toBe(null);
  });
});
