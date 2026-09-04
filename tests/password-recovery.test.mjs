import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateRecoveryPassword } from '../src/services/password-policy.js';

const requestSource = await readFile(new URL('../supabase/functions/request-password-recovery/index.ts', import.meta.url), 'utf8');
const confirmSource = await readFile(new URL('../supabase/functions/confirm-password-recovery/index.ts', import.meta.url), 'utf8');

test('la política exige 12–72 caracteres y cuatro clases', () => {
  assert.equal(validateRecoveryPassword('Valida-2026!x'), '');
  assert.match(validateRecoveryPassword('Corta-1!'), /12 y 72/);
  assert.match(validateRecoveryPassword('SINMINUSCULA-1!'), /minúscula/);
  assert.match(validateRecoveryPassword('sinmayuscula-1!'), /mayúscula/);
  assert.match(validateRecoveryPassword('SinNumero--!'), /número/);
  assert.match(validateRecoveryPassword('SinSimbolo123'), /símbolo/);
  assert.match(validateRecoveryPassword(`Aa1!${'x'.repeat(69)}`), /12 y 72/);
});

test('la solicitud conserva respuesta neutra y no devuelve el código', () => {
  assert.match(requestSource, /Si la cuenta está habilitada, recibirás un código en breve/);
  assert.doesNotMatch(requestSource, /return json\(request,\s*\{[^}]*code/s);
  assert.match(requestSource, /HMAC/);
  assert.match(requestSource, /request_ip/);
  assert.match(requestSource, /request_identity/);
  assert.match(requestSource, /RESEND_API_KEY/);
  assert.match(requestSource, /RECOVERY_EMAIL_FROM/);
});

test('las dos funciones aceptan preflight solo desde orígenes permitidos', () => {
  for (const source of [requestSource, confirmSource]) {
    assert.match(source, /request\.method === 'OPTIONS'/);
    assert.match(source, /https:\/\/jorgestraumann\.github\.io/);
    assert.match(source, /origin_not_allowed/);
  }
});

test('la confirmación exige código de 8 dígitos y usa consumo atómico', () => {
  assert.match(confirmSource, /\^\\d\{8\}\$/);
  assert.match(confirmSource, /consume_password_recovery_code/);
  assert.match(confirmSource, /confirm_ip/);
  assert.match(confirmSource, /confirm_identity/);
  assert.match(confirmSource, /updateUserById/);
  assert.doesNotMatch(confirmSource, /console\.(?:log|error)\(\s*(?:code|newPassword|document|body|request)\b/);
});
