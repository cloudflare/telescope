import { getResultConfig, getResultMetrics } from '../../api';

function getCWVColor(value: number, thresholds: { good: number; poor: number }): string {
  if (value <= thresholds.good) return '#10b981'; // green
  if (value <= thresholds.poor) return '#f59e0b'; // yellow
  return '#ef4444'; // red
}

function formatCWV(value: number | null | undefined, unit: string = ''): string {
  if (value == null) return 'N/A';
  return `${value.toFixed(2)}${unit}`;
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
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
          <div style="padding: 16px; background: rgba(255,255,255,0.04); border-radius: 8px; border-left: 4px solid ${getCWVColor(lcp?.startTime || 0, lcpThresholds)};">
            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 8px;">LCP</div>
            <div style="font-size: 24px; font-weight: 600; margin-bottom: 4px;">${formatCWV(lcp?.startTime, 'ms')}</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.5);">Largest Contentful Paint</div>
          </div>
          <div style="padding: 16px; background: rgba(255,255,255,0.04); border-radius: 8px; border-left: 4px solid ${getCWVColor(fcp?.startTime || 0, fcpThresholds)};">
            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 8px;">FCP</div>
            <div style="font-size: 24px; font-weight: 600; margin-bottom: 4px;">${formatCWV(fcp?.startTime, 'ms')}</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.5);">First Contentful Paint</div>
          </div>
          <div style="padding: 16px; background: rgba(255,255,255,0.04); border-radius: 8px; border-left: 4px solid ${getCWVColor(clsValue, clsThresholds)};">
            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 8px;">CLS</div>
            <div style="font-size: 24px; font-weight: 600; margin-bottom: 4px;">${formatCWV(clsValue)}</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.5);">Cumulative Layout Shift</div>
          </div>
          <div style="padding: 16px; background: rgba(255,255,255,0.04); border-radius: 8px; border-left: 4px solid ${getCWVColor(ttfb || 0, ttfbThresholds)};">
            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 8px;">TTFB</div>
            <div style="font-size: 24px; font-weight: 600; margin-bottom: 4px;">${formatCWV(ttfb, 'ms')}</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.5);">Time to First Byte</div>
          </div>
        </div>
      </div>

      <!-- Additional Metrics Section -->
      <div class="panel pad" style="background: rgba(255,255,255,0.04);">
        <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">Additional Metrics</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
          <div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">Time to First Byte</div>
            <div style="font-size: 18px; font-weight: 500;">${formatCWV(ttfb, 'ms')}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">Transfer Size</div>
            <div style="font-size: 18px; font-weight: 500;">${transferSize ? (transferSize / 1024).toFixed(2) + ' KB' : 'N/A'}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">Response Time</div>
            <div style="font-size: 18px; font-weight: 500;">${formatCWV(responseTime, 'ms')}</div>
          </div>
        </div>
      </div>
    `;
  } catch (e: any) {
    content.innerHTML = `<p class="sub" style="margin:0">Failed to load overview: ${e?.message ?? e}</p>`;
  }
}
