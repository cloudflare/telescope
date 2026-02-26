// Helper functions to extract/calculate metrics
import type { MetricsJson } from './types.js';

/**
 * Extract First Contentful Paint (FCP) time in milliseconds
 */
export function extractFcp(metrics: MetricsJson | null): number | undefined {
  const fcpEntry = metrics?.paintTiming?.find(
    p => p.name === 'first-contentful-paint',
  );
  return fcpEntry?.startTime;
}

/**
 * Extract Largest Contentful Paint (LCP) time in milliseconds
 */
export function extractLcp(metrics: MetricsJson | null): number | undefined {
  return metrics?.largestContentfulPaint?.[0]?.startTime;
}

/**
 * Extract Cumulative Layout Shift (CLS) value
 */
export function extractCls(metrics: MetricsJson | null): number | undefined {
  return metrics?.layoutShifts?.reduce((sum, s) => sum + (s.value ?? 0), 0);
}

/**
 * Extract Time to First Byte (TTFB) in milliseconds
 *
 * Correctly handles Chrome 115-132's quirk where responseStart points to
 * the 200 document response instead of 103 Early Hints response.
 *
 * Per Cloudflare spec: Use firstInterimResponseStart when available and non-zero,
 * otherwise fall back to responseStart.
 */
export function extractTtfb(metrics: MetricsJson | null): number | undefined {
  const nav = metrics?.navigationTiming;
  if (!nav) return undefined;

  // Use firstInterimResponseStart if available and non-zero (Chrome 115-132 fix)
  const effectiveResponseStart =
    nav.firstInterimResponseStart && nav.firstInterimResponseStart > 0
      ? nav.firstInterimResponseStart
      : nav.responseStart;

  // TTFB = time to first response byte relative to fetchStart (navigation origin).
  // The actual metrics.json has fetchStart (not navigationStart) as the base time.
  if (effectiveResponseStart !== undefined) {
    return effectiveResponseStart - (nav.fetchStart ?? 0);
  }

  return undefined;
}

/**
 * Extract transfer size in bytes
 */
export function extractTransferSize(
  metrics: MetricsJson | null,
): number | undefined {
  return metrics?.navigationTiming?.transferSize;
}

/**
 * Extract page load duration in milliseconds
 */
export function extractDuration(
  metrics: MetricsJson | null,
): number | undefined {
  return metrics?.navigationTiming?.duration;
}
