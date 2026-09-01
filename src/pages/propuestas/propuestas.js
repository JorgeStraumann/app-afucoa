import { appMode } from '../../services/supabase.js';
import { listProposals, createProposal, supportProposal } from '../../services/proposals-repository.js';

let proposals = [];

export async function renderProposals() {
  try { proposals = await listProposals(); } catch (error) { console.error(error); proposals = []; }
  const active = proposals.filter(p => p.status === 'publicada');
  return `
    <section class="module-head"><div><span class="eyebrow">Participación</span><h1>Propuestas</h1><p>Presentá ideas, apoyá iniciativas y consultá la respuesta institucional.</p></div><button class="button primary" id="open-proposal-form">Nueva propuesta</button></section>
    <div class="tabs" role="tablist"><button class="tab active" data-proposal-tab="activas">Activas <b>${active.length}</b></button><button class="tab" data-proposal-tab="finalizadas">Finalizadas</button><button class="tab" data-proposal-tab="mias">Mis propuestas</button></div>
    <section class="proposal-layout section"><div id="proposal-list" class="proposal-list">${proposalCards(active)}</div><aside class="card proposal-info"><span class="eyebrow">Cómo funciona</span><h2>Participación con trazabilidad</h2><p>Cada socio puede apoyar una propuesta una sola vez. La validación se realiza en servidor.</p><div class="mini-stat"><strong>${active.reduce((n,p)=>n+p.supports,0)}</strong><span>apoyos en propuestas activas</span></div></aside></section>
    <dialog id="proposal-dialog" class="modal-card"><form method="dialog" id="proposal-form"><div class="modal-head"><div><span class="eyebrow">Nueva propuesta</span><h2>Presentar una idea</h2></div><button class="icon-button" value="cancel" aria-label="Cerrar">×</button></div><label class="field">Título <em>*</em><input name="title" required maxlength="100" placeholder="Resumen claro de la propuesta"></label><label class="field">Descripción <em>*</em><textarea name="description" required maxlength="1200" placeholder="Explicá el problema, la propuesta y qué mejora esperás."></textarea></label><div class="review-panel compact"><div class="review-icon">i</div><div><h3>Moderación previa</h3><p>La propuesta se enviará a evaluación antes de publicarse.</p></div></div><p id="proposal-form-status" class="form-status"></p><div class="flow-actions"><button class="button ghost" value="cancel">Cancelar</button><button class="button primary" value="default">Enviar propuesta</button></div></form></dialog>`;
}

function proposalCards(items) {
  if (!items.length) return `<div class="card empty-state"><h3>No hay propuestas en esta vista</h3><p>Cuando existan, aparecerán acá.</p></div>`;
  return items.map(p => `<article class="card proposal-card"><div class="proposal-top"><span class="category-tag">${p.category || 'Propuesta'}</span><span class="pill ${p.status==='respondida'?'success-soft':''}">${p.statusLabel}</span></div><h3>${p.title}</h3><p>${p.summary}</p>${p.response ? `<div class="institutional-response"><strong>Respuesta de AFUCOA</strong><p>${p.response}</p></div>`:''}<div class="proposal-foot"><div><strong>${p.supports}</strong><small> apoyos</small></div>${p.status==='publicada'?`<button class="button ghost support-button" data-support="${p.id}" ${p.supported?'disabled':''}>${p.supported?'Apoyada ✓':'Apoyar propuesta'}</button>`:`<small>${p.dateLabel}</small>`}</div></article>`).join('');
}

export function bindProposals() {
  const dialog = document.querySelector('#proposal-dialog');
  document.querySelector('#open-proposal-form')?.addEventListener('click', () => dialog?.showModal());
  const tabs = [...document.querySelectorAll('[data-proposal-tab]')];
  tabs.forEach(tab => tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.toggle('active', t===tab));
    const key = tab.dataset.proposalTab;
    const items = key==='activas' ? proposals.filter(p=>p.status==='publicada') : key==='finalizadas' ? proposals.filter(p=>['cerrada','respondida'].includes(p.status)) : proposals.filter(p=>p.mine);
    document.querySelector('#proposal-list').innerHTML = proposalCards(items); bindSupportButtons();
  }));
  bindSupportButtons();
  document.querySelector('#proposal-form')?.addEventListener('submit', async (event) => {
    if (event.submitter?.value === 'cancel') return;
    event.preventDefault(); const status = document.querySelector('#proposal-form-status'); const fd = new FormData(event.currentTarget);
    try { status.textContent='Enviando…'; await createProposal({ title:String(fd.get('title')), description:String(fd.get('description')) }); status.textContent = appMode==='demo'?'Propuesta registrada en modo demostración.':'Propuesta enviada a moderación.'; setTimeout(()=>dialog?.close(),700); }
    catch(error){ status.textContent=error.message || 'No se pudo enviar la propuesta.'; }
  });
}

function bindSupportButtons() {
  document.querySelectorAll('[data-support]').forEach(button => button.addEventListener('click', async () => {
    const item = proposals.find(p => p.id === button.dataset.support); if (!item || item.supported) return;
    button.disabled=true;
    try { await supportProposal(item.id); item.supported=true; item.supports+=1; button.textContent='Apoyada ✓'; button.closest('.proposal-card')?.querySelector('.proposal-foot strong')?.replaceChildren(document.createTextNode(String(item.supports))); }
    catch(error){ button.disabled=false; alert(error.message || 'No se pudo registrar el apoyo.'); }
  }));
}
