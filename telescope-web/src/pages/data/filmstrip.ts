import { getResultFilmstrip, getResultVideoInfo, getResultMetrics } from '../../api';

export async function renderFilmstrip(outlet: HTMLElement, testId: string) {
  outlet.innerHTML = `
    <data-menu test-id="${testId}" active="filmstrip"></data-menu>
    <section class="panel pad" style="overflow-x: hidden; max-width: 100%;">
      <div>
        <h1 class="h1" style="margin-bottom: 4px;">Filmstrip & Video</h1>
        <p class="sub" style="margin:0">Test: <code>${testId}</code></p>
      </div>
      <div id="content" style="margin-top: 24px; overflow-x: hidden; max-width: 100%;"></div>
    </section>
  `;

  const content = outlet.querySelector<HTMLElement>('#content');
  if (!content) return;

  try {
    const [filmstrip, videoInfo, metrics] = await Promise.all([
      getResultFilmstrip(testId).catch(() => ({ images: [] })),
      getResultVideoInfo(testId).catch(() => null),
      getResultMetrics(testId).catch(() => null),
    ]);

    content.innerHTML = `
      <!-- Filmstrip Section -->
      <div class="panel pad" style="background: rgba(255,255,255,0.04); margin-bottom: 24px;">
        <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">Filmstrip</h3>
        <div style="overflow-x: auto; overflow-y: hidden; padding: 16px 0; width: 100%; max-width: 100%;">
          <div style="display: flex; gap: 12px; min-width: max-content; width: max-content;">
            ${filmstrip.images.length
              ? filmstrip.images
                  .map(
                    (img, i) => `
              <div style="flex-shrink: 0; text-align: center;">
                <img 
                  src="${img.url}" 
                  alt="${img.name}" 
                  style="max-width: 300px; height: auto; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12);"
                  onerror="this.style.display='none';"
                />
                <div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 8px;">Frame ${i + 1}</div>
              </div>
            `,
                  )
                  .join('')
              : '<p class="sub" style="margin:0">No filmstrip images found.</p>'}
          </div>
        </div>
      </div>

      <!-- Video Section -->
      <div class="panel pad" style="background: rgba(255,255,255,0.04); margin-bottom: 24px;">
        <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">Video</h3>
        ${videoInfo
          ? `
          <video 
            controls 
            style="width: 100%; max-width: 800px; border-radius: 8px;"
            src="${videoInfo.url}"
          >
            Your browser does not support the video tag.
          </video>
        `
          : '<p class="sub" style="margin:0">No video found.</p>'}
      </div>

      <!-- Layout Shifts Section -->
      <div class="panel pad" style="background: rgba(255,255,255,0.04);">
        <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">Layout Shifts</h3>
        ${(metrics?.layoutShifts?.length ?? 0) > 0
          ? `
          <div style="display: grid; gap: 16px;">
            ${metrics.layoutShifts
              .map(
                (shift: any, i: number) => `
              <div style="padding: 16px; background: rgba(255,255,255,0.04); border-radius: 8px;">
                <div style="font-weight: 500; margin-bottom: 12px;">Shift ${i + 1} (CLS: ${shift.value?.toFixed(4) ?? 0})</div>
                <div style="display: grid; gap: 8px;">
                  ${(shift.sources || [])
                    .map(
                      (src: any) => `
                    <div style="position: relative; padding: 8px; background: rgba(255,255,255,0.02); border-radius: 4px;">
                      ${src.previousRect ? `
                        <div style="position: absolute; border: 2px solid #3b82f6; padding: 4px; background: rgba(59,130,246,0.1); border-radius: 4px;"
                             style="left: ${src.previousRect.x}px; top: ${src.previousRect.y}px; width: ${src.previousRect.width}px; height: ${src.previousRect.height}px;">
                          <div style="font-size: 10px; color: #3b82f6;">Old Position</div>
                        </div>
                      ` : ''}
                      ${src.currentRect ? `
                        <div style="position: absolute; border: 2px solid #10b981; padding: 4px; background: rgba(16,185,129,0.1); border-radius: 4px;"
                             style="left: ${src.currentRect.x}px; top: ${src.currentRect.y}px; width: ${src.currentRect.width}px; height: ${src.currentRect.height}px;">
                          <div style="font-size: 10px; color: #10b981;">New Position</div>
                        </div>
                      ` : ''}
                      <div style="font-size: 11px; color: rgba(255,255,255,0.6);">
                        Time: ${(shift.startTime || 0).toFixed(2)}ms
                      </div>
                    </div>
                  `,
                    )
                    .join('')}
                </div>
              </div>
            `,
              )
              .join('')}
          </div>
        `
          : '<p class="sub" style="margin:0">No layout shifts detected.</p>'}
      </div>
    `;
  } catch (e: any) {
    content.innerHTML = `<p class="sub" style="margin:0">Failed to load filmstrip & video: ${e?.message ?? e}</p>`;
  }
}

