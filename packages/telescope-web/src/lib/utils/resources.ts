import type {
  ResourceTiming,
  EnrichedResource,
  TypeStats,
} from '@/lib/types/resources';
import { formatDuration } from './formatters';

/**
 * Extract domain from URL
 */
export function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

/**
 * Map resource file type to waterfall color key for consistent styling
 */
export function getWaterfallColorKey(type: string): string {
  const typeMap: Record<string, string> = {
    document: 'html',
    script: 'js',
    stylesheet: 'css',
    image: 'image',
    font: 'font',
    video: 'video',
  };
  return typeMap[type] ?? 'other';
}

/**
 * Get file type from resource URL and initiator type
 */
export function getFileType(resource: ResourceTiming): string {
  if (
    resource.initiatorType === 'navigation' ||
    resource.entryType === 'navigation'
  )
    return 'document';
  const url = resource.name;
  if (url.includes('.js')) return 'script';
  if (url.includes('.css')) return 'stylesheet';
  if (url.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)/i)) return 'image';
  if (url.match(/\.(woff|woff2|ttf|otf|eot)/i)) return 'font';
  if (url.includes('.json')) return 'fetch';
  if (
    resource.initiatorType === 'xmlhttprequest' ||
    resource.initiatorType === 'fetch'
  )
    return 'fetch';
  if (resource.initiatorType === 'img') return 'image';
  if (resource.initiatorType === 'link') return 'stylesheet';
  if (resource.initiatorType === 'script') return 'script';
  return resource.initiatorType || 'other';
}

/**
 * Get status code from resource (defaults to 200)
 */
export function getStatusCode(resource: ResourceTiming): number {
  return resource.responseStatus || 200;
}

/**
 * Get protocol from resource
 */
export function getProtocol(resource: ResourceTiming): string {
  return resource.nextHopProtocol || 'unknown';
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Shorten URL for display by removing query string and anchor
 */
export function shortenUrl(url: string, maxLength: number = 60): string {
  const cleanUrl = url.split('?')[0].split('#')[0];
  if (cleanUrl.length <= maxLength) return cleanUrl;
  return '...' + cleanUrl.slice(-(maxLength - 3));
}

/**
 * Calculate file type breakdown statistics
 */
export function calculateTypeBreakdown(
  resources: ResourceTiming[],
): Record<string, TypeStats> {
  return resources.reduce(
    (acc, r) => {
      const type = getFileType(r);
      if (!acc[type]) {
        acc[type] = { count: 0, transferSize: 0, decodedSize: 0 };
      }
      acc[type].count++;
      acc[type].transferSize += r.transferSize;
      acc[type].decodedSize += r.decodedBodySize;
      return acc;
    },
    {} as Record<string, TypeStats>,
  );
}

/**
 * Enrich resources with computed fields for filtering
 */
export function enrichResources(
  resources: ResourceTiming[],
): EnrichedResource[] {
  return resources.map(r => ({
    ...r,
    fileType: getFileType(r),
    statusCode: getStatusCode(r),
    domain: getDomain(r.name),
    protocol: getProtocol(r),
    isBlocking: r.renderBlockingStatus === 'blocking',
  }));
}

/**
 * Get unique file types from resources
 */
export function getUniqueTypes(resources: ResourceTiming[]): string[] {
  return Array.from(new Set(resources.map(getFileType))).sort();
}

/**
 * Get unique status codes from resources
 */
export function getUniqueStatuses(resources: ResourceTiming[]): number[] {
  return Array.from(new Set(resources.map(getStatusCode))).sort(
    (a, b) => a - b,
  );
}

/**
 * Get unique domains from resources
 */
export function getUniqueDomains(resources: ResourceTiming[]): string[] {
  return Array.from(new Set(resources.map(r => getDomain(r.name)))).sort();
}

/**
 * Get unique protocols from resources
 */
export function getUniqueProtocols(resources: ResourceTiming[]): string[] {
  return Array.from(new Set(resources.map(getProtocol)))
    .filter(p => p !== 'unknown')
    .sort();
}

/**
 * Calculate summary metrics
 */
export function calculateSummary(resources: ResourceTiming[]) {
  return {
    totalResources: resources.length,
    blockingResources: resources.filter(
      r => r.renderBlockingStatus === 'blocking',
    ).length,
    totalTransferSize: resources.reduce((sum, r) => sum + r.transferSize, 0),
    totalDecodedSize: resources.reduce((sum, r) => sum + r.decodedBodySize, 0),
  };
}

/**
 * Calculate timing segment width percentage
 */
export function calculateTimingWidth(
  start: number,
  end: number,
  totalDuration: number,
): string {
  return `${(((end - start) / totalDuration) * 100).toFixed(1)}%`;
}

export { formatDuration };
