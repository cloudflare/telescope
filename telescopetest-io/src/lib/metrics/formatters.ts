// Helper functions to format numbers as strings

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
