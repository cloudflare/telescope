import type { ChartDataItem } from './stats';

export const contentTypeColors: Record<string, string> = {
  document: '#4a7ec8',
  script: '#c8a040',
  stylesheet: '#4a9850',
  image: '#8050b8',
  font: '#c83820',
  video: '#2a8048',
  fetch: '#e07820', // not content
  iframe: '#d946ef', // not content (if html, document)
  other: '#787878',
};

export const defaultChartColors = [
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

function getTextColor(): string {
  const cssValue = getComputedStyle(document.documentElement)
    .getPropertyValue('--text')
    .trim();
  if (cssValue.startsWith('rgba') || cssValue.startsWith('#')) {
    return cssValue;
  }
  return '#000000';
}

function getColorForLabel(label: string, index: number): string {
  const typeOnly = label.split('(')[0].trim().toLowerCase();
  if (contentTypeColors[typeOnly]) {
    return contentTypeColors[typeOnly];
  }
  return defaultChartColors[index % defaultChartColors.length];
}

export function drawPieChart(
  canvas: HTMLCanvasElement,
  data: ChartDataItem[],
  drawLegend: boolean = true,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Failed to get canvas context');
    return;
  }
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    console.error('Canvas has no dimensions:', rect);
    return;
  }
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const radius = Math.min(centerX, centerY) - 40;
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const textColor = getTextColor();
  if (total === 0 || data.length === 0) {
    ctx.fillStyle = textColor;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data', centerX, centerY);
    return;
  }
  let currentAngle = -Math.PI / 2;
  data.forEach((item, index) => {
    const sliceAngle = (item.value / total) * Math.PI * 2;
    ctx.fillStyle = getColorForLabel(item.label, index);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.closePath();
    ctx.fill();
    currentAngle += sliceAngle;
  });
  if (drawLegend) {
    const legendX = 10;
    let legendY = rect.height - data.length * 20 - 10;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    data.forEach((item, index) => {
      ctx.fillStyle = getColorForLabel(item.label, index);
      ctx.fillRect(legendX, legendY, 12, 12);
      ctx.fillStyle = textColor;
      ctx.fillText(
        `${item.label}: ${item.value} (${item.percentage})`,
        legendX + 18,
        legendY + 10,
      );
      legendY += 20;
    });
  }
}
