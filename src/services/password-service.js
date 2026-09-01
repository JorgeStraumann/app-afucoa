import { appMode, requireSupabase } from './supabase.js';
import { normalizeDocument } from './auth-service.js';

export async function requestPasswordRecovery(documentNumber) {
  const document = normalizeDocument(documentNumber);
  if (document.length < 6) throw new Error('Ingresá una cédula válida.');
  if (appMode !== 'supabase') return { demo: true, message: 'Código de demostración: 123456' };
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('request-password-recovery', { body: { document_number: document } });
  if (error) throw new Error('No pudimos iniciar la recuperación. Intentá nuevamente.');
  return data;
}

export async function confirmPasswordRecovery({ documentNumber, code, newPassword }) {
  const document = normalizeDocument(documentNumber);
  if (newPassword.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
  if (appMode !== 'supabase') {
    if (code !== '123456') throw new Error('Código incorrecto.');
    return { demo: true };
  }
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('confirm-password-recovery', {
    body: { document_number: document, code, new_password: newPassword },
  });
  if (error) throw new Error('No pudimos cambiar la contraseña. Verificá el código e intentá nuevamente.');
  return data;
}
