import { getResultResources } from '../../api';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function elideUrl(url: string, maxLen: number = 64): string {
  if (url.length <= maxLen) return url;
  return '...' + url.slice(-(maxLen - 3));
}

function getResourceType(resource: any): string {
  if (resource.name) {
    const url = resource.name;
    if (/\.(js|mjs)$/i.test(url)) return 'JavaScript';
    if (/\.(css)$/i.test(url)) return 'CSS';
    if (/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(url)) return 'Image';
    if (/\.(woff|woff2|ttf|otf)$/i.test(url)) return 'Font';
    if (/\.(mp4|webm|mp3|wav)$/i.test(url)) return 'Media';
    if (/\.(html)$/i.test(url)) return 'HTML';
    if (/\.(json)$/i.test(url)) return 'JSON';
  }
  return resource.initiatorType || 'Other';
}

export async function renderResources(outlet: HTMLElement, testId: string) {
  outlet.innerHTML = `
    <data-menu test-id="${testId}" active="resources"></data-menu>
    <section class="panel pad">
      <div>
        <h1 class="h1" style="margin-bottom: 4px;">Resources</h1>
        <p class="sub" style="margin:0">Test: <code>${testId}</code></p>
      </div>
      <div id="content" style="margin-top: 24px;"></div>
    </section>
  `;

  const content = outlet.querySelector<HTMLElement>('#content');
  if (!content) return;

  try {
    const resourcesData = await getResultResources(testId).catch(() => null as any);
    const resources = resourcesData?.resourceTimings || [];

    let totalResources = resources.length;
    let totalBlocking = 0;
    let totalTransfer = 0;
    let totalDecoded = 0;

    resources.forEach((r: any) => {
      if (r.renderBlockingStatus === 'blocking') totalBlocking++;
      totalTransfer += r.transferSize || 0;
      totalDecoded += r.decodedBodySize || 0;
    });

    content.innerHTML = `
      <!-- Summary Section -->
      <div class="panel pad" style="background: rgba(255,255,255,0.04); margin-bottom: 24px;">
        <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">Summary</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;" id="summary-metrics"></div>
      </div>

      <!-- Resources List Section -->
      <div class="panel pad" style="background: rgba(255,255,255,0.04);">
        <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">Resources</h3>
        ${totalResources > 0
          ? `
          <div style="display: grid; gap: 4px;">
            ${resources
              .map(
                (r: any, i: number) => {
                  const url = r.name || '';
                  const type = getResourceType(r);
                  const size = r.transferSize || 0;
                  const duration = r.duration || 0;
                  const isExpanded = `expanded-${i}`;

                  return `
              <div style="border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
                <div 
                  onclick="this.parentElement.querySelector('#${isExpanded}').style.display = this.parentElement.querySelector('#${isExpanded}').style.display === 'none' ? 'block' : 'none';"
                  style="padding: 12px; cursor: pointer; background: rgba(255,255,255,0.02); display: flex; gap: 16px; align-items: center; flex-wrap: wrap;"
                  onmouseover="this.style.background='rgba(255,255,255,0.05)'"
                  onmouseout="this.style.background='rgba(255,255,255,0.02)'"
                >
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 500; margin-bottom: 4px; word-break: break-all;">${elideUrl(url, 64)}</div>
                    <div style="font-size: 12px; color: rgba(255,255,255,0.6); display: flex; gap: 16px; flex-wrap: wrap;">
                      <span>Type: ${type}</span>
                      <span>Size: ${formatBytes(size)}</span>
                      <span>Duration: ${duration.toFixed(2)}ms</span>
                    </div>
                  </div>
                  <div style="font-size: 12px; color: rgba(255,255,255,0.4);">▼</div>
                </div>
                <div id="${isExpanded}" style="display: none; padding: 12px; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.1);">
                  <dl style="display: grid; gap: 8px; font-size: 13px;">
                    <div>
                      <dt style="font-weight: 500; margin-bottom: 4px;">Full URL</dt>
                      <dd style="margin: 0; word-break: break-all; color: rgba(255,255,255,0.7);"><a href="${url}" target="_blank" style="color: rgba(125,211,252,0.92);">${url}</a></dd>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                      <div>
                        <dt style="font-weight: 500; margin-bottom: 4px;">Duration</dt>
                        <dd style="margin: 0; color: rgba(255,255,255,0.7);">${duration.toFixed(2)}ms</dd>
                      </div>
                      <div>
                        <dt style="font-weight: 500; margin-bottom: 4px;">Start Time</dt>
                        <dd style="margin: 0; color: rgba(255,255,255,0.7);">${(r.startTime || 0).toFixed(2)}ms</dd>
                      </div>
                      <div>
                        <dt style="font-weight: 500; margin-bottom: 4px;">Protocol</dt>
                        <dd style="margin: 0; color: rgba(255,255,255,0.7);">${r.nextHopProtocol || 'N/A'}</dd>
                      </div>
                      <div>
                        <dt style="font-weight: 500; margin-bottom: 4px;">Transfer Size</dt>
                        <dd style="margin: 0; color: rgba(255,255,255,0.7);">${formatBytes(size)}</dd>
                      </div>
                      <div>
                        <dt style="font-weight: 500; margin-bottom: 4px;">Decoded Size</dt>
                        <dd style="margin: 0; color: rgba(255,255,255,0.7);">${formatBytes(r.decodedBodySize || 0)}</dd>
                      </div>
                    </div>
                  </dl>
                </div>
              </div>
            `;
                },
              )
              .join('')}
          </div>
        `
          : '<p class="sub" style="margin:0">No resources found.</p>'}
      </div>
    `;

    // Populate summary metrics
    const summaryContainer = content.querySelector<HTMLElement>('#summary-metrics');
    if (summaryContainer) {
      const totalResEl = document.createElement('metric-item');
      totalResEl.setAttribute('label', 'Total Resources');
      totalResEl.setAttribute('value', String(totalResources));
      totalResEl.setAttribute('size', 'large');
      summaryContainer.appendChild(totalResEl);

      const totalBlockingEl = document.createElement('metric-item');
      totalBlockingEl.setAttribute('label', 'Total Blocking Resources');
      totalBlockingEl.setAttribute('value', String(totalBlocking));
      totalBlockingEl.setAttribute('size', 'large');
      summaryContainer.appendChild(totalBlockingEl);

      const transferEl = document.createElement('metric-item');
      transferEl.setAttribute('label', 'Total Transfer Size');
      transferEl.setAttribute('value', formatBytes(totalTransfer));
      transferEl.setAttribute('size', 'large');
      summaryContainer.appendChild(transferEl);

      const decodedEl = document.createElement('metric-item');
      decodedEl.setAttribute('label', 'Total Decoded Size');
      decodedEl.setAttribute('value', formatBytes(totalDecoded));
      decodedEl.setAttribute('size', 'large');
      summaryContainer.appendChild(decodedEl);
    }
  } catch (e: any) {
    content.innerHTML = `<p class="sub" style="margin:0">Failed to load resources: ${e?.message ?? e}</p>`;
  }
}

