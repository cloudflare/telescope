import './style.css';
import './components/top-nav';
import './components/test-result';
import './components/data-menu';
import { initRouter, navigate } from './router';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app not found');

app.innerHTML = `
  <div class="app-shell">
    <top-nav id="topnav"></top-nav>
    <main class="page" id="route-outlet"></main>
  </div>
`;

initRouter({
  outlet: document.querySelector<HTMLElement>('#route-outlet')!,
  topNav: document.querySelector<HTMLElement>('#topnav')!,
});

// helpful for local dev from console
// @ts-expect-error attach for debugging
window.__navigate = navigate;
