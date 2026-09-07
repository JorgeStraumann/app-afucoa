import QRCode from 'qrcode';
import { navigate } from '../../router/router.js';
import { beginTotpEnrollment, cancelUnverifiedTotp, publicMfaError, verifyTotp } from '../../services/mfa-service.js';
import { endSession, getSession, refreshMfaSession } from '../../store/session.js';
import { escapeHtml } from '../../utils/html.js';

let pendingEnrollment = null;

function brand() {
  return '<div class="login-brand"><div class="brand-mark brand-mark-blue">A</div><div><strong>AFUCOA</strong><small>Acceso administrativo protegido</small></div></div>';
}

function challengeCard() {
  return `${brand()}
    <div class="login-copy"><span class="eyebrow">Segundo factor obligatorio</span><h1>Verificación en dos pasos</h1><p>Abrí tu aplicación autenticadora e ingresá el código vigente.</p></div>
    <form id="mfa-verify-form" class="form-stack">
      <label>Código de 6 dígitos<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required autofocus></label>
      <div class="form-error" id="mfa-error" role="alert" hidden></div>
      <button class="button primary wide" type="submit">Verificar</button>
      <button class="button tertiary wide" id="mfa-logout" type="button">Cerrar sesión</button>
    </form>`;
}

function enrollmentCard() {
  return `${brand()}
    <div class="login-copy"><span class="eyebrow">Segundo factor obligatorio</span><h1>Configurar verificación en dos pasos</h1><p>Vinculá una aplicación autenticadora TOTP antes de acceder a Administración.</p></div>
    <div id="mfa-enrollment-start" class="form-stack">
      <p class="mfa-help">El código QR y la clave manual se muestran solamente durante esta configuración. AFUCOA no los guarda en el navegador.</p>
      <button class="button primary wide" id="mfa-enroll" type="button">Generar código QR</button>
      <button class="button tertiary wide" id="mfa-logout" type="button">Cerrar sesión</button>
      <div class="form-error" id="mfa-error" role="alert" hidden></div>
    </div>
    <div id="mfa-enrollment-details" class="mfa-enrollment" hidden></div>`;
}

function unavailableCard() {
  return `${brand()}
    <div class="login-copy"><h1>Verificación temporalmente no disponible</h1><p>No se habilitó ningún acceso administrativo. Reintentá la comprobación o cerrá sesión.</p></div>
    <div class="form-stack"><button class="button primary wide" id="mfa-retry" type="button">Reintentar</button><button class="button tertiary wide" id="mfa-logout" type="button">Cerrar sesión</button></div>`;
}

export function renderMfaGate() {
  const mode = getSession()?.mfa?.mode;
  const content = mode === 'challenge' ? challengeCard() : mode === 'enrollment' ? enrollmentCard() : unavailableCard();
  return `<main class="login-page mfa-page"><section class="login-backdrop" aria-hidden="true"><div class="palace-silhouette"></div></section><section class="login-panel"><div class="login-card mfa-card">${content}</div></section></main>`;
}

function errorBox(message) {
  const box = document.querySelector('#mfa-error');
  if (!box) return;
  box.textContent = message;
  box.hidden = false;
}

async function finishVerification(factorId, code, button) {
  button.disabled = true;
  button.textContent = 'Verificando…';
  try {
    await verifyTotp({ factorId, code });
    pendingEnrollment = null;
    const session = await refreshMfaSession();
    if (session?.mfa?.currentLevel !== 'aal2') throw new Error('mfa_not_promoted');
    navigate('/admin');
  } catch {
    errorBox(publicMfaError());
    button.disabled = false;
    button.textContent = 'Verificar';
  }
}

function enrollmentDetails(enrollment) {
  return `<div class="mfa-qr-wrap"><canvas id="mfa-qr" width="240" height="240" aria-label="Código QR para configurar TOTP"></canvas></div>
    <p class="mfa-help">Escaneá el QR. Si no podés hacerlo, copiá temporalmente esta clave manual:</p>
    <div class="mfa-secret"><code>${escapeHtml(enrollment.secret)}</code><button class="button tertiary" id="mfa-copy" type="button">Copiar clave</button></div>
    <form id="mfa-verify-form" class="form-stack">
      <label>Código de 6 dígitos<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required></label>
      <div class="form-error" id="mfa-error" role="alert" hidden></div>
      <button class="button primary wide" type="submit">Verificar</button>
      <button class="button tertiary wide" id="mfa-cancel" type="button">Cancelar configuración</button>
    </form>`;
}

async function bindEnrollment() {
  document.querySelector('#mfa-enroll')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Preparando…';
    try {
      pendingEnrollment = await beginTotpEnrollment();
      const start = document.querySelector('#mfa-enrollment-start');
      const details = document.querySelector('#mfa-enrollment-details');
      start.hidden = true;
      details.innerHTML = enrollmentDetails(pendingEnrollment);
      details.hidden = false;
      await QRCode.toCanvas(document.querySelector('#mfa-qr'), pendingEnrollment.uri, { width: 240, margin: 1 });
      details.querySelector('#mfa-copy')?.addEventListener('click', async (copyEvent) => {
        await navigator.clipboard.writeText(pendingEnrollment?.secret || '');
        copyEvent.currentTarget.textContent = 'Copiada';
      });
      details.querySelector('#mfa-cancel')?.addEventListener('click', async () => {
        const factorId = pendingEnrollment?.factorId;
        pendingEnrollment = null;
        await cancelUnverifiedTotp(factorId);
        navigate('/mfa');
      });
      details.querySelector('#mfa-verify-form')?.addEventListener('submit', async (submitEvent) => {
        submitEvent.preventDefault();
        const code = new FormData(submitEvent.currentTarget).get('code');
        await finishVerification(pendingEnrollment?.factorId, code, submitEvent.currentTarget.querySelector('button[type="submit"]'));
      });
    } catch {
      pendingEnrollment = null;
      button.disabled = false;
      button.textContent = 'Generar código QR';
      errorBox('No pudimos iniciar la configuración. Intentá nuevamente.');
    }
  });
}

export function bindMfaGate() {
  document.querySelector('#mfa-logout')?.addEventListener('click', async () => {
    const factorId = pendingEnrollment?.factorId;
    pendingEnrollment = null;
    await cancelUnverifiedTotp(factorId);
    await endSession();
    navigate('/login');
  });
  document.querySelector('#mfa-retry')?.addEventListener('click', async () => {
    await refreshMfaSession();
    navigate('/mfa');
  });
  const challenge = document.querySelector('#mfa-verify-form');
  if (challenge) challenge.addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = new FormData(event.currentTarget).get('code');
    await finishVerification(getSession()?.mfa?.factorId, code, event.currentTarget.querySelector('button[type="submit"]'));
  });
  bindEnrollment();
}
