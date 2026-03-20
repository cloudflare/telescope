const btn = document.getElementById('enhance-btn');
const status = document.getElementById('enhance-status');

btn.addEventListener(
  'click',
  function () {
    btn.disabled = true;
    status.textContent = 'Loading…';

    const s = document.createElement('script');
    s.type = 'module';
    s.src = './dist/index.js';
    s.addEventListener('load', function () {
      status.textContent =
        '✓ Web component active — filters and row details now work.';
    });
    s.addEventListener('error', function () {
      btn.disabled = false;
      status.textContent = '✗ Failed to load script.';
    });
    document.head.appendChild(s);
  },
  { once: true },
);
