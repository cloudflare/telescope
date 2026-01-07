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

// Determine if a resource is critical (HTML, blocking CSS/JS, or render-blocking)
function isCriticalResource(entry: any): boolean {
  const mime = (entry.response?.content?.mimeType || '').toLowerCase();
  const url = (entry.request?.url || '').toLowerCase();

  // HTML is always critical
  if (mime.includes('html') || url.endsWith('.html')) return true;

  // Render-blocking CSS
  if (mime.includes('css') && entry.response?.headers?.some((h: any) => 
    h.name?.toLowerCase() === 'x-render-blocking' || h.name?.toLowerCase() === 'render-blocking'
  )) return true;

  // Critical JavaScript (usually in <head> or blocking)
  if (mime.includes('javascript') && (
    entry.response?.headers?.some((h: any) => 
      h.name?.toLowerCase() === 'x-render-blocking' || h.name?.toLowerCase() === 'render-blocking'
    ) || url.includes('critical') || url.includes('bootstrap')
  )) return true;

  return false;
}

export async function renderCriticalPath(outlet: HTMLElement, testId: string) {
  outlet.innerHTML = `
    <data-menu test-id="${testId}" active="critical-path"></data-menu>
    <section class="panel pad">
      <div>
        <h1 class="h1" style="margin-bottom: 4px;">Critical Path</h1>
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
    
    // Filter to critical resources only
    const critical = entries.filter(isCriticalResource);

    if (critical.length === 0) {
      content.innerHTML = '<p class="sub" style="margin:0">No critical path resources identified.</p>';
      return;
    }

    // Find earliest start time
    let earliest = Infinity;
    critical.forEach((e: any) => {
      if (e.startedDateTime) {
        const time = new Date(e.startedDateTime).getTime();
        if (time < earliest) earliest = time;
      }
    });

    // Calculate max duration
    let maxTime = 0;
    critical.forEach((e: any) => {
      const start = e.startedDateTime ? new Date(e.startedDateTime).getTime() - earliest : 0;
      const duration = e.time || 0;
      if (start + duration > maxTime) maxTime = start + duration;
    });

    const scale = Math.max(maxTime, 1000);

    content.innerHTML = `
      <div class="panel pad" style="background: rgba(255,255,255,0.04);">
        <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">Critical Path Waterfall (${critical.length} resources)</h3>
        <div style="overflow-x: auto;">
          <div style="min-width: ${Math.max(scale / 10, 800)}px;">
            ${critical
              .map((entry: any) => {
                const start = entry.startedDateTime
                  ? new Date(entry.startedDateTime).getTime() - earliest
                  : 0;
                const duration = entry.time || 0;
                const url = entry.request?.url || '';
                const method = entry.request?.method || 'GET';
                const status = entry.response?.status || 0;

                return `
                  <div style="display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); min-height: 50px;">
                    <div style="width: 200px; flex-shrink: 0; padding-right: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px;" title="${url}">
                      <div style="font-weight: 500; color: ${getResourceColor(entry)};">${method} ${status}</div>
                      <div style="color: rgba(255,255,255,0.6); overflow: hidden; text-overflow: ellipsis;">${url}</div>
                    </div>
                    <div style="flex: 1; position: relative; height: 30px;">
                      <div style="position: absolute; left: ${(start / scale) * 100}%; width: ${(duration / scale) * 100}%; height: 100%; background: ${getResourceColor(entry)}; opacity: 0.8; border-radius: 2px; border: 2px solid rgba(255,255,255,0.3);"></div>
                      <div style="position: absolute; left: ${(start / scale) * 100}%; top: 0; bottom: 0; display: flex; align-items: center; padding: 0 4px; font-size: 10px; color: rgba(255,255,255,0.9);">${formatMs(duration)}</div>
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
    content.innerHTML = `<p class="sub" style="margin:0">Failed to load critical path: ${e?.message ?? e}</p>`;
  }
}

