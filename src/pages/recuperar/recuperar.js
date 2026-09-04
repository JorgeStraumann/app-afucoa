import { requestPasswordRecovery, confirmPasswordRecovery, validateRecoveryPassword } from '../../services/password-service.js';

export function renderRecovery() {
  return `<main class="login-page">
    <section class="login-backdrop" aria-hidden="true"><div class="palace-silhouette"></div></section>
    <section class="login-panel"><div class="login-card">
      <a href="#/login" class="back-link">← Volver al acceso</a>
      <div class="login-brand"><div class="brand-mark brand-mark-blue">A</div><div><strong>AFUCOA</strong><small>Portal del socio</small></div></div>
      <div class="login-copy"><h1>Recuperar contraseña</h1><p>Ingresá tu cédula. Si la cuenta está habilitada, enviaremos un código al medio de contacto registrado.</p></div>
      <form id="recovery-request-form" class="form-stack"><label>Cédula<input name="document" inputmode="numeric" autocomplete="username" required placeholder="Sin puntos ni guiones"></label><button class="button primary wide" type="submit">Enviar código</button><p class="muted" id="recovery-status" role="status" aria-live="polite"></p></form>
      <form id="recovery-confirm-form" class="form-stack hidden"><label>Código<input name="code" inputmode="numeric" autocomplete="one-time-code" required minlength="8" maxlength="8" pattern="[0-9]{8}" placeholder="8 dígitos"></label><label>Nueva contraseña<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="72" required aria-describedby="password-rules"></label><small id="password-rules" class="muted">Entre 12 y 72 caracteres, con mayúscula, minúscula, número y símbolo.</small><label>Repetir contraseña<input name="password2" type="password" autocomplete="new-password" minlength="12" maxlength="72" required></label><button class="button primary wide" type="submit">Cambiar contraseña</button><p class="muted" id="confirm-status" role="status" aria-live="polite"></p></form>
      <p class="demo-note">El código vence en 10 minutos y puede usarse una sola vez.</p>
    </div></section></main>`;
}

export function bindRecovery() {
  let currentDocument = '';
  const first = document.querySelector('#recovery-request-form');
  const second = document.querySelector('#recovery-confirm-form');
  first?.querySelector('input[name="document"]')?.addEventListener('input', () => {
    currentDocument = '';
    second?.reset();
    second?.classList.add('hidden');
    document.querySelector('#recovery-status').textContent = '';
  });
  first?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.querySelector('#recovery-status');
    currentDocument = new FormData(first).get('document')?.toString() || '';
    try {
      status.textContent = 'Procesando…';
      first.querySelector('button[type="submit"]').disabled = true;
      first.querySelector('input[name="document"]').disabled = true;
      const result = await requestPasswordRecovery(currentDocument);
      status.textContent = result?.message || 'Si la cuenta está habilitada, recibirás un código en breve.';
      second?.classList.remove('hidden');
      second?.querySelector('input[name="code"]')?.focus();
    } catch (error) { status.textContent = error.message; }
    finally {
      first.querySelector('button[type="submit"]').disabled = false;
      first.querySelector('input[name="document"]').disabled = false;
    }
  });
  second?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(second); const pass = String(data.get('password') || ''); const pass2 = String(data.get('password2') || '');
    const status = document.querySelector('#confirm-status');
    if (pass !== pass2) { status.textContent = 'Las contraseñas no coinciden.'; return; }
    const passwordError = validateRecoveryPassword(pass);
    if (passwordError) { status.textContent = passwordError; return; }
    try {
      status.textContent = 'Actualizando…';
      second.querySelector('button[type="submit"]').disabled = true;
      await confirmPasswordRecovery({ documentNumber: currentDocument, code: String(data.get('code') || ''), newPassword: pass });
      status.textContent = 'Contraseña actualizada. Ya podés iniciar sesión.';
      setTimeout(() => { window.location.hash = '#/login'; }, 900);
    } catch (error) { status.textContent = error.message; }
    finally { second.querySelector('button[type="submit"]').disabled = false; }
  });
}
