const routes = [];
let onChange = null;

export function registerRoute(path, renderer, options = {}) {
  routes.push({ path, renderer, ...options, matcher: compile(path) });
}

export function setRouteChangeHandler(handler) { onChange = handler; }

export function navigate(path) {
  const target = path.startsWith('/') ? path : `/${path}`;
  if (window.location.hash === `#${target}`) renderCurrentRoute();
  else window.location.hash = target;
}

export function currentPath() { return window.location.hash.replace(/^#/, '') || '/'; }

export function renderCurrentRoute() {
  const path = currentPath();
  const match = routes.map(route => ({ route, matched: path.match(route.matcher.regex) })).find(x => x.matched);
  const fallback = routes.find(route => route.path === '/');
  const route = match?.route || fallback;
  if (!route) return;
  const params = {};
  if (match?.matched) route.matcher.keys.forEach((key, index) => { params[key] = decodeURIComponent(match.matched[index + 1]); });
  onChange?.({ path, route, params });
}

export function startRouter() {
  window.addEventListener('hashchange', renderCurrentRoute);
  renderCurrentRoute();
}

function compile(path) {
  const keys = [];
  const pattern = path.split('/').map(part => {
    if (!part) return '';
    if (part.startsWith(':')) { keys.push(part.slice(1)); return '([^/]+)'; }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('/');
  return { keys, regex: new RegExp(`^${pattern || '/'}$`) };
}
