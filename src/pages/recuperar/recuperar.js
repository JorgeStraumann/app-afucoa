import { requestPasswordRecovery, confirmPasswordRecovery, validateRecoveryPassword } from '../../services/password-service.js';

export function renderRecovery() {
  return `<main class="auth-page"><section class="auth-panel"><a href="#/login" class="back-link">← Volver al acceso</a><span class="eyebrow">Acceso AFUCOA</span><h1>Recuperar contraseña</h1><p>Ingresá tu cédula. Si la cuenta está habilitada, enviaremos un código al medio de contacto registrado.</p>
    <form id="recovery-request-form" class="auth-form"><label class="field">Cédula<input name="document" inputmode="numeric" autocomplete="username" required placeholder="Sin puntos ni guiones"></label><button class="button primary" type="submit">Enviar código</button><p class="form-status" id="recovery-status" role="status" aria-live="polite"></p></form>
    <form id="recovery-confirm-form" class="auth-form hidden"><label class="field">Código<input name="code" inputmode="numeric" autocomplete="one-time-code" required minlength="8" maxlength="8" pattern="[0-9]{8}" placeholder="8 dígitos"></label><label class="field">Nueva contraseña<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="72" required aria-describedby="password-rules"></label><small id="password-rules">Entre 12 y 72 caracteres, con mayúscula, minúscula, número y símbolo.</small><label class="field">Repetir contraseña<input name="password2" type="password" autocomplete="new-password" minlength="12" maxlength="72" required></label><button class="button primary" type="submit">Cambiar contraseña</button><p class="form-status" id="confirm-status" role="status" aria-live="polite"></p></form>
  </section><aside class="auth-visual"><div><span class="eyebrow gold-text">AFUCOA V2</span><h2>Recuperación segura</h2><p>El sistema no revela si una cédula existe y los códigos son temporales y de un solo uso.</p></div></aside></main>`;
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
