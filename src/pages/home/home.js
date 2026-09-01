import { getSession } from '../../store/session.js';
import { escapeHtml } from '../../utils/html.js';

export function renderHome() {
  const profile = getSession()?.profile || {};
  const firstName = escapeHtml(profile.first_name || 'Jorge');
  const memberNumber = escapeHtml(profile.member_number || '1925');
  const active = profile.status === 'activo' || !profile.status;
  const status = active ? 'Socio activo' : `Estado: ${escapeHtml(profile.status)}`;

  return `<section class="hero"><small>Portal del socio</small><h1>Buenas tardes, ${firstName}</h1><div class="hero-meta"><span class="status">${status}</span><span>Ficha ${memberNumber}</span></div></section><section class="section"><div class="section-head"><h2>Acciones rápidas</h2></div><div class="grid cards">${quickCard('▣','Mi carné','Mostrá tu QR de afiliación','/carnet')}${quickCard('+','Iniciar trámite','Gestioná una solicitud','/tramites')}${quickCard('%','Convenios','Encontrá beneficios','/convenios')}${quickCard('≡','Documentos','Accedé a la biblioteca','/documentos')}</div></section><section class="section grid dashboard"><div><div class="section-head"><h2>Para vos</h2></div><article class="card notice"><span class="eyebrow">Agenda</span><h3>Próxima Asamblea General</h3><p>Miércoles 9 de septiembre · 13:00. Consultá la información y documentación asociada.</p><div class="card-actions"><button class="button secondary">Ver información</button></div></article><div class="section-head subsection"><h2>Novedades</h2></div><article class="card"><span class="pill new">Nuevo</span><h3>Nuevos beneficios para socios</h3><p>Se incorporaron convenios recientes. Revisá condiciones y formas de acceso.</p><div class="card-actions"><a class="button secondary" href="#/convenios">Ver convenios</a></div></article></div><div><div class="section-head"><h2>Mis solicitudes</h2></div><article class="card"><span class="pill info">En revisión</span><h3>Constancia de afiliación</h3><p>AF-2026-00418 · Actualizada hoy</p><div class="card-actions"><a class="button primary" href="#/tramites">Ver seguimiento</a></div></article></div></section>`;
}
function quickCard(icon,title,text,path){return `<a class="card quick" href="#${path}"><div class="quick-icon">${icon}</div><div><h3>${title}</h3><p>${text}</p></div></a>`}
