import { renderHome } from './pages/home';
import { renderBasic } from './pages/basic';
import { renderAdvanced } from './pages/advanced';
import { renderResults } from './pages/results';
import { renderUpload } from './pages/upload';
import { renderOverview } from './pages/data/overview';
import { renderFilmstrip } from './pages/data/filmstrip';
import { renderMetrics } from './pages/data/metrics';
import { renderConsole } from './pages/data/console';
import { renderResources } from './pages/data/resources';
import { renderWaterfall } from './pages/data/waterfall';
import { renderCriticalPath } from './pages/data/critical-path';
import { renderBottlenecks } from './pages/data/bottlenecks';
import { renderConfig } from './pages/data/config';

type RouteCtx = {
  outlet: HTMLElement;
  topNav: HTMLElement;
};

type RouteMatch = { page: string; params: Record<string, string> };

let ctx: RouteCtx | null = null;

function setActivePage(name: string) {
  ctx?.topNav.setAttribute('active', name);
}

function parsePath(pathname: string): RouteMatch {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/') return { page: 'Home', params: {} };
  if (clean === '/basic') return { page: 'Basic', params: {} };
  if (clean === '/advanced') return { page: 'Advanced', params: {} };
  if (clean === '/results') return { page: 'Results', params: {} };
  if (clean === '/upload') return { page: 'Upload', params: {} };

  const dataPages = [
    'overview',
    'filmstrip',
    'metrics',
    'console',
    'resources',
    'waterfall',
    'critical-path',
    'bottlenecks',
    'config',
  ];
  for (const page of dataPages) {
    const m = clean.match(new RegExp(`^/data/${page}/(.+)$`));
    if (m) return { page: `Data:${page}`, params: { testId: decodeURIComponent(m[1]) } };
  }

  return { page: 'Home', params: {} };
}

export function navigate(to: string) {
  const url = new URL(to, window.location.origin);
  window.history.pushState({}, '', url.pathname + url.search);
  void renderCurrentRoute();
}

function onLinkClick(e: MouseEvent) {
  const t = e.target as HTMLElement | null;
  const a = t?.closest?.('a[data-link]') as HTMLAnchorElement | null;
  if (!a) return;
  if (a.target && a.target !== '_self') return;
  if (a.origin !== window.location.origin) return;
  e.preventDefault();
  navigate(a.getAttribute('href') || '/');
}

async function renderCurrentRoute() {
  if (!ctx) return;
  const { page, params } = parsePath(window.location.pathname);
  setActivePage(page.startsWith('Data:') ? 'Results' : page);
  ctx.outlet.innerHTML = '';

  if (page.startsWith('Data:') && params.testId) {
    const dataPage = page.replace('Data:', '');
    switch (dataPage) {
      case 'overview':
        await renderOverview(ctx.outlet, params.testId);
        return;
      case 'filmstrip':
        await renderFilmstrip(ctx.outlet, params.testId);
        return;
      case 'metrics':
        await renderMetrics(ctx.outlet, params.testId);
        return;
      case 'console':
        await renderConsole(ctx.outlet, params.testId);
        return;
      case 'resources':
        await renderResources(ctx.outlet, params.testId);
        return;
      case 'waterfall':
        await renderWaterfall(ctx.outlet, params.testId);
        return;
      case 'critical-path':
        await renderCriticalPath(ctx.outlet, params.testId);
        return;
      case 'bottlenecks':
        await renderBottlenecks(ctx.outlet, params.testId);
        return;
      case 'config':
        await renderConfig(ctx.outlet, params.testId);
        return;
      default:
        await renderOverview(ctx.outlet, params.testId);
        return;
    }
  }

  switch (page) {
    case 'Home':
      await renderHome(ctx.outlet);
      return;
    case 'Basic':
      await renderBasic(ctx.outlet);
      return;
    case 'Advanced':
      await renderAdvanced(ctx.outlet);
      return;
    case 'Results':
      await renderResults(ctx.outlet);
      return;
    case 'Upload':
      await renderUpload(ctx.outlet);
      return;
    default:
      await renderHome(ctx.outlet);
  }
}

export function initRouter(routeCtx: RouteCtx) {
  ctx = routeCtx;
  document.addEventListener('click', onLinkClick);
  window.addEventListener('popstate', () => void renderCurrentRoute());
  void renderCurrentRoute();
}


