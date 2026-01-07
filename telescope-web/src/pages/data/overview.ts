import { getResultConfig, getResultMetrics } from '../../api';

function getCWVColor(value: number, thresholds: { good: number; poor: number }): string {
  if (value <= thresholds.good) return '#10b981'; // green
  if (value <= thresholds.poor) return '#f59e0b'; // yellow
  return '#ef4444'; // red
}

export async function renderOverview(outlet: HTMLElement, testId: string) {
  outlet.innerHTML = `
    <data-menu test-id="${testId}" active="overview"></data-menu>
    <section class="panel pad">
      <div>
        <h1 class="h1" style="margin-bottom: 4px;">Overview</h1>
        <p class="sub" style="margin:0">Test: <code>${testId}</code></p>
      </div>
      <div id="content" style="margin-top: 24px;"></div>
    </section>
  `;

  const content = outlet.querySelector<HTMLElement>('#content');
  if (!content) return;

  try {
    const [config, metrics] = await Promise.all([
      getResultConfig(testId).catch(() => null),
      getResultMetrics(testId).catch(() => null),
    ]);

    const url = config?.url ?? config?.options?.url ?? 'N/A';
    const date = config?.date ?? 'N/A';
    const browser = config?.options?.browser ?? config?.browserConfig?.channel ?? 'N/A';
    const capturedBy = config?.options?.url ? 'Telescope' : 'N/A';

    const navTiming = metrics?.navigationTiming;
    const lcp = metrics?.largestContentfulPaint?.[0];
    const cls = metrics?.layoutShifts;
    const clsValue = cls?.reduce((sum: number, s: any) => sum + (s.value || 0), 0) ?? 0;
    const fcp = metrics?.paintTiming?.find((p: any) => p.name === 'first-contentful-paint');
    const ttfb = navTiming?.responseStart ?? navTiming?.timeToFirstByte;

    // CWV thresholds
    const lcpThresholds = { good: 2500, poor: 4000 };
    const fcpThresholds = { good: 1800, poor: 3000 };
    const clsThresholds = { good: 0.1, poor: 0.25 };
    const ttfbThresholds = { good: 800, poor: 1800 };

    const transferSize = navTiming?.transferSize ?? 0;
    const responseTime = navTiming?.responseEnd
      ? navTiming.responseEnd - (navTiming.responseStart || 0)
      : null;

    content.innerHTML = `
      <!-- Basic Info Section -->
      <div class="panel pad" style="background: rgba(255,255,255,0.04); margin-bottom: 24px;">
        <div style="display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: start;">
          <div>
            <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">Test Information</h3>
            <dl style="display: grid; gap: 12px; margin: 0;">
              <div>
                <dt style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">URL</dt>
                <dd style="margin:0; word-break: break-all;"><a href="${url}" target="_blank" style="color: rgba(125,211,252,0.92);">${url}</a></dd>
              </div>
              <div>
                <dt style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">Page Title</dt>
                <dd style="margin:0;">${navTiming?.name?.replace(/^https?:\/\//, '').replace(/\/$/, '') || 'N/A'}</dd>
              </div>
              <div>
                <dt style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">Date</dt>
                <dd style="margin:0;">${date}</dd>
              </div>
              <div>
                <dt style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">Browser</dt>
                <dd style="margin:0;">${browser}</dd>
              </div>
              <div>
                <dt style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">Captured By</dt>
                <dd style="margin:0;">${capturedBy}</dd>
              </div>
            </dl>
          </div>
          <div style="max-width: 400px; flex-shrink: 0;">
            <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">Screenshot</h3>
            <img 
              src="/api/results/${encodeURIComponent(testId)}/screenshot.png" 
              alt="Screenshot" 
              style="width: 100%; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12);"
              onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
            />
            <p class="sub" style="margin:8px 0 0; display:none;">No screenshot found.</p>
          </div>
        </div>
      </div>

      <!-- Core Web Vitals Section -->
      <div class="panel pad" style="background: rgba(255,255,255,0.04); margin-bottom: 24px;">
        <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">Core Web Vitals</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;" id="cwv-metrics"></div>
      </div>

      <!-- Additional Metrics Section -->
      <div class="panel pad" style="background: rgba(255,255,255,0.04);">
        <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">Additional Metrics</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;" id="additional-metrics"></div>
      </div>
    `;

    // Populate CWV metrics
    const cwvContainer = content.querySelector<HTMLElement>('#cwv-metrics');
    if (cwvContainer) {
      const lcpEl = document.createElement('metric-item');
      lcpEl.setAttribute('label', 'LCP');
      lcpEl.setAttribute('value', String(lcp?.startTime || 0));
      lcpEl.setAttribute('unit', 'ms');
      lcpEl.setAttribute('size', 'large');
      lcpEl.setAttribute('border-color', getCWVColor(lcp?.startTime || 0, lcpThresholds));
      lcpEl.setAttribute('subtitle', 'Largest Contentful Paint');
      cwvContainer.appendChild(lcpEl);

      const fcpEl = document.createElement('metric-item');
      fcpEl.setAttribute('label', 'FCP');
      fcpEl.setAttribute('value', String(fcp?.startTime || 0));
      fcpEl.setAttribute('unit', 'ms');
      fcpEl.setAttribute('size', 'large');
      fcpEl.setAttribute('border-color', getCWVColor(fcp?.startTime || 0, fcpThresholds));
      fcpEl.setAttribute('subtitle', 'First Contentful Paint');
      cwvContainer.appendChild(fcpEl);

      const clsEl = document.createElement('metric-item');
      clsEl.setAttribute('label', 'CLS');
      clsEl.setAttribute('value', String(clsValue));
      clsEl.setAttribute('size', 'large');
      clsEl.setAttribute('border-color', getCWVColor(clsValue, clsThresholds));
      clsEl.setAttribute('subtitle', 'Cumulative Layout Shift');
      cwvContainer.appendChild(clsEl);

      const ttfbEl = document.createElement('metric-item');
      ttfbEl.setAttribute('label', 'TTFB');
      ttfbEl.setAttribute('value', String(ttfb || 0));
      ttfbEl.setAttribute('unit', 'ms');
      ttfbEl.setAttribute('size', 'large');
      ttfbEl.setAttribute('border-color', getCWVColor(ttfb || 0, ttfbThresholds));
      ttfbEl.setAttribute('subtitle', 'Time to First Byte');
      cwvContainer.appendChild(ttfbEl);
    }

    // Populate additional metrics
    const additionalContainer = content.querySelector<HTMLElement>('#additional-metrics');
    if (additionalContainer) {
      const ttfb2El = document.createElement('metric-item');
      ttfb2El.setAttribute('label', 'Time to First Byte');
      ttfb2El.setAttribute('value', String(ttfb || 0));
      ttfb2El.setAttribute('unit', 'ms');
      ttfb2El.setAttribute('size', 'medium');
      additionalContainer.appendChild(ttfb2El);

      const transferEl = document.createElement('metric-item');
      transferEl.setAttribute('label', 'Transfer Size');
      transferEl.setAttribute('value', transferSize ? String((transferSize / 1024).toFixed(2)) : '');
      transferEl.setAttribute('unit', transferSize ? ' KB' : '');
      transferEl.setAttribute('size', 'medium');
      additionalContainer.appendChild(transferEl);

      const responseEl = document.createElement('metric-item');
      responseEl.setAttribute('label', 'Response Time');
      responseEl.setAttribute('value', String(responseTime || 0));
      responseEl.setAttribute('unit', 'ms');
      responseEl.setAttribute('size', 'medium');
      additionalContainer.appendChild(responseEl);
    }
  } catch (e: any) {
    content.innerHTML = `<p class="sub" style="margin:0">Failed to load overview: ${e?.message ?? e}</p>`;
  }
}
