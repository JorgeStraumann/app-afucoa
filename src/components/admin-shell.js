import { getSession, getAppMode } from '../store/session.js';
import { escapeHtml, initials } from '../utils/html.js';

const navItems = [
  ['/admin','Dashboard'], ['/admin/socios','Socios'], ['/admin/tramites','Trámites'], ['/admin/convenios','Convenios'],
  ['/admin/contenido','Contenido'], ['/admin/documentos','Documentos'], ['/admin/propuestas','Propuestas'],
  ['/admin/notificaciones','Notificaciones'], ['/admin/auditoria','Auditoría'], ['/admin/configuracion','Configuración']
];

export function adminShell(content, activePath = '/admin') {
  const profile = getSession()?.profile || {};
  const mode = getAppMode();
  const name = `${profile.first_name || 'Administrador'} ${profile.last_name || ''}`.trim();
  const role = profile.role === 'superadmin' ? 'Superadministrador' : 'Administrador';
  const banner = mode === 'supabase'
    ? '<strong>Supabase conectado.</strong> Las rutas administrativas ya exigen rol. Revisá siempre RLS antes de habilitar operaciones productivas.'
    : '<strong>Modo desarrollo.</strong> Las acciones de esta interfaz continúan usando datos de demostración.';

  return `
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <a class="brand admin-brand" href="#/admin"><div class="brand-mark">A</div><div><strong>AFUCOA</strong><small>Administración V2</small></div></a>
      <nav class="nav-list admin-nav">${navItems.map(([path,label])=>`<a class="nav-item ${isActive(activePath,path)?'active':''}" href="#${path}">${icon(path)}<span>${label}</span></a>`).join('')}</nav>
      <div class="sidebar-foot"><a href="#/">← Portal del socio</a><small>AFUCOA V2</small></div>
    </aside>
    <main class="admin-main">
      <div class="admin-page">
        <header class="admin-topbar">
          <button class="admin-menu" id="admin-menu" aria-label="Abrir menú">☰</button>
          <label class="search-wrap admin-search"><span aria-hidden="true">⌕</span><input class="search" placeholder="Buscar socios, solicitudes o contenido" aria-label="Buscar en administración"></label>
          <div class="admin-user"><div><strong>${escapeHtml(name)}</strong><small>${role}</small></div><span class="avatar">${initials(profile.first_name || 'A', profile.last_name || 'D')}</span></div>
        </header>
        <div class="admin-demo-banner">${banner}</div>
        ${content}
      </div>
    </main>
    <div class="admin-scrim" id="admin-scrim"></div>
  </div>`;
}

export function bindAdminShell() {
  const shell = document.querySelector('.admin-shell');
  const menu = document.querySelector('#admin-menu');
  const scrim = document.querySelector('#admin-scrim');
  const toggle = (open) => shell?.classList.toggle('menu-open', open);
  menu?.addEventListener('click',()=>toggle(!shell.classList.contains('menu-open')));
  scrim?.addEventListener('click',()=>toggle(false));
  document.querySelector('.admin-sidebar')?.addEventListener('click',e=>{ if(e.target.closest('a')) toggle(false); });
}

function isActive(active,path) { if (path === '/admin') return active === '/admin'; return active.startsWith(path); }
function icon(path) { return ({'/admin':'▦','/admin/socios':'●','/admin/tramites':'▤','/admin/convenios':'%','/admin/contenido':'▣','/admin/documentos':'▥','/admin/propuestas':'◇','/admin/notificaciones':'◉','/admin/auditoria':'≡','/admin/configuracion':'⚙'})[path] || '•'; }
