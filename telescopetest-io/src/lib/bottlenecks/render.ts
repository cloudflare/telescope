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
  const typeOnly = label.split('(')[0].trim().toLowerCase();
  if (contentTypeColors[typeOnly]) {
    return contentTypeColors[typeOnly];
  }
  return defaultChartColors[index % defaultChartColors.length];
}

function renderLegend(
  legendElement: HTMLElement,
  data: ChartDataItem[],
  showValue: boolean = true,
): void {
  legendElement.innerHTML = data
    .map((item, index) => {
      const typeOnly = item.label.split('(')[0].trim();
      const text = showValue
        ? `${typeOnly}: ${item.value} (${item.percentage})`
        : `${item.label}: ${item.value} (${item.percentage})`;
      return `
    <div class="legend-item">
      <div class="legend-color" style="background: ${getColorForLabel(item.label, index)}"></div>
      <span>${text}</span>
    </div>
  `;
    })
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
  const transferStatsWithBytes = transferStats.map(item => ({
    ...item,
    bytes: item.value,
  }));
  const decodedStatsWithBytes = decodedStats.map(item => ({
    ...item,
    bytes: item.value,
  }));
  drawPieChart(countCanvas, countStats, false);
  drawPieChart(transferCanvas, transferStats, false);
  drawPieChart(decodedCanvas, decodedStats, false);
  drawPieChart(httpCanvas, httpVersionStats, false);
  const countLegend = document.getElementById('legend-count');
  const transferLegend = document.getElementById('legend-transfer');
  const decodedLegend = document.getElementById('legend-decoded');
  const httpLegend = document.getElementById('legend-http');
  if (countLegend) renderLegend(countLegend, countStats, false);
  if (transferLegend) {
    transferLegend.innerHTML = transferStats
      .map(
        (item, index) => `
      <div class="legend-item">
        <div class="legend-color" style="background: ${getColorForLabel(item.label, index)}"></div>
        <span>${item.label}: ${formatBytes(item.value)} (${item.percentage})</span>
      </div>
    `,
      )
      .join('');
  }
  if (decodedLegend) {
    decodedLegend.innerHTML = decodedStats
      .map(
        (item, index) => `
      <div class="legend-item">
        <div class="legend-color" style="background: ${getColorForLabel(item.label, index)}"></div>
        <span>${item.label}: ${formatBytes(item.value)} (${item.percentage})</span>
      </div>
    `,
      )
      .join('');
  }
  if (httpLegend) renderLegend(httpLegend, httpVersionStats, false);
}
