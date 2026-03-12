import type { Har } from '@/lib/types/har';
import type { ResourceTiming } from '@/lib/types/resources';
import { getFileType } from '@/lib/utils/resources';

export type ChartDataItem = {
  label: string;
  value: number;
  percentage: string;
};

export function calculateFileTypeCountStats(
  resources: ResourceTiming[],
): ChartDataItem[] {
  const counts: Record<string, number> = {};
  resources.forEach(r => {
    const type = getFileType(r);
    counts[type] = (counts[type] || 0) + 1;
  });
  const total = resources.length;
  return Object.entries(counts)
    .map(([label, value]) => ({
      label,
      value,
      percentage: `${((value / total) * 100).toFixed(1)}%`,
    }))
    .sort((a, b) => b.value - a.value);
}

export function calculateFileTypeTransferStats(
  resources: ResourceTiming[],
): ChartDataItem[] {
  const sizes: Record<string, number> = {};
  resources.forEach(r => {
    const type = getFileType(r);
    sizes[type] = (sizes[type] || 0) + r.transferSize;
  });
  const total = Object.values(sizes).reduce((sum, val) => sum + val, 0);
  return Object.entries(sizes)
    .map(([label, value]) => ({
      label,
      value,
      percentage: `${((value / total) * 100).toFixed(1)}%`,
    }))
    .sort((a, b) => b.value - a.value);
}

export function calculateFileTypeDecodedStats(
  resources: ResourceTiming[],
): ChartDataItem[] {
  const sizes: Record<string, number> = {};
  resources.forEach(r => {
    const type = getFileType(r);
    sizes[type] = (sizes[type] || 0) + r.decodedBodySize;
  });
  const total = Object.values(sizes).reduce((sum, val) => sum + val, 0);
  return Object.entries(sizes)
    .map(([label, value]) => ({
      label,
      value,
      percentage: `${((value / total) * 100).toFixed(1)}%`,
    }))
    .sort((a, b) => b.value - a.value);
}

export function calculateHttpVersionStats(har: Har | null): ChartDataItem[] {
  if (!har?.log?.entries) return [];
  const versions: Record<string, number> = {};
  har.log.entries.forEach(entry => {
    const version = entry.response.httpVersion;
    versions[version] = (versions[version] || 0) + 1;
  });
  const total = har.log.entries.length;
  return Object.entries(versions)
    .map(([label, value]) => ({
      label,
      value,
      percentage: `${((value / total) * 100).toFixed(1)}%`,
    }))
    .sort((a, b) => b.value - a.value);
}
