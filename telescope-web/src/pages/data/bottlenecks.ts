import { getResultHar, getResultResources } from '../../api';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatMs(ms: number): string {
  return `${ms.toFixed(2)}ms`;
}

export async function renderBottlenecks(outlet: HTMLElement, testId: string) {
  outlet.innerHTML = `
    <data-menu test-id="${testId}" active="bottlenecks"></data-menu>
    <section class="panel pad">
      <div>
        <h1 class="h1" style="margin-bottom: 4px;">Bottlenecks</h1>
        <p class="sub" style="margin:0">Test: <code>${testId}</code></p>
      </div>
      <div id="content" style="margin-top: 24px;"></div>
    </section>
  `;

  const content = outlet.querySelector<HTMLElement>('#content');
  if (!content) return;

  try {
    const [har, resources] = await Promise.all([
      getResultHar(testId).catch(() => null as any),
      getResultResources(testId).catch(() => null as any),
    ]);

    const entries = har?.log?.entries || [];
    const resourceTimings = resources?.resourceTimings || [];

    // Top 5 longest requests
    const longest = [...entries]
      .sort((a: any, b: any) => (b.time || 0) - (a.time || 0))
      .slice(0, 5);

    // Top 5 largest requests
    const largest = [...entries]
      .sort(
        (a: any, b: any) =>
          (b.response?.content?.size || 0) - (a.response?.content?.size || 0),
      )
      .slice(0, 5);

    // Blocking resources
    const blocking = resourceTimings.filter((r: any) => r.renderBlockingStatus === 'blocking');

    // File types analysis
    const fileTypes: Record<string, { count: number; compressed: number; uncompressed: number }> =
      {};
    entries.forEach((e: any) => {
      const mime = (e.response?.content?.mimeType || 'other').split(';')[0].trim();
      const size = e.response?.content?.size || 0;
      const compressed = e.response?.content?.compression || 0;
      if (!fileTypes[mime]) {
        fileTypes[mime] = { count: 0, compressed: 0, uncompressed: 0 };
      }
      fileTypes[mime].count++;
      fileTypes[mime].compressed += size;
      fileTypes[mime].uncompressed += size + compressed;
    });

    // HTTP version analysis
    const httpVersions: Record<string, number> = {};
    entries.forEach((e: any) => {
      const version = e.request?.httpVersion || 'unknown';
      httpVersions[version] = (httpVersions[version] || 0) + 1;
    });

    content.innerHTML = `
      <!-- Top 5 Longest Requests -->
      <div class="panel pad" style="background: rgba(255,255,255,0.04); margin-bottom: 24px;">
        <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">Top 5 Longest Requests</h3>
        ${longest.length > 0
          ? `
          <div style="display: grid; gap: 8px;">
            ${longest.map(
              (e: any, i: number) => `
              <div style="padding: 12px; background: rgba(255,255,255,0.02); border-radius: 4px;">
                <div style="font-weight: 500; margin-bottom: 4px;">${i + 1}. ${e.request?.url || 'N/A'}</div>
                <div style="font-size: 12px; color: rgba(255,255,255,0.6);">Duration: ${formatMs(e.time || 0)}</div>
              </div>
            `,
            )}
          </div>
        `
          : '<p class="sub" style="margin:0">No data available.</p>'}
      </div>

      <!-- Top 5 Largest Requests -->
      <div class="panel pad" style="background: rgba(255,255,255,0.04); margin-bottom: 24px;">
        <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">Top 5 Largest Requests</h3>
        ${largest.length > 0
          ? `
          <div style="display: grid; gap: 8px;">
            ${largest.map(
              (e: any, i: number) => `
              <div style="padding: 12px; background: rgba(255,255,255,0.02); border-radius: 4px;">
                <div style="font-weight: 500; margin-bottom: 4px;">${i + 1}. ${e.request?.url || 'N/A'}</div>
                <div style="font-size: 12px; color: rgba(255,255,255,0.6);">Size: ${formatBytes(e.response?.content?.size || 0)}</div>
              </div>
            `,
            )}
          </div>
        `
          : '<p class="sub" style="margin:0">No data available.</p>'}
      </div>

      <!-- Blocking Resources -->
      <div class="panel pad" style="background: rgba(255,255,255,0.04); margin-bottom: 24px;">
        <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">Blocking Resources (${blocking.length})</h3>
        ${blocking.length > 0
          ? `
          <div style="display: grid; gap: 8px;">
            ${blocking.map(
              (r: any) => `
              <div style="padding: 12px; background: rgba(255,255,255,0.02); border-radius: 4px;">
                <div style="font-weight: 500; margin-bottom: 4px; word-break: break-all;">${r.name || 'N/A'}</div>
                <div style="font-size: 12px; color: rgba(255,255,255,0.6);">Type: ${r.initiatorType || 'N/A'}</div>
              </div>
            `,
            )}
          </div>
        `
          : '<p class="sub" style="margin:0">No blocking resources found.</p>'}
      </div>

      <!-- File Types Pie Chart -->
      <div class="panel pad" style="background: rgba(255,255,255,0.04); margin-bottom: 24px;">
        <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">File Types</h3>
        <div style="display: grid; gap: 8px;">
          ${Object.entries(fileTypes)
            .map(
              ([type, data]) => `
            <div style="padding: 12px; background: rgba(255,255,255,0.02); border-radius: 4px;">
              <div style="font-weight: 500; margin-bottom: 4px;">${type}</div>
              <div style="font-size: 12px; color: rgba(255,255,255,0.6);">
                Count: ${data.count} | Compressed: ${formatBytes(data.compressed)} | Uncompressed: ${formatBytes(data.uncompressed)}
              </div>
            </div>
          `,
            )
            .join('')}
        </div>
      </div>

      <!-- HTTP Versions -->
      <div class="panel pad" style="background: rgba(255,255,255,0.04);">
        <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">HTTP Versions</h3>
        <div style="display: grid; gap: 8px;">
          ${Object.entries(httpVersions)
            .map(
              ([version, count]) => `
            <div style="padding: 12px; background: rgba(255,255,255,0.02); border-radius: 4px;">
              <div style="font-weight: 500; margin-bottom: 4px;">HTTP/${version}</div>
              <div style="font-size: 12px; color: rgba(255,255,255,0.6);">Count: ${count}</div>
            </div>
          `,
            )
            .join('')}
        </div>
      </div>
    `;
  } catch (e: any) {
    content.innerHTML = `<p class="sub" style="margin:0">Failed to load bottlenecks: ${e?.message ?? e}</p>`;
  }
}

