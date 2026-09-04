export const RECOVERY_PASSWORD_MIN_LENGTH = 12;
export const RECOVERY_PASSWORD_MAX_LENGTH = 72;

export function validateRecoveryPassword(password = '') {
  const value = String(password);
  if (value.length < RECOVERY_PASSWORD_MIN_LENGTH || value.length > RECOVERY_PASSWORD_MAX_LENGTH) {
    return 'Usá entre 12 y 72 caracteres.';
  }
  if (!/[a-záéíóúüñ]/.test(value)) return 'Incluí al menos una letra minúscula.';
  if (!/[A-ZÁÉÍÓÚÜÑ]/.test(value)) return 'Incluí al menos una letra mayúscula.';
  if (!/\d/.test(value)) return 'Incluí al menos un número.';
  if (!/[^\p{L}\p{N}\s]/u.test(value)) return 'Incluí al menos un símbolo.';
  return '';
}
