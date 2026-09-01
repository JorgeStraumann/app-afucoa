import { requestPasswordRecovery, confirmPasswordRecovery } from '../../services/password-service.js';

export function renderRecovery() {
  return `<main class="auth-page"><section class="auth-panel"><a href="#/login" class="back-link">← Volver al acceso</a><span class="eyebrow">Acceso AFUCOA</span><h1>Recuperar contraseña</h1><p>Ingresá tu cédula. Si la cuenta está habilitada, enviaremos un código al medio de contacto registrado.</p>
    <form id="recovery-request-form" class="auth-form"><label class="field">Cédula<input name="document" inputmode="numeric" autocomplete="username" required placeholder="Sin puntos ni guiones"></label><button class="button primary" type="submit">Enviar código</button><p class="form-status" id="recovery-status"></p></form>
    <form id="recovery-confirm-form" class="auth-form hidden"><label class="field">Código<input name="code" inputmode="numeric" required maxlength="8"></label><label class="field">Nueva contraseña<input name="password" type="password" autocomplete="new-password" minlength="8" required></label><label class="field">Repetir contraseña<input name="password2" type="password" autocomplete="new-password" minlength="8" required></label><button class="button primary" type="submit">Cambiar contraseña</button><p class="form-status" id="confirm-status"></p></form>
  </section><aside class="auth-visual"><div><span class="eyebrow gold-text">AFUCOA V2</span><h2>Recuperación segura</h2><p>El sistema no revela si una cédula existe y los códigos son temporales y de un solo uso.</p></div></aside></main>`;
}

export function bindRecovery() {
  let currentDocument = '';
  const first = document.querySelector('#recovery-request-form');
  const second = document.querySelector('#recovery-confirm-form');
  first?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.querySelector('#recovery-status');
    currentDocument = new FormData(first).get('document')?.toString() || '';
    try {
      status.textContent = 'Procesando…';
      const result = await requestPasswordRecovery(currentDocument);
      status.textContent = result?.message || 'Si la cuenta está habilitada, recibirás un código en breve.';
      second?.classList.remove('hidden');
    } catch (error) { status.textContent = error.message; }
  });
  second?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(second); const pass = String(data.get('password') || ''); const pass2 = String(data.get('password2') || '');
    const status = document.querySelector('#confirm-status');
    if (pass !== pass2) { status.textContent = 'Las contraseñas no coinciden.'; return; }
    try {
      status.textContent = 'Actualizando…';
      await confirmPasswordRecovery({ documentNumber: currentDocument, code: String(data.get('code') || ''), newPassword: pass });
      status.textContent = 'Contraseña actualizada. Ya podés iniciar sesión.';
      setTimeout(() => { window.location.hash = '#/login'; }, 900);
    } catch (error) { status.textContent = error.message; }
  });
}
