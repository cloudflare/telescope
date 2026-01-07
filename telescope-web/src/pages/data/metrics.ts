import { getResultMetrics } from '../../api';

function formatMs(ms: number | null | undefined): string {
  if (ms == null) return 'N/A';
  return `${ms.toFixed(2)}ms`;
}

function formatBarWidth(start: number, end: number, total: number): string {
  const width = ((end - start) / total) * 100;
  return `${Math.max(width, 0)}%`;
}

function formatBarOffset(start: number, total: number): string {
  const offset = (start / total) * 100;
  return `${Math.max(offset, 0)}%`;
}

export async function renderMetrics(outlet: HTMLElement, testId: string) {
  outlet.innerHTML = `
    <data-menu test-id="${testId}" active="metrics"></data-menu>
    <section class="panel pad">
      <div>
        <h1 class="h1" style="margin-bottom: 4px;">Metrics</h1>
        <p class="sub" style="margin:0">Test: <code>${testId}</code></p>
      </div>
      <div id="content" style="margin-top: 24px;"></div>
    </section>
  `;

  const content = outlet.querySelector<HTMLElement>('#content');
  if (!content) return;

  try {
    const metrics = await getResultMetrics(testId);
    const nav = metrics?.navigationTiming || {};
    const totalDuration = nav.duration || 0;
    const ttfb = nav.responseStart || 0;

    const phases = [
      { name: 'First Request DNS', start: nav.domainLookupStart || 0, end: nav.domainLookupEnd || 0 },
      { name: 'Connect', start: nav.connectStart || 0, end: nav.connectEnd || 0 },
      { name: 'Request', start: nav.requestStart || 0, end: nav.responseStart || 0 },
      { name: 'Response', start: nav.responseStart || 0, end: nav.responseEnd || 0 },
      { name: 'DOM Interactive', start: nav.domInteractive || 0, end: nav.domInteractive || 0 },
      { name: 'DOM Complete', start: nav.domComplete || 0, end: nav.domComplete || 0 },
      { name: 'Load Event End', start: nav.loadEventStart || 0, end: nav.loadEventEnd || 0 },
    ].filter(p => p.start > 0 && p.end > 0);

    const lcp = metrics?.largestContentfulPaint?.[0];
    const fcp = metrics?.paintTiming?.find((p: any) => p.name === 'first-contentful-paint');
    const cls = metrics?.layoutShifts || [];
    const clsCount = cls.length;
    const clsValue = cls.reduce((sum: number, s: any) => sum + (s.value || 0), 0);
    const tbt = nav.totalBlockingTime || 0;

    content.innerHTML = `
      <!-- CWV Values Section -->
      <div class="panel pad" style="background: rgba(255,255,255,0.04); margin-bottom: 24px;">
        <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">Core Web Vitals</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
          <div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">LCP</div>
            <div style="font-size: 24px; font-weight: 600;">${formatMs(lcp?.startTime)}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">FCP</div>
            <div style="font-size: 24px; font-weight: 600;">${formatMs(fcp?.startTime)}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">CLS</div>
            <div style="font-size: 24px; font-weight: 600;">${clsValue.toFixed(4)}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">TTFB</div>
            <div style="font-size: 24px; font-weight: 600;">${formatMs(ttfb)}</div>
          </div>
        </div>
      </div>

      <!-- Navigation Timings Section -->
      <div class="panel pad" style="background: rgba(255,255,255,0.04); margin-bottom: 24px;">
        <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">Navigation Timings</h3>
        <div style="margin-bottom: 16px;">
          <div style="display: flex; gap: 16px; margin-bottom: 8px;">
            <div>
              <div style="font-size: 12px; color: rgba(255,255,255,0.6);">Total Duration</div>
              <div style="font-size: 18px; font-weight: 500;">${formatMs(totalDuration)}</div>
            </div>
            <div>
              <div style="font-size: 12px; color: rgba(255,255,255,0.6);">Time to First Byte</div>
              <div style="font-size: 18px; font-weight: 500;">${formatMs(ttfb)}</div>
            </div>
          </div>
        </div>
        <div style="position: relative; height: ${phases.length * 40 + 20}px; background: rgba(255,255,255,0.02); border-radius: 8px; padding: 10px;">
          ${phases
            .map(
              p => `
            <div style="position: absolute; left: ${formatBarOffset(p.start, totalDuration)}; top: ${phases.indexOf(p) * 40 + 10}px; width: ${formatBarWidth(p.start, p.end, totalDuration)}; height: 30px; background: rgba(125,211,252,0.3); border-radius: 4px; display: flex; align-items: center; padding: 0 8px;">
              <span style="font-size: 11px; color: rgba(255,255,255,0.9); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</span>
            </div>
          `,
            )
            .join('')}
          <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 1px; background: rgba(255,255,255,0.2);"></div>
        </div>
      </div>

      <!-- Performance Metrics Section -->
      <div class="panel pad" style="background: rgba(255,255,255,0.04); margin-bottom: 24px;">
        <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">Performance Metrics</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
          <div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">Total Blocking Time</div>
            <div style="font-size: 18px; font-weight: 500;">${formatMs(tbt)}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">Time to First Byte</div>
            <div style="font-size: 18px; font-weight: 500;">${formatMs(ttfb)}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">First Paint</div>
            <div style="font-size: 18px; font-weight: 500;">${formatMs(metrics?.paintTiming?.find((p: any) => p.name === 'first-paint')?.startTime)}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">First Contentful Paint</div>
            <div style="font-size: 18px; font-weight: 500;">${formatMs(fcp?.startTime)}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">Largest Contentful Paint</div>
            <div style="font-size: 18px; font-weight: 500;">${formatMs(lcp?.startTime)}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;"># of Layout Shifts</div>
            <div style="font-size: 18px; font-weight: 500;">${clsCount}</div>
          </div>
        </div>
      </div>

      <!-- Server Timings Section -->
      <div class="panel pad" style="background: rgba(255,255,255,0.04); margin-bottom: 24px;">
        <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">Server Timings</h3>
        ${(nav.serverTiming?.length ?? 0) > 0
          ? `
          <div style="display: grid; gap: 8px;">
            ${nav.serverTiming.map(
              (st: any) => `
              <div style="padding: 12px; background: rgba(255,255,255,0.02); border-radius: 4px;">
                <div style="font-weight: 500; margin-bottom: 4px;">${st.name || 'N/A'}</div>
                <div style="font-size: 12px; color: rgba(255,255,255,0.6);">
                  ${st.duration ? `Duration: ${st.duration}ms` : ''}
                  ${st.description ? ` - ${st.description}` : ''}
                </div>
              </div>
            `,
            )}
          </div>
        `
          : '<p class="sub" style="margin:0">No server timings available.</p>'}
      </div>

      <!-- User Timings Section -->
      <div class="panel pad" style="background: rgba(255,255,255,0.04);">
        <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">User Timings</h3>
        ${(metrics?.userTiming?.length ?? 0) > 0
          ? `
          <div style="display: grid; gap: 8px;">
            ${metrics.userTiming.map(
              (ut: any) => `
              <div style="padding: 12px; background: rgba(255,255,255,0.02); border-radius: 4px;">
                <div style="font-weight: 500; margin-bottom: 4px;">${ut.name || 'N/A'}</div>
                <div style="font-size: 12px; color: rgba(255,255,255,0.6);">
                  Type: ${ut.entryType || 'N/A'}
                  ${ut.startTime != null ? ` | Start Time: ${formatMs(ut.startTime)}` : ''}
                  ${ut.duration != null ? ` | Duration: ${formatMs(ut.duration)}` : ''}
                </div>
              </div>
            `,
            )}
          </div>
        `
          : '<p class="sub" style="margin:0">No user timings available.</p>'}
      </div>
    `;
  } catch (e: any) {
    content.innerHTML = `<p class="sub" style="margin:0">Failed to load metrics: ${e?.message ?? e}</p>`;
  }
}

