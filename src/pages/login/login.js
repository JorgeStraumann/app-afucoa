import { getAppMode } from '../../store/session.js';

export function renderLogin() {
  const mode = getAppMode();
  const integrationNote = mode === 'supabase'
    ? '<strong>Supabase conectado.</strong> El acceso usa sesión real y el rol se obtiene del perfil del usuario.'
    : '<strong>Modo demostración.</strong> Supabase todavía no está configurado; cualquier cédula y contraseña no vacías permiten recorrer el prototipo.';

  return `
    <main class="login-page">
      <section class="login-backdrop" aria-hidden="true"><div class="palace-silhouette"></div></section>
      <section class="login-panel">
        <div class="login-card">
          <div class="login-brand"><div class="brand-mark brand-mark-blue">A</div><div><strong>AFUCOA</strong><small>Asociación de Funcionarios de la Comisión Administrativa</small></div></div>
          <div class="login-copy"><span class="eyebrow">Portal del socio</span><h1>Ingresá a tu cuenta</h1><p>Consultá convenios, trámites, comunicaciones y tu carné digital.</p></div>
          <form id="login-form" class="form-stack">
            <label>Cédula de identidad<input name="document" inputmode="numeric" autocomplete="username" placeholder="Ej. 1.234.567-8" required></label>
            <label>Contraseña<div class="password-field"><input name="password" type="password" autocomplete="current-password" placeholder="Tu contraseña" required><button type="button" class="text-button" data-toggle-password>Ver</button></div></label>
            <div class="form-error" id="login-error" role="alert" hidden></div>
            <button class="button primary wide" type="submit" id="login-submit">Ingresar</button>
            <button class="text-button centered" id="forgot-password" type="button">Olvidé mi contraseña</button>
          </form>
          <div class="demo-note">${integrationNote}</div>
        </div>
      </section>
    </main>`;
}

export function bindLogin({ onSubmit }) {
  document.querySelector('[data-toggle-password]')?.addEventListener('click', (event) => {
    const input = document.querySelector('input[name="password"]');
    input.type = input.type === 'password' ? 'text' : 'password';
    event.currentTarget.textContent = input.type === 'password' ? 'Ver' : 'Ocultar';
  });

  document.querySelector('#forgot-password')?.addEventListener('click', () => { window.location.hash = '#/recuperar'; });

  document.querySelector('#login-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const button = document.querySelector('#login-submit');
    const errorBox = document.querySelector('#login-error');
    errorBox.hidden = true;
    button.disabled = true;
    button.textContent = 'Ingresando…';
    try {
      await onSubmit?.({
        documentNumber: String(data.get('document') || '').trim(),
        password: String(data.get('password') || ''),
      });
    } catch (error) {
      errorBox.textContent = error?.message || 'No pudimos iniciar sesión.';
      errorBox.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = 'Ingresar';
    }
  });
}
