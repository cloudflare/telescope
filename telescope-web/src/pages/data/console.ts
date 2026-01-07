import { getResultConsole } from '../../api';

function getConsoleColor(type: string): string {
  switch (type.toLowerCase()) {
    case 'error':
      return '#ef4444';
    case 'warning':
      return '#f59e0b';
    case 'info':
      return '#3b82f6';
    case 'debug':
      return '#6b7280';
    case 'log':
    default:
      return 'rgba(255,255,255,0.7)';
  }
}

export async function renderConsole(outlet: HTMLElement, testId: string) {
  outlet.innerHTML = `
    <data-menu test-id="${testId}" active="console"></data-menu>
    <section class="panel pad">
      <div>
        <h1 class="h1" style="margin-bottom: 4px;">Console</h1>
        <p class="sub" style="margin:0">Test: <code>${testId}</code></p>
      </div>
      <div id="content" style="margin-top: 24px;"></div>
    </section>
  `;

  const content = outlet.querySelector<HTMLElement>('#content');
  if (!content) return;

  try {
    const consoleData = await getResultConsole(testId).catch(() => []);
    const counts = (consoleData || []).reduce(
      (acc: Record<string, number>, msg: any) => {
        const type = (msg.type || 'log').toLowerCase();
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const total = consoleData?.length || 0;

    content.innerHTML = `
      <!-- Message Counts Section -->
      <div class="panel pad" style="background: rgba(255,255,255,0.04); margin-bottom: 24px;">
        <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">Message Summary</h3>
        <div style="display: flex; gap: 24px; flex-wrap: wrap;">
          <div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">Total Messages</div>
            <div style="font-size: 24px; font-weight: 600;">${total}</div>
          </div>
          ${Object.entries(counts)
            .map(
              ([type, count]) => `
            <div>
              <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${getConsoleColor(type)}; margin-right: 6px;"></span>
                ${type.charAt(0).toUpperCase() + type.slice(1)}
              </div>
              <div style="font-size: 24px; font-weight: 600; color: ${getConsoleColor(type)};">${count}</div>
            </div>
          `,
            )
            .join('')}
        </div>
      </div>

      <!-- Messages List Section -->
      <div class="panel pad" style="background: rgba(255,255,255,0.04);">
        <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">Messages</h3>
        ${total > 0
          ? `
          <div style="display: grid; gap: 8px; max-height: 600px; overflow-y: auto;">
            ${consoleData
              .map(
                (msg: any) => {
                  const type = (msg.type || 'log').toLowerCase();
                  const color = getConsoleColor(type);
                  return `
              <div style="padding: 12px; background: rgba(255,255,255,0.02); border-left: 3px solid ${color}; border-radius: 4px;">
                <div style="display: flex; gap: 12px; align-items: start;">
                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${color}; margin-top: 6px; flex-shrink: 0;"></span>
                  <div style="flex: 1;">
                    <div style="display: flex; gap: 12px; margin-bottom: 4px; flex-wrap: wrap;">
                      <span style="font-weight: 500; color: ${color}; text-transform: uppercase; font-size: 11px;">${type}</span>
                      ${msg.location?.url ? `
                        <span style="font-size: 11px; color: rgba(255,255,255,0.5);">
                          ${msg.location.url}${msg.location.lineNumber != null ? `:${msg.location.lineNumber}` : ''}
                        </span>
                      ` : ''}
                    </div>
                    <div style="font-family: monospace; font-size: 13px; white-space: pre-wrap; word-break: break-word;">${String(msg.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                  </div>
                </div>
              </div>
            `;
                },
              )
              .join('')}
          </div>
        `
          : '<p class="sub" style="margin:0">No console messages found.</p>'}
      </div>
    `;
  } catch (e: any) {
    content.innerHTML = `<p class="sub" style="margin:0">Failed to load console: ${e?.message ?? e}</p>`;
  }
}

