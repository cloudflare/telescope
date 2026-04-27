/**
 * Extractors for diagnostic performance metrics from MetricsJson.
 *
 * These are NOT Core Web Vitals. CWV (LCP, CLS) live in lib/utils/cwv.ts.
 * FCP and TTFB are Google-defined diagnostic metrics with published thresholds
 * but are not in the official CWV set.
 */
import type { MetricsJson } from '../types/metrics.js';
import { type Rating, getFcpRating, getTtfbRating } from './ratings.js';
import { formatMs } from './formatters.js';

export type DiagnosticMetric = {
  value: number | undefined;
  formatted: string | null;
  rating: Rating | undefined;
};

/**
 * First Contentful Paint in milliseconds.
 * Source: paintTiming entry named 'first-contentful-paint'.
 * Diagnostic metric — not a CWV.
 */
export function getFcp(metrics: MetricsJson | null): DiagnosticMetric {
  const entry = metrics?.paintTiming?.find(
    p => p.name === 'first-contentful-paint',
  );
  const value = entry?.startTime;
  return { value, formatted: formatMs(value), rating: getFcpRating(value) };
}

/**
 * Returns the NavigationTiming field name to use as the TTFB timestamp.
 *
 * Chrome 115–132 quirk: responseStart pointed to the 103 Early Hints
 * response rather than the final document response. We prefer
 * firstInterimResponseStart when it is present and non-zero.
 */
export function selectTtfbField(
  nav: import('../types/metrics.js').NavigationTiming,
): string {
  if (nav.firstInterimResponseStart && nav.firstInterimResponseStart > 0)
    return 'firstInterimResponseStart';
  return 'responseStart';
}

/**
 * Time to First Byte in milliseconds (responseStart − fetchStart).
 * Source: navigationTiming.
 * Diagnostic metric — not a CWV.
 */
export function getTtfb(metrics: MetricsJson | null): DiagnosticMetric {
  const nav = metrics?.navigationTiming;
  if (!nav) return { value: undefined, formatted: null, rating: undefined };
  const field = selectTtfbField(nav);
  const responseStart = nav[field as keyof typeof nav] as number | undefined;
  const value =
    responseStart !== undefined
      ? responseStart - (nav.fetchStart ?? 0)
      : undefined;
  return { value, formatted: formatMs(value), rating: getTtfbRating(value) };
}

/**
 * Transfer size of the main document in bytes.
 */
export function extractTransferSize(
  metrics: MetricsJson | null,
): number | undefined {
  return metrics?.navigationTiming?.transferSize;
}

/**
 * Total page load duration (fetchStart → loadEventEnd) in milliseconds.
 */
export function extractDuration(
  metrics: MetricsJson | null,
): number | undefined {
  return metrics?.navigationTiming?.duration;
}
