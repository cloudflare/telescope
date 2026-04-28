const wf = document.getElementById('wf');
const harTitle = document.getElementById('har-title');

function setHarTitle(har) {
  try {
    const firstUrl = har.log.entries?.[0]?.request?.url;
    const domain = firstUrl ? new URL(firstUrl).hostname : null;
    harTitle.textContent = domain ?? 'Example';
  } catch {
    harTitle.textContent = 'Example';
  }
}

// ── Reset to example ───────────────────────────────────────────────────────
// Reload the page to restore the pre-rendered static HTML.
document.getElementById('reset-btn').addEventListener('click', () => {
  harTitle.textContent = 'Example';
  location.reload();
});

// ── Local file picker ──────────────────────────────────────────────────────
document.getElementById('har-file').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    try {
      const har = JSON.parse(reader.result);
      wf.har = har;
      setHarTitle(har);
    } catch {
      alert('Could not parse HAR file — make sure it is valid JSON.');
    }
  });
  reader.readAsText(file);
  e.target.value = ''; // allow re-picking the same file
});
