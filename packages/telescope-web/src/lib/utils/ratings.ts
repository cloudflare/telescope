/**
 * Rating thresholds for web performance metrics.
 * CWV (LCP, CLS) and diagnostic metrics (FCP, TTFB) all use the same
 * good / needs-improvement / poor bands published by Google.
 */

export type Rating = 'good' | 'needs-improvement' | 'poor';

/**
 * Generic threshold-based rating function
 */
function getRating(
  value: number | undefined | null,
  goodThreshold: number,
  poorThreshold: number,
): Rating | undefined {
  if (value === undefined || value === null) return undefined;
  if (value <= goodThreshold) return 'good';
  if (value <= poorThreshold) return 'needs-improvement';
  return 'poor';
}

/**
 * Get rating for First Contentful Paint (FCP) in milliseconds
 * Good: ≤1800ms, Needs Improvement: ≤3000ms, Poor: >3000ms
 */
export function getFcpRating(
  ms: number | undefined | null,
): Rating | undefined {
  return getRating(ms, 1800, 3000);
}

/**
 * Get rating for Largest Contentful Paint (LCP) in milliseconds
 * Good: ≤2500ms, Needs Improvement: ≤4000ms, Poor: >4000ms
 */
export function getLcpRating(
  ms: number | undefined | null,
): Rating | undefined {
  return getRating(ms, 2500, 4000);
}

/**
 * Get rating for Cumulative Layout Shift (CLS)
 * Good: ≤0.1, Needs Improvement: ≤0.25, Poor: >0.25
 */
export function getClsRating(
  value: number | undefined | null,
): Rating | undefined {
  return getRating(value, 0.1, 0.25);
}

/**
 * Get rating for Time to First Byte (TTFB) in milliseconds
 * Good: ≤800ms, Needs Improvement: ≤1800ms, Poor: >1800ms
 * Based on https://web.dev/articles/ttfb
 */
export function getTtfbRating(
  ms: number | undefined | null,
): Rating | undefined {
  return getRating(ms, 800, 1800);
}
