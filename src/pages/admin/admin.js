import { adminStats, adminMembers, adminRequests, adminAgreements, adminActivity } from '../../services/admin-mock-data.js';
import { appMode } from '../../services/supabase.js';
import { listAdminMembers, listAdminRequests, updateAdminRequest, listAdminAgreements, saveAdminAgreement, getAdminDashboardData } from '../../services/admin-repository.js';
import { escapeHtml } from '../../utils/html.js';

let memberRows = adminMembers;
let requestRows = adminRequests;
let agreementRows = adminAgreements;

export function renderAdminDashboard() {
  return `
    ${adminHead('Panel de administración','Resumen operativo de AFUCOA y tareas que requieren atención.')}
    <section id="admin-stat-grid" class="admin-stat-grid">${adminStats.map(statCard).join('')}</section>
    <section class="admin-dashboard-grid">
      <article class="card admin-panel"><div class="admin-panel-head"><div><span class="eyebrow">Prioridad operativa</span><h2>Solicitudes que requieren atención</h2></div><a class="text-button" href="#/admin/tramites">Ver bandeja →</a></div><div id="admin-dashboard-requests">${requestTable(adminRequests.slice(0,4),true)}</div></article>
      <article class="card admin-panel"><div class="admin-panel-head"><div><span class="eyebrow">Actividad</span><h2>Movimientos recientes</h2></div></div><div id="admin-dashboard-activity" class="admin-activity">${adminActivity.map(activityRow).join('')}</div></article>
    </section>
    <section class="admin-quick-grid">
      ${quickAction('＋','Nuevo convenio','Crear y preparar un beneficio para publicación.','#/admin/convenios')}
      ${quickAction('▣','Nueva publicación','Preparar noticia, comunicado o evento.','#/admin/contenido')}
      ${quickAction('◉','Enviar notificación','Definir audiencia y mensaje push.','#/admin/notificaciones')}
      ${quickAction('●','Buscar socio','Acceder a ficha, historial y gestiones.','#/admin/socios')}
    </section>`;
}


export async function bindAdminDashboard() {
  if (appMode === 'demo') return;
  try {
    const data = await getAdminDashboardData();
    const stats = [
      { label:'Socios activos', value:data.activeMembers, delta:'Padrón conectado', tone:'blue' },
      { label:'Solicitudes abiertas', value:data.openRequests, delta:'Requieren seguimiento', tone:'gold' },
      { label:'Propuestas por moderar', value:data.proposalsToModerate, delta:'Pendientes de decisión', tone:'' },
      { label:'Backend', value:'Online', delta:'Supabase conectado', tone:'success' }
    ];
    const grid=document.querySelector('#admin-stat-grid'); if(grid) grid.innerHTML=stats.map(statCard).join('');
    const activity=document.querySelector('#admin-dashboard-activity');
    if(activity) activity.innerHTML=(data.audit.length ? data.audit.map(x=>activityRow({icon:'↻',title:x.action,meta:`${x.actor} · ${x.at}`})).join('') : '<p class="muted">Sin actividad administrativa registrada.</p>');
    const requests=document.querySelector('#admin-dashboard-requests');
    if(requests) requests.innerHTML=requestTable(data.requests.filter(x=>x.status!=='Resuelta'&&x.status!=='Cancelada').slice(0,4),true);
  } catch (error) { console.error(error); showAdminError('No se pudieron cargar las métricas reales.'); }
}

export function renderAdminMembers() {
  return `
    ${adminHead('Socios','Buscá, consultá y gestioná el padrón desde una ficha única.','Nuevo socio')}
    <section class="card admin-toolbar"><label class="search-wrap big"><span>⌕</span><input id="admin-member-search" class="search" placeholder="Nombre, cédula, ficha, correo o sector"></label><select id="admin-member-status" class="admin-select"><option>Todos los estados</option><option>Activo</option><option>Pendiente</option><option>Inactivo</option></select></section>
    <section class="card admin-panel"><div class="admin-panel-head"><div><span class="eyebrow">Padrón</span><h2 id="member-count">${memberRows.length} registros</h2></div><button class="button secondary">Exportar</button></div><div id="admin-member-table">${memberTable(memberRows)}</div></section>
    <dialog class="modal-card admin-member-modal" id="member-modal"><div id="member-modal-content"></div></dialog>`;
}

export async function bindAdminMembers() {
  const search = document.querySelector('#admin-member-search');
  const status = document.querySelector('#admin-member-status');
  const root = document.querySelector('#admin-member-table');
  const modal = document.querySelector('#member-modal');
  try { memberRows = await listAdminMembers(); } catch (error) { console.error(error); showAdminError('No se pudo cargar el padrón.'); }
  const apply = () => {
    const q=(search?.value||'').toLocaleLowerCase('es'); const state=status?.value||'Todos los estados';
    const filtered=memberRows.filter(m=>(state==='Todos los estados'||m.status===state)&&`${m.name} ${m.memberNumber} ${m.document} ${m.email} ${m.sector}`.toLocaleLowerCase('es').includes(q));
    root.innerHTML=memberTable(filtered); document.querySelector('#member-count').textContent=`${filtered.length} registros`;
  };
  apply(); search?.addEventListener('input',apply); status?.addEventListener('change',apply);
  root?.addEventListener('click',e=>{ const button=e.target.closest('[data-member]'); if(!button)return; const m=memberRows.find(x=>x.id===button.dataset.member); if(!m)return; modal.querySelector('#member-modal-content').innerHTML=memberDetail(m); modal.showModal(); });
  modal?.addEventListener('click',e=>{ if(e.target.closest('[data-close-modal]') || e.target===modal) modal.close(); });
}


export function renderAdminRequests() {
  return `
    ${adminHead('Trámites','Bandeja operativa para asignar, revisar y resolver solicitudes.')}
    <section class="admin-filter-strip">${['Todas','Requiere información','Recibida','En revisión','En gestión','Resuelta'].map((x,i)=>`<button class="chip ${i===0?'active':''}" data-request-filter="${x}">${x}</button>`).join('')}</section>
    <section class="card admin-panel"><div class="admin-panel-head"><div><span class="eyebrow">Bandeja</span><h2 id="request-count">${requestRows.length} solicitudes</h2></div><div class="button-row"><button class="button secondary">Asignación masiva</button><button class="button secondary">Exportar</button></div></div><div id="admin-request-table">${requestTable(requestRows)}</div></section>`;
}

export async function bindAdminRequests() {
  const buttons=document.querySelectorAll('[data-request-filter]'); const root=document.querySelector('#admin-request-table');
  try { requestRows = await listAdminRequests(); } catch (error) { console.error(error); showAdminError('No se pudo cargar la bandeja de trámites.'); }
  let active='Todas';
  const paint=()=>{ const rows=active==='Todas'?requestRows:requestRows.filter(x=>x.status===active); root.innerHTML=requestTable(rows); document.querySelector('#request-count').textContent=`${rows.length} solicitudes`; };
  paint();
  buttons.forEach(btn=>btn.addEventListener('click',()=>{ buttons.forEach(x=>x.classList.toggle('active',x===btn)); active=btn.dataset.requestFilter; paint(); }));
  root?.addEventListener('click', async e=>{
    const action=e.target.closest('[data-request-action]'); if(!action)return;
    const row=requestRows.find(x=>(x.dbId||x.id)===action.dataset.requestAction); if(!row)return;
    const next=window.prompt('Nuevo estado: recibida, en_revision, requiere_informacion, en_gestion, resuelta o cancelada', statusToDb(row.status));
    if(!next)return; const note=window.prompt('Nota visible para el socio (opcional)','') || '';
    try { await updateAdminRequest(row.dbId||row.id,{status:next,note}); requestRows=await listAdminRequests(); paint(); }
    catch(error){ console.error(error); showAdminError('No se pudo actualizar el expediente.'); }
  });
}


export function renderAdminAgreements() {
  return `
    ${adminHead('Convenios','Creá y administrá beneficios sin editar código.','Nuevo convenio')}
    <section class="admin-agreement-layout">
      <article class="card admin-panel"><div class="admin-panel-head"><div><span class="eyebrow">Catálogo</span><h2>Convenios</h2></div><label class="search-wrap compact-search"><span>⌕</span><input id="admin-agreement-search" class="search" placeholder="Buscar convenio"></label></div><div id="admin-agreement-list" class="admin-agreement-list">${agreementRows.map(agreementAdminCard).join('')}</div></article>
      <aside class="card admin-editor"><span class="eyebrow">Editor visual</span><h2>Nuevo convenio</h2><p class="muted">Vista de desarrollo. Al conectar Supabase este formulario creará borradores reales.</p>${agreementForm()}</aside>
    </section>`;
}

export async function bindAdminAgreements() {
  const input=document.querySelector('#admin-agreement-search'); const root=document.querySelector('#admin-agreement-list');
  try { agreementRows = await listAdminAgreements(); } catch (error) { console.error(error); showAdminError('No se pudieron cargar los convenios.'); }
  const paint=()=>{ const q=(input?.value||'').toLocaleLowerCase('es'); root.innerHTML=agreementRows.filter(x=>`${x.name} ${x.category} ${x.benefit}`.toLocaleLowerCase('es').includes(q)).map(agreementAdminCard).join(''); };
  paint(); input?.addEventListener('input',paint);
  document.querySelector('#agreement-admin-form')?.addEventListener('submit',async e=>{
    e.preventDefault(); const form=e.currentTarget; const data=new FormData(form);
    try {
      await saveAdminAgreement({ name:data.get('name'), category:data.get('category'), short_benefit:data.get('benefit'), description:data.get('description')||null, conditions:data.get('conditions')||null, access_action:data.get('action'), status:data.get('status') });
      agreementRows=await listAdminAgreements(); paint(); form.reset(); showSaveNote('#agreement-save-note', appMode==='demo'?'Borrador simulado guardado.':'Convenio guardado en Supabase.');
    } catch(error){ console.error(error); showAdminError('No se pudo guardar el convenio.'); }
  });
}


export function renderAdminPlaceholder(section) {
  const definitions={
    contenido:['Contenido','Editor de noticias, comunicados, agenda y publicaciones programadas.'],
    documentos:['Documentos','Biblioteca, versiones, vigencia y archivo institucional.'],
    propuestas:['Propuestas','Moderación, publicación, cierre y respuesta institucional.'],
    notificaciones:['Notificaciones','Mensajes segmentados por audiencia y canal.'],
    auditoria:['Auditoría','Registro de acciones administrativas sensibles y trazabilidad.'],
    configuracion:['Configuración','Roles, categorías, parámetros y opciones generales.']
  };
  const [title,copy]=definitions[section]||['Administración','Módulo administrativo'];
  return `${adminHead(title,copy)}<section class="card coming-soon admin-coming"><span class="eyebrow">Incremento 06</span><h2>Estructura preparada</h2><p class="muted">Este módulo ya tiene su ruta y navegación reservadas. Su editor funcional se incorpora en la siguiente etapa.</p></section>`;
}

function adminHead(title,copy,action='') { return `<div class="module-head admin-module-head"><div><span class="eyebrow">Administración AFUCOA</span><h1>${title}</h1><p>${copy}</p></div>${action?`<button class="button primary">＋ ${action}</button>`:''}</div>`; }
function statCard(x){return `<article class="card admin-stat ${x.tone}"><span>${x.label}</span><strong>${x.value}</strong><small>${x.delta}</small></article>`;}
function activityRow(x){return `<div class="admin-activity-row"><span>${x.icon}</span><div><strong>${x.title}</strong><small>${x.meta}</small></div></div>`;}
function quickAction(icon,title,copy,href){return `<a class="card admin-quick" href="${href}"><span>${icon}</span><div><strong>${title}</strong><small>${copy}</small></div><b>→</b></a>`;}

function memberTable(rows){
  if(!rows.length)return `<div class="empty-state"><h3>No hay resultados</h3><p>Probá con otros criterios.</p></div>`;
  return `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Socio</th><th>Ficha</th><th>Sector</th><th>Estado</th><th>Solicitudes</th><th></th></tr></thead><tbody>${rows.map(m=>`<tr><td><strong>${escapeHtml(m.name)}</strong><small>${escapeHtml(m.email)}</small></td><td>${escapeHtml(m.memberNumber)}</td><td>${escapeHtml(m.sector)}</td><td>${statusPill(m.status)}</td><td>${m.requests}</td><td><button class="text-button" data-member="${m.id}">Ver ficha</button></td></tr>`).join('')}</tbody></table></div>`;
}
function memberDetail(m){return `<div class="modal-head"><div><span class="eyebrow">Ficha de socio</span><h2>${m.name}</h2></div><button class="icon-button" data-close-modal>×</button></div><div class="admin-member-summary"><div class="profile-avatar">${m.name.split(' ').slice(0,2).map(x=>x[0]).join('')}</div><div><strong>Ficha Nº ${m.memberNumber}</strong><p>${statusPill(m.status)}</p></div></div><dl class="account-data"><div><dt>Cédula</dt><dd>${m.document}</dd></div><div><dt>Correo</dt><dd>${m.email}</dd></div><div><dt>Sector</dt><dd>${m.sector}</dd></div><div><dt>Afiliación</dt><dd>${m.joined}</dd></div><div><dt>Solicitudes activas</dt><dd>${m.requests}</dd></div></dl><div class="button-row"><button class="button primary">Abrir historial</button><button class="button secondary">Editar datos</button></div>`;}

function requestTable(rows,compact=false){
  if(!rows.length)return `<div class="empty-state"><h3>No hay solicitudes</h3></div>`;
  return `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Expediente</th><th>Socio</th>${compact?'':'<th>Trámite</th>'}<th>Estado</th>${compact?'':'<th>Responsable</th>'}<th>Actualización</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${r.id}</strong></td><td>${r.member}</td>${compact?'':`<td>${r.type}</td>`}<td>${requestPill(r.status)}</td>${compact?'':`<td>${r.assignee}</td>`}<td><small>${r.updated}</small></td><td><button class="text-button" data-request-action="${r.dbId||r.id}">Gestionar</button></td></tr>`).join('')}</tbody></table></div>`;
}
function agreementAdminCard(a){return `<div class="admin-agreement-row"><div class="agreement-admin-icon">%</div><div><div class="document-meta"><span class="category-tag">${a.category}</span>${statusPill(a.status)}</div><h3>${escapeHtml(a.name)}</h3><p>${escapeHtml(a.benefit)} · ${escapeHtml(a.action)}</p><small>${escapeHtml(a.validity)}</small></div><button class="button secondary">Editar</button></div>`;}
function agreementForm(){return `<form id="agreement-admin-form" class="admin-form"><label class="field">Nombre<input name="name" required placeholder="Nombre del comercio o institución"></label><div class="admin-form-two"><label class="field">Categoría<select name="category"><option>Salud</option><option>Gastronomía</option><option>Turismo</option><option>Educación</option><option>Compras</option><option>Servicios</option></select></label><label class="field">Beneficio<input name="benefit" required placeholder="Ej. 20% OFF"></label></div><label class="field">Descripción<textarea name="description" placeholder="Resumen claro para el socio"></textarea></label><label class="field">Condiciones<textarea name="conditions" placeholder="Condiciones, exclusiones y vigencia"></textarea></label><div class="admin-form-two"><label class="field">Acción<select name="action"><option value="carnet">Mostrar carné</option><option value="tramite">Iniciar trámite</option><option value="sitio">Ir al sitio</option><option value="contacto">Contactar</option></select></label><label class="field">Estado<select name="status"><option value="borrador">Borrador</option><option value="publicado">Publicado</option></select></label></div><label class="file-field field"><input type="file"><span>＋ Subir imagen o logo</span><small>La imagen seguirá usando Storage en el próximo refinamiento del editor.</small></label><button class="button primary full">Guardar convenio</button><div id="agreement-save-note" class="admin-save-note" hidden></div></form>`;}
function statusPill(state){ const cls=state==='Activo'||state==='Publicado'?'success-soft':state==='Pendiente'||state==='Borrador'?'gold':''; return `<span class="pill ${cls}">${state}</span>`; }
function requestPill(state){ const cls=state==='Resuelta'?'success-soft':state==='Requiere información'?'gold':state==='En revisión'?'blue-soft':''; return `<span class="pill ${cls}">${state}</span>`; }

function showAdminError(message){ const host=document.querySelector('.admin-main') || document.querySelector('main') || document.body; const n=document.createElement('div'); n.className='admin-save-note admin-error-note'; n.textContent=message; host.prepend(n); setTimeout(()=>n.remove(),5000); }
function showSaveNote(selector,message){ const note=document.querySelector(selector); if(!note)return; note.textContent=message; note.hidden=false; setTimeout(()=>note.hidden=true,3000); }
function statusToDb(status){ return ({'Recibida':'recibida','En revisión':'en_revision','Requiere información':'requiere_informacion','En gestión':'en_gestion','Resuelta':'resuelta','Cancelada':'cancelada'})[status] || status; }
