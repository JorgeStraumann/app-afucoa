import { adminContent, adminDocuments, adminProposals, adminNotifications, auditEvents, adminSettings } from '../../services/admin-content-mock-data.js';
import { appMode } from '../../services/supabase.js';
import { listAdminContent, saveAdminContent, listAdminProposals, moderateProposal, listAuditEvents } from '../../services/admin-repository.js';

let contentRowsState = adminContent;
let proposalRowsState = adminProposals;
let auditRowsState = auditEvents;

const head=(title,copy,action='')=>`<div class="module-head admin-module-head"><div><span class="eyebrow">Administración AFUCOA</span><h1>${title}</h1><p>${copy}</p></div>${action?`<button class="button primary" data-open-editor>＋ ${action}</button>`:''}</div>`;
const pill=(state)=>`<span class="pill ${['Publicado','Enviada','Respondida'].includes(state)?'success-soft':['Programado','Programada','En evaluación','Borrador'].includes(state)?'gold':''}">${state}</span>`;
const saveNote=(id,copy)=>`<div id="${id}" class="admin-save-note" hidden>${copy}</div>`;

export function renderAdminContent(){
  return `${head('Contenido','Publicá noticias, comunicados y eventos desde un editor único.','Nueva publicación')}
  <section class="admin-split-layout">
    <article class="card admin-panel"><div class="admin-panel-head"><div><span class="eyebrow">Publicaciones</span><h2>Contenido editorial</h2></div><div class="tabs compact-tabs">${['Todo','Publicado','Programado','Borrador'].map((x,i)=>`<button class="tab ${i===0?'active':''}" data-content-filter="${x}">${x}</button>`).join('')}</div></div><div id="admin-content-list" class="admin-record-list">${contentRows(contentRowsState)}</div></article>
    <aside class="card admin-editor" id="content-editor"><span class="eyebrow">Editor visual</span><h2>Nueva publicación</h2>${contentForm()}</aside>
  </section>`;
}
export async function bindAdminContent(){
  const root=document.querySelector('#admin-content-list'); const filters=document.querySelectorAll('[data-content-filter]');
  try { contentRowsState = await listAdminContent(); } catch(error){ console.error(error); flash('No se pudo cargar el contenido real.', true); }
  let active='Todo';
  const paint=()=>{ const rows=active==='Todo'?contentRowsState:contentRowsState.filter(x=>x.status===active); root.innerHTML=contentRows(rows); };
  paint();
  filters.forEach(b=>b.addEventListener('click',()=>{filters.forEach(x=>x.classList.toggle('active',x===b));active=b.dataset.contentFilter;paint();}));
  document.querySelector('#admin-content-form')?.addEventListener('submit',async e=>{
    e.preventDefault(); const f=e.currentTarget; const fd=new FormData(f);
    const status=fd.get('status'); const when=fd.get('published_at');
    try {
      await saveAdminContent({ kind:fd.get('kind'), title:fd.get('title'), summary:fd.get('summary')||null, body:fd.get('body')||null, audience:{type:fd.get('audience')}, pinned:fd.get('pinned')==='on', status, published_at:when ? new Date(when).toISOString() : null });
      contentRowsState=await listAdminContent(); paint(); f.reset(); flash(appMode==='demo'?'Publicación simulada.':'Publicación guardada en Supabase.');
    } catch(error){ console.error(error); flash('No se pudo guardar la publicación.', true); }
  });
  document.querySelector('[data-open-editor]')?.addEventListener('click',()=>document.querySelector('#content-editor')?.scrollIntoView({behavior:'smooth'}));
}


export function renderAdminDocuments(){
  return `${head('Documentos','Gestioná biblioteca, versiones, vigencia y archivo institucional.','Nuevo documento')}
  <section class="admin-split-layout">
    <article class="card admin-panel"><div class="admin-panel-head"><div><span class="eyebrow">Biblioteca</span><h2>Documentos</h2></div><label class="search-wrap compact-search"><span>⌕</span><input id="admin-doc-search" class="search" placeholder="Buscar documento"></label></div><div id="admin-doc-list" class="admin-record-list">${documentRows(adminDocuments)}</div></article>
    <aside class="card admin-editor" id="document-editor"><span class="eyebrow">Versionado</span><h2>Subir documento</h2>${documentForm()}</aside>
  </section>`;
}
export function bindAdminDocuments(){
  const input=document.querySelector('#admin-doc-search');const root=document.querySelector('#admin-doc-list');
  input?.addEventListener('input',()=>{const q=input.value.toLocaleLowerCase('es');root.innerHTML=documentRows(adminDocuments.filter(x=>`${x.title} ${x.category} ${x.version}`.toLocaleLowerCase('es').includes(q)));});
  bindDemoForm('#admin-document-form','#document-save-note');
  document.querySelector('[data-open-editor]')?.addEventListener('click',()=>document.querySelector('#document-editor')?.scrollIntoView({behavior:'smooth'}));
}

export function renderAdminProposals(){
  return `${head('Propuestas','Moderá, publicá, cerrá y respondé propuestas de socios.')}
  <section class="admin-filter-strip">${['Todas','En evaluación','Publicada','Respondida'].map((x,i)=>`<button class="chip ${i===0?'active':''}" data-proposal-filter="${x}">${x}</button>`).join('')}</section>
  <section class="card admin-panel"><div class="admin-panel-head"><div><span class="eyebrow">Moderación</span><h2 id="proposal-admin-count">${proposalRowsState.length} propuestas</h2></div></div><div id="admin-proposal-list" class="admin-record-list">${proposalRows(proposalRowsState)}</div></section>`;
}
export async function bindAdminProposals(){
  const root=document.querySelector('#admin-proposal-list');const buttons=document.querySelectorAll('[data-proposal-filter]');
  try { proposalRowsState=await listAdminProposals(); } catch(error){ console.error(error); flash('No se pudieron cargar las propuestas.',true); }
  let active='Todas';
  const paint=()=>{ const rows=active==='Todas'?proposalRowsState:proposalRowsState.filter(x=>x.status===active);root.innerHTML=proposalRows(rows);document.querySelector('#proposal-admin-count').textContent=`${rows.length} propuestas`;};
  paint(); buttons.forEach(b=>b.addEventListener('click',()=>{buttons.forEach(x=>x.classList.toggle('active',x===b));active=b.dataset.proposalFilter;paint();}));
  root?.addEventListener('click',async e=>{const btn=e.target.closest('[data-proposal-action]');if(!btn)return; const id=btn.dataset.proposalId; const next=btn.dataset.proposalAction; let note=''; if(next==='respondida') note=window.prompt('Respuesta institucional','')||''; try{await moderateProposal(id,next,note);proposalRowsState=await listAdminProposals();paint();flash(appMode==='demo'?'Acción simulada.':'Propuesta actualizada.');}catch(error){console.error(error);flash('No se pudo actualizar la propuesta.',true);}});
}


export function renderAdminNotifications(){
  return `${head('Notificaciones','Redactá mensajes y definí audiencia, canal y momento de envío.','Nueva notificación')}
  <section class="admin-split-layout">
    <article class="card admin-panel"><div class="admin-panel-head"><div><span class="eyebrow">Historial</span><h2>Envíos recientes</h2></div></div><div class="admin-record-list">${notificationRows(adminNotifications)}</div></article>
    <aside class="card admin-editor" id="notification-editor"><span class="eyebrow">Compositor</span><h2>Nueva notificación</h2>${notificationForm()}</aside>
  </section>`;
}
export function bindAdminNotifications(){bindDemoForm('#admin-notification-form','#notification-save-note');document.querySelector('[data-open-editor]')?.addEventListener('click',()=>document.querySelector('#notification-editor')?.scrollIntoView({behavior:'smooth'}));}

export function renderAdminAudit(){
  return `${head('Auditoría','Registro de acciones administrativas para trazabilidad y control.')}
  <section class="card admin-toolbar"><label class="search-wrap big"><span>⌕</span><input id="audit-search" class="search" placeholder="Actor, acción, expediente o entidad"></label><select id="audit-action" class="admin-select"><option>Todas las acciones</option><option>Cambió estado de trámite</option><option>Generó notificación</option><option>Publicó convenio</option><option>Editó comunicado</option></select></section>
  <section class="card admin-panel"><div class="admin-panel-head"><div><span class="eyebrow">Registro</span><h2 id="audit-count">${auditRowsState.length} eventos</h2></div><button class="button secondary">Exportar</button></div><div id="audit-table">${auditTable(auditRowsState)}</div></section>`;
}
export async function bindAdminAudit(){
  const q=document.querySelector('#audit-search');const action=document.querySelector('#audit-action');const root=document.querySelector('#audit-table');
  try { auditRowsState=await listAuditEvents(); } catch(error){ console.error(error); flash('No se pudo cargar la auditoría.',true); }
  const apply=()=>{const term=(q?.value||'').toLocaleLowerCase('es');const a=action?.value||'Todas las acciones';const rows=auditRowsState.filter(x=>(a==='Todas las acciones'||x.action===a)&&`${x.actor} ${x.action} ${x.entity} ${x.detail}`.toLocaleLowerCase('es').includes(term));root.innerHTML=auditTable(rows);document.querySelector('#audit-count').textContent=`${rows.length} eventos`;};apply();q?.addEventListener('input',apply);action?.addEventListener('change',apply);
}


export function renderAdminSettings(){
  return `${head('Configuración','Parámetros operativos, roles y comportamiento general de la plataforma.')}
  <section class="settings-grid">
    <form class="card admin-editor" id="admin-settings-form"><span class="eyebrow">Organización</span><h2>Datos generales</h2><label class="field">Nombre corto<input value="${adminSettings.organizationName}"></label><label class="field">Nombre institucional<input value="${adminSettings.fullName}"></label><label class="field">Correo de soporte<input type="email" value="${adminSettings.supportEmail}"></label><div class="admin-form-two"><label class="field">Prefijo de expedientes<input value="${adminSettings.requestPrefix}"></label><label class="field">Responsable por defecto<select><option>${adminSettings.defaultRequestOwner}</option><option>Julio Pintos</option><option>Emanuel Basualdo</option></select></label></div><button class="button primary">Guardar cambios</button>${saveNote('settings-save-note','Configuración guardada en modo demostración.')}</form>
    <article class="card admin-panel"><span class="eyebrow">Funciones</span><h2>Políticas generales</h2><div class="setting-list">${toggleRow('Permitir propuestas de socios',adminSettings.allowMemberProposals,'Los socios pueden enviar nuevas propuestas.')}${toggleRow('Moderación previa de propuestas',adminSettings.requireProposalModeration,'Las propuestas requieren aprobación antes de publicarse.')}${toggleRow('Notificaciones push',adminSettings.allowPush,'Habilita el canal push cuando Firebase/Supabase estén conectados.')}</div></article>
    <article class="card admin-panel"><span class="eyebrow">Roles</span><h2>Permisos preparados</h2><div class="role-grid">${role('Socio','Portal personal, trámites, convenios, propuestas y documentos.')}${role('Administrador','Gestión operativa de socios, contenido y solicitudes.')}${role('Superadministrador','Configuración, roles y acciones sensibles.')}</div><p class="muted admin-security-note">Los controles visuales no constituyen seguridad. Los permisos efectivos se aplicarán con Auth + RLS al conectar Supabase.</p></article>
  </section>`;
}
export function bindAdminSettings(){bindDemoForm('#admin-settings-form','#settings-save-note');}

function bindDemoForm(formSelector,noteSelector){document.querySelector(formSelector)?.addEventListener('submit',e=>{e.preventDefault();const note=document.querySelector(noteSelector);if(note){note.hidden=false;setTimeout(()=>note.hidden=true,2600);}});}
function contentRows(rows){if(!rows.length)return empty();return rows.map(x=>`<div class="admin-record-row"><div class="record-icon">${x.kind==='Evento'?'◷':'▣'}</div><div><div class="document-meta"><span class="category-tag">${x.kind}</span>${pill(x.status)}${x.pinned?'<span class="pill blue-soft">Destacado</span>':''}</div><h3>${x.title}</h3><p>${x.audience} · ${x.date}</p></div><button class="button secondary">Editar</button></div>`).join('');}
function documentRows(rows){if(!rows.length)return empty();return rows.map(x=>`<div class="admin-record-row"><div class="record-icon">PDF</div><div><div class="document-meta"><span class="category-tag">${x.category}</span>${pill(x.status)}${x.current?'<span class="pill blue-soft">Vigente</span>':''}</div><h3>${x.title}</h3><p>Versión ${x.version} · Actualizado ${x.updated}</p></div><button class="button secondary">Versiones</button></div>`).join('');}
function proposalRows(rows){if(!rows.length)return empty();return rows.map(x=>`<div class="admin-record-row proposal-admin-row"><div class="record-icon">◇</div><div><div class="document-meta">${pill(x.status)}<span class="pill">${x.supports} apoyos</span></div><h3>${x.title}</h3><p>${x.author} · ${x.received}</p></div><div class="button-row">${x.status==='En evaluación'?`<button class="button primary" data-proposal-action="publicada" data-proposal-id="${x.id}">Publicar</button>`:''}${x.status==='Publicada'?`<button class="button secondary" data-proposal-action="cerrada" data-proposal-id="${x.id}">Cerrar</button><button class="button primary" data-proposal-action="respondida" data-proposal-id="${x.id}">Responder</button>`:''}</div></div>`).join('');}
function notificationRows(rows){return rows.map(x=>`<div class="admin-record-row"><div class="record-icon">◉</div><div><div class="document-meta">${pill(x.status)}<span class="category-tag">${x.channel}</span></div><h3>${x.title}</h3><p>${x.audience} · ${x.sendAt}</p></div><button class="button secondary">Ver</button></div>`).join('');}
function auditTable(rows){if(!rows.length)return empty();return `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Fecha</th><th>Actor</th><th>Acción</th><th>Entidad</th><th>Detalle</th></tr></thead><tbody>${rows.map(x=>`<tr><td><small>${x.at}</small></td><td><strong>${x.actor}</strong></td><td>${x.action}</td><td>${x.entity}</td><td>${x.detail}</td></tr>`).join('')}</tbody></table></div>`;}
function contentForm(){return `<form id="admin-content-form" class="admin-form"><div class="admin-form-two"><label class="field">Tipo<select name="kind"><option value="noticia">Noticia</option><option value="comunicado">Comunicado</option><option value="evento">Evento</option><option value="aviso">Aviso</option></select></label><label class="field">Estado<select name="status"><option value="borrador">Borrador</option><option value="programado">Programado</option><option value="publicado">Publicado</option></select></label></div><label class="field">Título<input name="title" required placeholder="Título de la publicación"></label><label class="field">Resumen<textarea name="summary" required placeholder="Resumen breve"></textarea></label><label class="field">Contenido<textarea name="body" class="tall-textarea" placeholder="Contenido completo"></textarea></label><div class="admin-form-two"><label class="field">Audiencia<select name="audience"><option value="all_members">Todos los socios</option><option value="sector">Por sector</option><option value="selected_group">Grupo seleccionado</option></select></label><label class="field">Fecha de publicación<input name="published_at" type="datetime-local"></label></div><label class="check-row"><input name="pinned" type="checkbox"> Destacar en Inicio</label><label class="check-row"><input name="push" type="checkbox"> Enviar push al publicar</label><button class="button primary full">Guardar publicación</button>${saveNote('content-save-note','')}</form>`;}
function documentForm(){return `<form id="admin-document-form" class="admin-form"><label class="field">Título<input required placeholder="Nombre del documento"></label><div class="admin-form-two"><label class="field">Categoría<select><option>Estatuto</option><option>Reglamentos</option><option>Actas</option><option>Convenios</option><option>Comunicados</option><option>Formularios</option><option>Normativa</option></select></label><label class="field">Versión<input placeholder="Ej. 2.0"></label></div><label class="field">Descripción<textarea placeholder="Descripción breve"></textarea></label><label class="file-field field"><input type="file" accept="application/pdf"><span>＋ Seleccionar PDF</span><small>La carga real se habilitará al conectar Storage.</small></label><label class="check-row"><input type="checkbox" checked> Marcar como versión vigente</label><button class="button primary full">Guardar documento</button>${saveNote('document-save-note','Documento guardado en modo demostración.')}</form>`;}
function notificationForm(){return `<form id="admin-notification-form" class="admin-form"><label class="field">Título<input required maxlength="80" placeholder="Título breve"></label><label class="field">Mensaje<textarea required maxlength="240" placeholder="Mensaje de la notificación"></textarea></label><div class="admin-form-two"><label class="field">Audiencia<select><option>Todos los socios</option><option>Por sector</option><option>Socio específico</option></select></label><label class="field">Canal<select><option>Push + centro</option><option>Solo centro</option></select></label></div><label class="field">Destino<select><option>Inicio</option><option>Trámite específico</option><option>Convenio</option><option>Documento</option><option>Evento</option></select></label><label class="field">Programar envío<input type="datetime-local"></label><button class="button primary full">Preparar envío</button>${saveNote('notification-save-note','Envío preparado en modo demostración. No se enviaron mensajes reales.')}</form>`;}
function toggleRow(title,checked,copy){return `<label class="setting-row"><div><strong>${title}</strong><small>${copy}</small></div><input type="checkbox" ${checked?'checked':''}></label>`;}
function role(title,copy){return `<div class="role-card"><strong>${title}</strong><p>${copy}</p><button class="text-button">Ver permisos</button></div>`;}
function empty(){return `<div class="empty-state"><h3>No hay resultados</h3><p>Probá con otros criterios.</p></div>`;}

function flash(message,isError=false){ const host=document.querySelector('.admin-main')||document.querySelector('main')||document.body; const n=document.createElement('div'); n.className=`admin-save-note ${isError?'admin-error-note':''}`; n.textContent=message; host.prepend(n); setTimeout(()=>n.remove(),4000); }
