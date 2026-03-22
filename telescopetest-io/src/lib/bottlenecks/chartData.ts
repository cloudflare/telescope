import type { ResourceTiming } from '@/lib/types/resources';
import type { Har } from '@/lib/types/har';
import { getFileType } from '@/lib/utils/resources';

export type ChartDataItem = {
  label: string;
  value: number;
  percentage: string;
  colorType: string;
};

function formatPercentage(value: number, total: number): string {
  const pct = (value / total) * 100;
  if (pct === 0) return '0%';
  if (pct < 0.1) return '<0.1%';
  return `${pct.toFixed(1)}%`;
}

function getColorType(label: string, index: number): string {
  const typeOnly = label.split('(')[0].trim().toLowerCase();
  const typeMap: Record<string, string> = {
    document: 'document',
    script: 'script',
    stylesheet: 'stylesheet',
    image: 'image',
    font: 'font',
    video: 'video',
    fetch: 'fetch',
    iframe: 'document',
    other: 'other',
  };
  return typeMap[typeOnly] ?? `http-${index % 10}`;
}

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
    .map(([label, value], index) => ({
      label,
      value,
      percentage: formatPercentage(value, total),
      colorType: getColorType(label, index),
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
  if (total === 0) return [];
  return Object.entries(sizes)
    .map(([label, value], index) => ({
      label,
      value,
      percentage: formatPercentage(value, total),
      colorType: getColorType(label, index),
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
  if (total === 0) return [];
  return Object.entries(sizes)
    .map(([label, value], index) => ({
      label,
      value,
      percentage: formatPercentage(value, total),
      colorType: getColorType(label, index),
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
    .map(([label, value], index) => {
      const displayLabel = label
        .toLowerCase()
        .replace('http/', 'h')
        .replace('.0', '');
      return {
        label: displayLabel,
        value,
        percentage: formatPercentage(value, total),
        colorType: getColorType(displayLabel, index),
      };
    })
    .sort((a, b) => b.value - a.value);
}
