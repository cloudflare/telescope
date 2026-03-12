import type { Har } from '@/lib/types/har';
import type { ResourceTiming } from '@/lib/types/resources';
import { getFileType } from '@/lib/utils/resources';

export type ChartDataItem = {
  label: string;
  value: number;
  percentage: string;
};

export function calculateFileTypeStats(
  resources: ResourceTiming[],
): ChartDataItem[] {
  const counts: Record<string, number> = {};
  resources.forEach(r => {
    const type = getFileType(r);
    counts[type] = (counts[type] || 0) + 1;
  });
  const total = resources.length;
  return Object.entries(counts).map(([label, value]) => ({
    label,
    value,
    percentage: `${((value / total) * 100).toFixed(1)}%`,
  }));
}

export function calculateCompressionStats(
  resources: ResourceTiming[],
): ChartDataItem[] {
  const compressed = resources.filter(
    r => r.encodedBodySize < r.decodedBodySize,
  ).length;
  const uncompressed = resources.length - compressed;
  const total = resources.length;
  return [
    {
      label: 'Compressed',
      value: compressed,
      percentage: `${((compressed / total) * 100).toFixed(1)}%`,
    },
    {
      label: 'Uncompressed',
      value: uncompressed,
      percentage: `${((uncompressed / total) * 100).toFixed(1)}%`,
    },
  ];
}

export function calculateCompressionSizeStats(
  resources: ResourceTiming[],
): ChartDataItem[] {
  const compressedResources = resources.filter(
    r => r.encodedBodySize < r.decodedBodySize,
  );
  const uncompressedResources = resources.filter(
    r => r.encodedBodySize >= r.decodedBodySize,
  );
  const compressedSize = compressedResources.reduce(
    (sum, r) => sum + r.transferSize,
    0,
  );
  const uncompressedSize = uncompressedResources.reduce(
    (sum, r) => sum + r.transferSize,
    0,
  );
  const total = compressedSize + uncompressedSize;
  return [
    {
      label: 'Compressed',
      value: compressedSize,
      percentage: `${((compressedSize / total) * 100).toFixed(1)}%`,
    },
    {
      label: 'Uncompressed',
      value: uncompressedSize,
      percentage: `${((uncompressedSize / total) * 100).toFixed(1)}%`,
    },
  ];
}

export function calculateHttpVersionStats(har: Har | null): ChartDataItem[] {
  if (!har?.log?.entries) return [];
  const versions: Record<string, number> = {};
  har.log.entries.forEach(entry => {
    const version = entry.response.httpVersion;
    versions[version] = (versions[version] || 0) + 1;
  });
  const total = har.log.entries.length;
  return Object.entries(versions).map(([label, value]) => ({
    label,
    value,
    percentage: `${((value / total) * 100).toFixed(1)}%`,
  }));
}
