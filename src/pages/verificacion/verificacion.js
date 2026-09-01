import { verifyMembershipToken } from '../../services/membership-service.js';
import { escapeHtml } from '../../utils/html.js';

export async function renderVerification({ token }) {
  if (!token) return card(false, 'Código de verificación ausente', 'Abrí nuevamente el QR desde el carné AFUCOA.');
  try {
    const result = await verifyMembershipToken(token);
    if (!result?.valid) return card(false, 'Acreditación no válida', 'El código venció, fue revocado o no corresponde a una afiliación activa.');
    const expiry = result.expires_at ? new Date(result.expires_at).toLocaleString('es-UY') : '—';
    return `
      <main class="verification-page">
        <section class="verification-card card valid">
          <div class="verification-brand"><span class="brand-mark">A</span><div><strong>AFUCOA</strong><small>Verificación de afiliación</small></div></div>
          <div class="verification-status">✓</div>
          <span class="eyebrow">Acreditación válida</span>
          <h1>Socio activo</h1>
          <dl class="verification-data">
            <div><dt>Nombre</dt><dd>${escapeHtml(result.full_name || '—')}</dd></div>
            <div><dt>Ficha</dt><dd>${escapeHtml(result.member_number || '—')}</dd></div>
            <div><dt>Estado</dt><dd>${escapeHtml(result.member_status || 'activo')}</dd></div>
            <div><dt>Válido hasta</dt><dd>${escapeHtml(expiry)}</dd></div>
          </dl>
          <p class="privacy-note">Esta verificación no expone cédula, correo electrónico ni teléfono del socio.</p>
        </section>
      </main>`;
  } catch (error) {
    console.error('Error verificando afiliación', error);
    return card(false, 'No pudimos verificar ahora', 'Probá nuevamente. Si el problema continúa, solicitá al socio que genere un QR nuevo.');
  }
}

function card(valid, title, text) {
  return `<main class="verification-page"><section class="verification-card card ${valid ? 'valid' : 'invalid'}"><div class="verification-brand"><span class="brand-mark">A</span><div><strong>AFUCOA</strong><small>Verificación de afiliación</small></div></div><div class="verification-status">${valid ? '✓' : '!'}</div><h1>${title}</h1><p>${text}</p></section></main>`;
}
