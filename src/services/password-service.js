import { appMode, requireSupabase } from './supabase.js';
import { normalizeDocument } from './auth-service.js';
import { validateRecoveryPassword } from './password-policy.js';

export { validateRecoveryPassword } from './password-policy.js';

export async function requestPasswordRecovery(documentNumber) {
  const document = normalizeDocument(documentNumber);
  if (document.length < 6) throw new Error('Ingresá una cédula válida.');
  if (appMode !== 'supabase') return { demo: true, message: 'Código de demostración: 12345678' };
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('request-password-recovery', { body: { document_number: document } });
  if (error) throw new Error('No pudimos iniciar la recuperación. Intentá nuevamente.');
  return data;
}

export async function confirmPasswordRecovery({ documentNumber, code, newPassword }) {
  const document = normalizeDocument(documentNumber);
  if (!/^\d{8}$/.test(String(code || ''))) throw new Error('Ingresá el código de 8 dígitos.');
  const passwordError = validateRecoveryPassword(newPassword);
  if (passwordError) throw new Error(passwordError);
  if (appMode !== 'supabase') {
    if (code !== '12345678') throw new Error('Código inválido o vencido.');
    return { demo: true };
  }
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('confirm-password-recovery', {
    body: { document_number: document, code, new_password: newPassword },
  });
  if (error) {
    const response = await error.context?.json?.().catch(() => null);
    if (response?.error === 'invalid_password') throw new Error('La contraseña no cumple los requisitos de seguridad.');
    if (!response || response.error === 'temporarily_unavailable') {
      throw new Error('No pudimos completar el cambio. Intentá más tarde y solicitá un código nuevo.');
    }
    throw new Error('Código inválido o vencido. Solicitá uno nuevo si es necesario.');
  }
  return data;
}
