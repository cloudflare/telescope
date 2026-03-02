// Helper functions to format numbers as strings

/**
 * Format a millisecond duration as a human-readable string.
 * Sub-millisecond values show 2 decimal places; values under 1s show rounded ms; above 1s shows seconds.
 */
export function formatDuration(ms: number): string {
  if (ms < 1) return `${ms.toFixed(2)}ms`;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Format a millisecond value as a string (rounded to nearest integer)
 * Returns null if value is undefined/null
 */
export function formatMs(val: number | undefined | null): string | null {
  if (val === undefined || val === null) return null;
  return Math.round(val).toString();
}

/**
 * Format a decimal value to 2 decimal places
 * Returns null if value is undefined/null
 */
export function formatDecimal(val: number | undefined | null): string | null {
  if (val === undefined || val === null) return null;
  return val.toFixed(2);
}

/**
 * Format bytes as kilobytes (1 decimal place)
 * Returns null if value is undefined/null
 */
export function formatKb(bytes: number | undefined | null): string | null {
  if (bytes === undefined || bytes === null) return null;
  return (bytes / 1024).toFixed(1);
}

/**
 * Format metric value with proper units based on field name
 */
export function formatMetricValue(key: string, value: any): string {
  if (value === null || value === undefined) return '-';

  const integerFields = ['responseStatus', 'redirectCount', 'size'];
  if (integerFields.includes(key) && typeof value === 'number') {
    return Math.round(value).toString();
  }

  const sizeFields = ['transferSize', 'encodedBodySize', 'decodedBodySize'];
  if (sizeFields.includes(key) && typeof value === 'number') {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  const timingFields = [
    'startTime',
    'duration',
    'redirectStart',
    'redirectEnd',
    'domainLookupStart',
    'domainLookupEnd',
    'connectStart',
    'connectEnd',
    'secureConnectionStart',
    'fetchStart',
    'requestStart',
    'responseStart',
    'responseEnd',
    'workerStart',
    'domInteractive',
    'domContentLoadedEventStart',
    'domContentLoadedEventEnd',
    'domComplete',
    'loadEventStart',
    'loadEventEnd',
    'loadTime',
    'renderTime',
    'lastInputTime',
  ];
  if (timingFields.includes(key) && typeof value === 'number') {
    return `${Math.round(value)} ms`;
  }

  if (typeof value === 'number') return value.toFixed(2);
  if (typeof value === 'boolean') return value.toString();
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}
