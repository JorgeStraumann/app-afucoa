import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateRecoveryPassword } from '../src/services/password-policy.js';

const requestSource = await readFile(new URL('../supabase/functions/request-password-recovery/index.ts', import.meta.url), 'utf8');
const confirmSource = await readFile(new URL('../supabase/functions/confirm-password-recovery/index.ts', import.meta.url), 'utf8');
const emailSource = await readFile(new URL('../supabase/functions/_shared/recovery-email.ts', import.meta.url), 'utf8');
const prodLiveSource = await readFile(new URL('./password-recovery-prod-live.mjs', import.meta.url), 'utf8');
const sandboxSource = await readFile(new URL('./brevo-sandbox-live.mjs', import.meta.url), 'utf8');
const prodWrapper = await readFile(new URL('../scripts/run-recovery-live-prod.ps1', import.meta.url), 'utf8');

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
  assert.match(requestSource, /loadRecoveryEmailConfig/);
  assert.match(emailSource, /RECOVERY_EMAIL_PROVIDER/);
  assert.match(emailSource, /RESEND_API_KEY/);
  assert.match(emailSource, /BREVO_API_KEY/);
  assert.match(emailSource, /RECOVERY_EMAIL_FROM/);
  assert.match(emailSource, /https:\/\/api\.brevo\.com\/v3\/smtp\/email/);
  assert.doesNotMatch(emailSource, /metadata|tracking/i);
});

test('las dos funciones aceptan preflight solo desde orígenes permitidos', () => {
  for (const source of [requestSource, confirmSource]) {
    assert.match(source, /request\.method === 'OPTIONS'/);
    assert.match(source, /runtime-config\.ts/);
    assert.match(source, /requestOriginAllowed/);
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

test('el harness PROD es sintético, cleanup-safe y no persiste secretos', () => {
  assert.match(prodLiveSource, /phase_final_recovery_prod_synthetic/);
  assert.match(prodLiveSource, /auth\.signOut\(\{ scope: 'local' \}\)/);
  assert.match(prodLiveSource, /auth\.admin\.deleteUser/);
  assert.match(prodLiveSource, /password_recovery_codes/);
  assert.match(prodLiveSource, /password_recovery_rate_limits/);
  assert.match(prodLiveSource, /storage_objects: 0/);
  assert.match(prodLiveSource, /readMaskedCode/);
  assert.doesNotMatch(prodLiveSource, /console\.(?:log|error)\([^\n]*(?:realCode|initialPassword|newPassword|recipient)/);
});

test('el sandbox Brevo usa drop y el wrapper mantiene secrets fuera de archivos', () => {
  assert.match(sandboxSource, /'X-Sib-Sandbox': 'drop'/);
  assert.match(sandboxSource, /response\.status, 201/);
  assert.match(prodWrapper, /AFUCOA_PROD_SECRET_KEY/);
  assert.match(prodWrapper, /BREVO_API_KEY/);
  assert.match(prodWrapper, /Read-Host[^\n]+-MaskInput/g);
  assert.match(prodWrapper, /functions deploy request-password-recovery confirm-password-recovery/);
  assert.doesNotMatch(prodWrapper, /\.env|Out-File|Set-Content|Add-Content/);
});
