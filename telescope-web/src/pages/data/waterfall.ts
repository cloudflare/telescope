import { getResultHar } from '../../api';

function formatMs(ms: number): string {
  return `${ms.toFixed(2)}ms`;
}

function getResourceColor(entry: any): string {
  const mime = (entry.response?.content?.mimeType || '').toLowerCase();
  if (mime.includes('html')) return '#ef4444';
  if (mime.includes('css')) return '#3b82f6';
  if (mime.includes('javascript') || mime.includes('application/json')) return '#f59e0b';
  if (mime.includes('image')) return '#10b981';
  if (mime.includes('font')) return '#8b5cf6';
  return '#6b7280';
}

export async function renderWaterfall(outlet: HTMLElement, testId: string) {
  outlet.innerHTML = `
    <data-menu test-id="${testId}" active="waterfall"></data-menu>
    <section class="panel pad">
      <div>
        <h1 class="h1" style="margin-bottom: 4px;">Waterfall</h1>
        <p class="sub" style="margin:0">Test: <code>${testId}</code></p>
      </div>
      <div id="content" style="margin-top: 24px;"></div>
    </section>
  `;

  const content = outlet.querySelector<HTMLElement>('#content');
  if (!content) return;

  try {
    const har = await getResultHar(testId).catch(() => null as any);
    const entries = har?.log?.entries || [];
    if (entries.length === 0) {
      content.innerHTML = '<p class="sub" style="margin:0">No HAR data available.</p>';
      return;
    }

    // Find earliest start time
    let earliest = Infinity;
    entries.forEach((e: any) => {
      if (e.startedDateTime) {
        const time = new Date(e.startedDateTime).getTime();
        if (time < earliest) earliest = time;
      }
    });

    // Calculate max duration
    let maxTime = 0;
    entries.forEach((e: any) => {
      const start = e.startedDateTime ? new Date(e.startedDateTime).getTime() - earliest : 0;
      const duration = e.time || 0;
      if (start + duration > maxTime) maxTime = start + duration;
    });

    const scale = Math.max(maxTime, 1000); // Minimum 1 second scale

    content.innerHTML = `
      <div class="panel pad" style="background: rgba(255,255,255,0.04);">
        <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">Waterfall Timeline</h3>
        <div style="overflow-x: auto;">
          <div style="min-width: ${Math.max(scale / 10, 800)}px;">
            ${entries
              .map((entry: any) => {
                const start = entry.startedDateTime
                  ? new Date(entry.startedDateTime).getTime() - earliest
                  : 0;
                const duration = entry.time || 0;
                const url = entry.request?.url || '';
                const method = entry.request?.method || 'GET';
                const status = entry.response?.status || 0;

                const phases = {
                  dns: entry.timings?.dns || 0,
                  connect: entry.timings?.connect || 0,
                  ssl: entry.timings?.ssl || 0,
                  send: entry.timings?.send || 0,
                  wait: entry.timings?.wait || 0,
                  receive: entry.timings?.receive || 0,
                };

                return `
                  <div style="display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); min-height: 50px;">
                    <div style="width: 200px; flex-shrink: 0; padding-right: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px;" title="${url}">
                      <div style="font-weight: 500; color: ${getResourceColor(entry)};">${method} ${status}</div>
                      <div style="color: rgba(255,255,255,0.6); overflow: hidden; text-overflow: ellipsis;">${url}</div>
                    </div>
                    <div style="flex: 1; position: relative; height: 30px;">
                      <div style="position: absolute; left: ${(start / scale) * 100}%; width: ${(duration / scale) * 100}%; height: 100%; background: ${getResourceColor(entry)}; opacity: 0.6; border-radius: 2px;">
                        <div style="position: absolute; left: 0; top: 0; bottom: 0; width: ${((phases.dns + phases.connect + phases.ssl) / duration) * 100}%; background: rgba(0,0,0,0.2);"></div>
                        <div style="position: absolute; left: ${((phases.dns + phases.connect + phases.ssl) / duration) * 100}%; top: 0; bottom: 0; width: ${(phases.wait / duration) * 100}%; background: rgba(255,255,255,0.3);"></div>
                      </div>
                      <div style="position: absolute; left: ${(start / scale) * 100}%; top: 0; bottom: 0; display: flex; align-items: center; padding: 0 4px; font-size: 10px; color: rgba(255,255,255,0.8);">${formatMs(duration)}</div>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      </div>
    `;
  } catch (e: any) {
    content.innerHTML = `<p class="sub" style="margin:0">Failed to load waterfall: ${e?.message ?? e}</p>`;
  }
}

