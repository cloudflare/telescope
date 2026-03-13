import type { Har } from '@/lib/types/har';
import type { ResourceTiming } from '@/lib/types/resources';
import { getFileType, formatBytes } from '@/lib/utils/resources';

export type ChartDataItem = {
  label: string;
  value: number;
  percentage: string;
};

// based on chrome devTools waterfall
const contentTypeColors: Record<string, string> = {
  document: '#4285F4',
  script: '#F9AB00',
  stylesheet: '#9334E6',
  image: '#0F9D58',
  font: '#EA4335',
  video: '#46BDC6',
  fetch: '#FF6D01',
  iframe: '#4285F4',
  other: '#80868B',
};

const httpVersionColors = [
  '#4a7ec8',
  '#c8a040',
  '#4a9850',
  '#8050b8',
  '#c83820',
  '#2a8048',
  '#787878',
  '#e07820',
  '#7b3fb0',
  '#1a6b52',
];

function getColorForLabel(label: string, index: number): string {
  const typeOnly = label.split('(')[0].trim().toLowerCase();
  return (
    contentTypeColors[typeOnly] ??
    httpVersionColors[index % httpVersionColors.length]
  );
}

function createPieSlicePath(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const x1 = centerX + radius * Math.cos(startAngle);
  const y1 = centerY + radius * Math.sin(startAngle);
  const x2 = centerX + radius * Math.cos(endAngle);
  const y2 = centerY + radius * Math.sin(endAngle);
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
}

function renderSvgPieChart(
  container: HTMLElement,
  data: ChartDataItem[],
): void {
  const filteredData = data.filter(item => item.value > 0);
  const total = filteredData.reduce((sum, item) => sum + item.value, 0);
  if (total === 0 || filteredData.length === 0) {
    container.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:250px;color:var(--muted);font-size:0.875rem;">No data</div>';
    return;
  }
  const size = 250;
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size / 2 - 10;
  if (filteredData.length === 1) {
    const color = getColorForLabel(filteredData[0].label, 0);
    container.innerHTML = `<svg viewBox="0 0 ${size} ${size}" style="width:100%;height:250px;"><circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="${color}" /></svg>`;
    return;
  }
  let currentAngle = -Math.PI / 2;
  const paths = filteredData.map((item, index) => {
    const sliceAngle = (item.value / total) * Math.PI * 2;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;
    const pathData = createPieSlicePath(
      centerX,
      centerY,
      radius,
      startAngle,
      endAngle,
    );
    const color = getColorForLabel(item.label, index);
    return `<path d="${pathData}" fill="${color}" />`;
  });
  container.innerHTML = `<svg viewBox="0 0 ${size} ${size}" style="width:100%;height:250px;">${paths.join('')}</svg>`;
}

function renderLegend(
  legendElement: HTMLElement,
  data: ChartDataItem[],
  formatter?: (value: number) => string,
): void {
  legendElement.innerHTML = data
    .map((item, index) => {
      const color = getColorForLabel(item.label, index);
      const displayValue = formatter ? formatter(item.value) : item.value;
      return `<div class="legend-item"><div class="legend-color" style="background:${color}"></div><span>${item.label}: ${displayValue} (${item.percentage})</span></div>`;
    })
    .join('');
}

function formatPercentage(value: number, total: number): string {
  const pct = (value / total) * 100;
  if (pct === 0) return '0%';
  if (pct < 0.1) return '<0.1%';
  return `${pct.toFixed(1)}%`;
}

function calculateFileTypeCountStats(
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
      percentage: formatPercentage(value, total),
    }))
    .sort((a, b) => b.value - a.value);
}

function calculateFileTypeTransferStats(
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
    .map(([label, value]) => ({
      label,
      value,
      percentage: formatPercentage(value, total),
    }))
    .sort((a, b) => b.value - a.value);
}

function calculateFileTypeDecodedStats(
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
    .map(([label, value]) => ({
      label,
      value,
      percentage: formatPercentage(value, total),
    }))
    .sort((a, b) => b.value - a.value);
}

function calculateHttpVersionStats(har: Har | null): ChartDataItem[] {
  if (!har?.log?.entries) return [];
  const versions: Record<string, number> = {};
  har.log.entries.forEach(entry => {
    const version = entry.response.httpVersion;
    versions[version] = (versions[version] || 0) + 1;
  });
  const total = har.log.entries.length;
  return Object.entries(versions)
    .map(([label, value]) => {
      const displayLabel = label
        .toLowerCase()
        .replace('http/', 'h')
        .replace('.0', '');
      return {
        label: displayLabel,
        value,
        percentage: formatPercentage(value, total),
      };
    })
    .sort((a, b) => b.value - a.value);
}

export async function renderBottleneckCharts(
  countContainer: HTMLElement,
  transferContainer: HTMLElement,
  decodedContainer: HTMLElement,
  httpContainer: HTMLElement,
  testId: string,
  url: string,
): Promise<void> {
  const { loadBottlenecksData } = await import('./data.js');
  const { har, resources, metrics } = await loadBottlenecksData(testId);
  const navigationTiming = metrics?.navigationTiming;
  const allResources: ResourceTiming[] =
    navigationTiming && url
      ? [
          {
            name: url,
            entryType: 'navigation',
            startTime: 0,
            duration: navigationTiming.duration,
            initiatorType: 'navigation',
            deliveryType: navigationTiming.deliveryType,
            nextHopProtocol: navigationTiming.nextHopProtocol,
            renderBlockingStatus: navigationTiming.renderBlockingStatus,
            fetchStart: navigationTiming.fetchStart,
            domainLookupStart: navigationTiming.domainLookupStart,
            domainLookupEnd: navigationTiming.domainLookupEnd,
            connectStart: navigationTiming.connectStart,
            connectEnd: navigationTiming.connectEnd,
            secureConnectionStart: navigationTiming.secureConnectionStart,
            requestStart: navigationTiming.requestStart,
            responseStart: navigationTiming.responseStart,
            responseEnd: navigationTiming.responseEnd,
            transferSize: navigationTiming.transferSize ?? 0,
            encodedBodySize: navigationTiming.encodedBodySize ?? 0,
            decodedBodySize: navigationTiming.decodedBodySize ?? 0,
            responseStatus: navigationTiming.responseStatus,
          },
          ...resources,
        ]
      : resources;
  const countStats = calculateFileTypeCountStats(allResources);
  const transferStats = calculateFileTypeTransferStats(allResources);
  const decodedStats = calculateFileTypeDecodedStats(allResources);
  const httpStats = calculateHttpVersionStats(har);
  renderSvgPieChart(countContainer, countStats);
  renderSvgPieChart(transferContainer, transferStats);
  renderSvgPieChart(decodedContainer, decodedStats);
  renderSvgPieChart(httpContainer, httpStats);
  const countLegend = document.getElementById('legend-count');
  const transferLegend = document.getElementById('legend-transfer');
  const decodedLegend = document.getElementById('legend-decoded');
  const httpLegend = document.getElementById('legend-http');
  if (countLegend) renderLegend(countLegend, countStats);
  if (transferLegend) renderLegend(transferLegend, transferStats, formatBytes);
  if (decodedLegend) renderLegend(decodedLegend, decodedStats, formatBytes);
  if (httpLegend) renderLegend(httpLegend, httpStats);
}
