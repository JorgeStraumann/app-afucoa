import {getPushState,activatePush,deactivatePush} from '../services/push-service.js';

export function pushControls() {
  return `<article class="card"><h2>Notificaciones en este dispositivo</h2>
    <p class="muted">Son opcionales. La pantalla bloqueada solo mostrará un aviso genérico; el contenido completo queda dentro de AFUCOA.</p>
    <p id="push-state" role="status" aria-live="polite">Consultando…</p>
    <div class="button-row"><button type="button" class="button secondary" id="push-enable" disabled>Activar notificaciones</button>
    <button type="button" class="button ghost" id="push-disable" hidden>Desactivar notificaciones</button></div>
    <p id="push-note" class="muted"></p></article>`;
}

export function bindPushControls() {
  const state=document.querySelector('#push-state'), note=document.querySelector('#push-note');
  const enable=document.querySelector('#push-enable'), disable=document.querySelector('#push-disable');
  if (!state || !enable) return;
  const paint = result => {
    state.textContent={unsupported:'No compatibles',inactive:'No activadas',denied:'Permiso bloqueado',active:'Activadas'}[result.state] || 'No activadas';
    enable.hidden=result.state==='active';
    enable.disabled=!result.enabled || ['unsupported','denied'].includes(result.state);
    disable.hidden=!result.canDeactivate;
    note.textContent=result.state==='unsupported'?'Este navegador no admite Web Push. En iPhone/iPad se requiere una versión compatible y agregar AFUCOA a Inicio.':
      result.state==='denied'?'El permiso está bloqueado. Podés revisarlo en la configuración del navegador; no volveremos a pedirlo automáticamente.':
      !result.enabled?'Push todavía no está disponible. Las notificaciones internas siguen funcionando.':'Podés desactivarlas cuando quieras. Al cerrar sesión se desactiva este dispositivo por privacidad.';
  };
  const refresh = async () => {try {paint(await getPushState());}catch {state.textContent='No se pudo consultar';note.textContent='Las notificaciones internas siguen disponibles.';enable.disabled=true;}};
  enable.addEventListener('click',async () => {
    enable.disabled=true;
    try {await activatePush();await refresh();}catch(error){note.textContent=error.message;enable.disabled=false;}
  });
  disable.addEventListener('click',async () => {
    disable.disabled=true;
    try {await deactivatePush();await refresh();}catch(error){note.textContent=error.message;}finally{disable.disabled=false;}
  });
  refresh();
}
