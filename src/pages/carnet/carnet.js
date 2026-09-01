import QRCode from 'qrcode';
import { getSession } from '../../store/session.js';
import { createMembershipProof } from '../../services/membership-service.js';
import { appMode } from '../../services/supabase.js';
import { escapeHtml, initials } from '../../utils/html.js';

export function renderCarnet() {
  const profile = getSession()?.profile || {};
  const first = profile.first_name || 'Jorge';
  const last = profile.last_name || 'Carrara';
  const fullName = `${first} ${last}`.trim();
  return `
    <div class="page-title"><div><span class="eyebrow">Identificación AFUCOA</span><h1>Mi carné digital</h1><p>Acreditá tu afiliación mediante un código temporal. El QR no contiene cédula, correo ni teléfono.</p></div></div>
    <section class="credential-layout">
      <article class="member-card">
        <div class="member-card-top"><div class="mini-brand">AFUCOA</div><span class="pill success">${profile.status === 'activo' || !profile.status ? 'Socio activo' : escapeHtml(profile.status)}</span></div>
        <div class="member-identity"><div class="portrait-placeholder">${initials(first,last)}</div><div><small>Socio</small><h2>${escapeHtml(fullName)}</h2><p>Ficha Nº ${escapeHtml(profile.member_number || '1925')}</p></div></div>
        <div class="member-card-foot"><span>Asociación de Funcionarios de la Comisión Administrativa</span><strong>AFUCOA</strong></div>
      </article>
      <article class="card verification-card">
        <div><span class="eyebrow">Verificación</span><h2>QR de afiliación</h2><p>${appMode === 'supabase' ? 'Generá un QR temporal válido durante 5 minutos.' : 'Modo demostración: el QR permite probar el flujo visual sin validar afiliación real.'}</p></div>
        <div class="qr-live" id="membership-qr"><div class="qr-loading">Generando…</div></div>
        <div class="verification-code" id="membership-expiry"><small>Estado</small><strong>Preparando acreditación</strong></div>
        <div class="button-row"><button class="button primary" id="refresh-membership-qr">Generar QR nuevo</button><button class="button secondary" disabled>Descargar constancia</button></div>
      </article>
      <article class="card verify-help"><span class="eyebrow">Para comercios y terceros</span><h2>¿Cómo se verifica?</h2><ol class="steps"><li>El socio muestra su QR.</li><li>El comercio lo escanea.</li><li>AFUCOA confirma únicamente nombre, ficha y estado vigente.</li></ol><div class="privacy-note">Cada QR real vence a los 5 minutos y reemplaza al anterior.</div></article>
    </section>`;
}

export function bindCarnet() {
  const button = document.querySelector('#refresh-membership-qr');
  button?.addEventListener('click', generateQr);
  generateQr();
}

async function generateQr() {
  const root = document.querySelector('#membership-qr');
  const status = document.querySelector('#membership-expiry');
  if (!root || !status) return;
  root.innerHTML = '<div class="qr-loading">Generando…</div>';
  try {
    const proof = await createMembershipProof();
    const token = proof?.token || `DEMO-${crypto.randomUUID()}`;
    const url = `${window.location.origin}${window.location.pathname}#/verificar/${encodeURIComponent(token)}`;
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, url, { width: 256, margin: 2, errorCorrectionLevel: 'M' });
    root.innerHTML = '';
    root.appendChild(canvas);
    if (proof?.expires_at) {
      status.innerHTML = `<small>Válido hasta</small><strong>${new Date(proof.expires_at).toLocaleTimeString('es-UY', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}</strong>`;
    } else {
      status.innerHTML = '<small>Modo demostración</small><strong>QR no verificable contra padrón real</strong>';
    }
  } catch (error) {
    console.error(error);
    root.innerHTML = '<div class="qr-error">No se pudo generar el QR.</div>';
    status.innerHTML = '<small>Error</small><strong>Intentá nuevamente</strong>';
  }
}
