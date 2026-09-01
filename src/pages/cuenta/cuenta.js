import { getSession, endSession, getAppMode, refreshProfile } from '../../store/session.js';
import { navigate } from '../../router/router.js';
import { escapeHtml, initials } from '../../utils/html.js';
import { updateMyContact } from '../../services/profile-service.js';
import { getNotificationPreferences, saveNotificationPreferences } from '../../services/preferences-repository.js';

let preferences={agreements:true,news:true,events:true,request_updates:true};

export async function renderAccount() {
  const profile = getSession()?.profile || {};
  try { preferences=await getNotificationPreferences(); } catch(e){ console.warn('Preferencias no disponibles',e); }
  const first = profile.first_name || 'Jorge';
  const last = profile.last_name || 'Carrara';
  const fullName = `${first} ${last}`.trim();
  const memberNumber = profile.member_number || '1925';
  const status = profile.status || 'activo';
  const sessionLabel = getAppMode() === 'supabase' ? 'Sesión protegida por Supabase Auth' : 'Sesión de desarrollo';
  return `
    <section class="module-head"><div><span class="eyebrow">Perfil</span><h1>Mi cuenta</h1><p>Datos de afiliación, contacto, preferencias y seguridad.</p></div><span class="status">${status === 'activo' ? 'Socio activo' : escapeHtml(status)}</span></section>
    <section class="account-layout"><div class="account-main">
      <article class="card profile-card"><div class="profile-avatar">${initials(first,last)}</div><div><span class="eyebrow">Socio AFUCOA</span><h2>${escapeHtml(fullName)}</h2><p>Ficha Nº ${escapeHtml(memberNumber)} · Afiliación ${escapeHtml(status)}</p></div><a class="button ghost" href="#/carnet">Ver carné</a></article>
      <article class="card"><div class="section-head"><div><span class="eyebrow">Datos personales</span><h2>Información de contacto</h2></div></div><form id="contact-form" class="form-fields"><label class="field">Correo electrónico<input type="email" name="email" value="${escapeHtml(profile.email || '')}" placeholder="correo@ejemplo.com"></label><label class="field">Teléfono<input type="tel" name="phone" value="${escapeHtml(profile.phone || '')}" placeholder="099 000 000"></label><div><button class="button secondary" type="submit">Guardar contacto</button><span id="contact-status" class="muted"></span></div></form><dl class="account-data"><div><dt>Sector / dependencia</dt><dd>${escapeHtml(profile.sector || profile.department || 'Sin registrar')}</dd></div><div><dt>Fecha de afiliación</dt><dd>${escapeHtml(profile.joined_at || 'Sin registrar')}</dd></div></dl></article>
      <article class="card"><span class="eyebrow">Preferencias</span><h2>Notificaciones</h2><form id="preferences-form"><label class="toggle-row"><span><strong>Convenios</strong><small>Nuevos beneficios disponibles</small></span><input name="agreements" type="checkbox" ${preferences.agreements?'checked':''}></label><label class="toggle-row"><span><strong>Noticias</strong><small>Comunicaciones generales de AFUCOA</small></span><input name="news" type="checkbox" ${preferences.news?'checked':''}></label><label class="toggle-row"><span><strong>Agenda</strong><small>Actividades y recordatorios</small></span><input name="events" type="checkbox" ${preferences.events?'checked':''}></label><label class="toggle-row"><span><strong>Trámites</strong><small>Actualizaciones de solicitudes</small></span><input name="request_updates" type="checkbox" ${preferences.request_updates?'checked':''}></label><button class="button secondary" type="submit">Guardar preferencias</button><span id="preferences-status" class="muted"></span></form></article>
    </div><aside class="account-side"><article class="card"><span class="eyebrow">Seguridad</span><h2>Cuenta y sesiones</h2><div class="security-item"><div><strong>Contraseña</strong><small>La recuperación segura se implementa mediante backend/Edge Function</small></div><button class="button ghost" disabled>Cambiar</button></div><div class="security-item"><div><strong>Este dispositivo</strong><small>${sessionLabel}</small></div><span class="pill success-soft">Actual</span></div></article><button class="button danger-outline full" id="logout-button">Cerrar sesión</button></aside></section>`;
}

export function bindAccount() {
  document.querySelector('#logout-button')?.addEventListener('click', async()=>{await endSession();navigate('/login');});
  document.querySelector('#contact-form')?.addEventListener('submit', async e=>{e.preventDefault();const status=document.querySelector('#contact-status');const fd=new FormData(e.currentTarget);try{status.textContent='Guardando…';await updateMyContact({email:fd.get('email'),phone:fd.get('phone')});await refreshProfile();status.textContent='Guardado';}catch(err){console.error(err);status.textContent='No se pudo guardar';}});
  document.querySelector('#preferences-form')?.addEventListener('submit', async e=>{e.preventDefault();const status=document.querySelector('#preferences-status');const f=e.currentTarget;try{status.textContent='Guardando…';await saveNotificationPreferences({agreements:f.agreements.checked,news:f.news.checked,events:f.events.checked,request_updates:f.request_updates.checked});status.textContent='Guardado';}catch(err){console.error(err);status.textContent='No se pudo guardar';}});
}
