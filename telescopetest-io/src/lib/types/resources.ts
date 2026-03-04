import type { ServerTiming } from './results';

/**
 * Resource timing entry from Performance API
 * Collected from resources.json in Telescope test results
 */
export interface ResourceTiming {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
  initiatorType: string;
  deliveryType?: string;
  nextHopProtocol?: string;
  renderBlockingStatus?: string;
  contentEncoding?: string;
  workerStart?: number;
  fetchStart: number;
  domainLookupStart: number;
  domainLookupEnd: number;
  connectStart: number;
  connectEnd: number;
  secureConnectionStart: number;
  requestStart: number;
  responseStart: number;
  responseEnd: number;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
  responseStatus?: number;
  serverTiming?: ServerTiming[];
}

/**
 * Enriched resource with computed fields for filtering
 */
export interface EnrichedResource extends ResourceTiming {
  fileType: string;
  statusCode: number;
  domain: string;
  protocol: string;
  isBlocking: boolean;
}

/**
 * File type breakdown statistics
 */
export interface TypeStats {
  count: number;
  transferSize: number;
  decodedSize: number;
}
