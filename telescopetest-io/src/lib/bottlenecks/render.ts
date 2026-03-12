import { loadBottlenecksData } from './data.js';
import {
  calculateFileTypeCountStats,
  calculateFileTypeTransferStats,
  calculateFileTypeDecodedStats,
  calculateHttpVersionStats,
} from './stats.js';
import {
  drawPieChart,
  contentTypeColors,
  defaultChartColors,
} from './charts.js';
import { formatBytes } from '@/lib/utils/resources.js';
import type { ChartDataItem } from './stats.js';

function getColorForLabel(label: string, index: number): string {
  const normalized = label.toLowerCase();
  if (contentTypeColors[normalized]) {
    return contentTypeColors[normalized];
  }
  return defaultChartColors[index % defaultChartColors.length];
}

function renderLegend(legendElement: HTMLElement, data: ChartDataItem[]): void {
  legendElement.innerHTML = data
    .map(
      (item, index) => `
    <div class="legend-item">
      <div class="legend-color" style="background: ${getColorForLabel(item.label, index)}"></div>
      <span>${item.label}: ${item.value} (${item.percentage})</span>
    </div>
  `,
    )
    .join('');
}

export async function renderBottleneckCharts(
  countCanvas: HTMLCanvasElement,
  transferCanvas: HTMLCanvasElement,
  decodedCanvas: HTMLCanvasElement,
  httpCanvas: HTMLCanvasElement,
  testId: string,
): Promise<void> {
  const { har, resources } = await loadBottlenecksData(testId);
  const countStats = calculateFileTypeCountStats(resources);
  const transferStats = calculateFileTypeTransferStats(resources);
  const decodedStats = calculateFileTypeDecodedStats(resources);
  const httpVersionStats = calculateHttpVersionStats(har);
  const transferStatsFormatted = transferStats.map(item => ({
    ...item,
    label: `${item.label} (${formatBytes(item.value)})`,
  }));
  const decodedStatsFormatted = decodedStats.map(item => ({
    ...item,
    label: `${item.label} (${formatBytes(item.value)})`,
  }));
  drawPieChart(countCanvas, countStats, false);
  drawPieChart(transferCanvas, transferStatsFormatted, false);
  drawPieChart(decodedCanvas, decodedStatsFormatted, false);
  drawPieChart(httpCanvas, httpVersionStats, false);
  const countLegend = document.getElementById('legend-count');
  const transferLegend = document.getElementById('legend-transfer');
  const decodedLegend = document.getElementById('legend-decoded');
  const httpLegend = document.getElementById('legend-http');
  if (countLegend) renderLegend(countLegend, countStats);
  if (transferLegend) renderLegend(transferLegend, transferStatsFormatted);
  if (decodedLegend) renderLegend(decodedLegend, decodedStatsFormatted);
  if (httpLegend) renderLegend(httpLegend, httpVersionStats);
}
