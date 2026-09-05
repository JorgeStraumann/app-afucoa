import { getSession } from '../store/session.js';
import { initials } from '../utils/html.js';

const navItems = [
  ['/', 'Inicio'], ['/carnet', 'Mi carné'], ['/convenios', 'Convenios'], ['/tramites', 'Trámites'],
  ['/noticias', 'Noticias y Agenda'], ['/documentos', 'Documentos'], ['/propuestas', 'Propuestas'],
  ['/notificaciones', 'Notificaciones'], ['/cuenta', 'Mi cuenta']
];

export function shell(content, activePath = '/') {
  const profile = getSession()?.profile || {};
  const showAdmin = ['admin','superadmin'].includes(profile.role);
  const visibleItems = showAdmin ? [...navItems, ['/admin','Administración']] : navItems;
  const avatar = initials(profile.first_name || 'Jorge', profile.last_name || 'Carrara');
  return `
  <div class="app-shell">
    <aside class="sidebar">
      <a class="brand" href="#/"><div class="brand-mark">A</div><div><strong>AFUCOA</strong><small>Portal del socio</small></div></a>
      <nav class="nav-list">${visibleItems.map(([path,item])=>`<a class="nav-item ${isActive(activePath,path)?'active':''}" href="#${path}">${item}</a>`).join('')}</nav>
      <div class="sidebar-foot"><span>AFUCOA V2</span><small>Portal institucional</small></div>
    </aside>
    <main class="main">
      <div class="page">
        <header class="topbar">
          <label class="search-wrap"><span aria-hidden="true">⌕</span><input class="search" placeholder="Buscar en AFUCOA" aria-label="Buscar en AFUCOA"></label>
          ${showAdmin?'<a class="button secondary admin-entry" href="#/admin">Administración</a>':''}<a class="avatar" href="#/cuenta" aria-label="Mi cuenta">${avatar}</a>
        </header>
        ${content}
      </div>
    </main>
    <nav class="bottom-nav" aria-label="Navegación principal">
      ${[['/','Inicio'],['/convenios','Convenios'],['/tramites','Trámites'],['/notificaciones','Alertas'],['/cuenta','Cuenta']].map(([path,label])=>`<a class="${isActive(activePath,path)?'active':''}" href="#${path}"><span>${bottomIcon(path)}</span><small>${label}</small></a>`).join('')}
    </nav>
  </div>`;
}

function isActive(active, path) { return path === '/' ? active === '/' : active.startsWith(path); }
function bottomIcon(path) { return ({'/':'⌂','/convenios':'%','/tramites':'▤','/notificaciones':'◉','/cuenta':'●'})[path] || '•'; }
