import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const live = await readFile(new URL('./prod-synthetic-readiness-live.mjs', import.meta.url), 'utf8');
const runner = await readFile(new URL('../scripts/run-prod-synthetic-readiness.ps1', import.meta.url), 'utf8');

test('suite LIVE queda fijada exclusivamente a PROD y exige confirmación exacta', () => {
  assert.match(live, /rywdochyzhgfaymrmxek/);
  assert.match(live, /AFUCOA_PROD_SYNTHETIC_CONFIRM/);
  assert.match(live, /supabaseUrl !== PROD_URL/);
});

test('identidades son inequívocamente sintéticas y el baseline debe estar vacío', () => {
  assert.match(live, /prod-readiness-e01-e02/);
  assert.match(live, /prod_readiness_synthetic/);
  assert.match(live, /Auth users = 0/);
  assert.match(live, /Preflight PROD vacío/);
});

test('cleanup obligatorio usa logout local y verifica cero final', () => {
  assert.match(live, /signOut\(\{ scope: 'local' \}\)/);
  assert.doesNotMatch(live, /\.auth\.signOut\(\s*\)/);
  assert.match(live, /Cleanup verificado/);
  assert.match(live, /cleanup_verified_zero/);
  assert.match(live, /finally \{/);
});

test('E01 cubre RLS, Auth, MFA, Storage, trámites, propuestas y notificaciones', () => {
  for (const token of [
    'Admin AAL1 no obtiene privilegios RLS', 'opera en AAL2', 'Aislamiento perfil', 'Aislamiento trámite',
    'Archivo privado propio', 'Propuesta recibida', 'Notificación visible', 'QR vigente', 'Códigos de recuperación',
  ]) assert.match(live, new RegExp(token));
});

test('E02 está acotada y valida concurrencia y rate limiting sin enviar email/push', () => {
  assert.match(live, /length: 30/);
  assert.match(live, /length: 20/);
  assert.match(live, /Rate limiting concurrente permite 3 y bloquea 5/);
  assert.doesNotMatch(live, /request-password-recovery|send-notification-push/);
});

test('runner obtiene claves solo en memoria y restaura el entorno', () => {
  assert.match(runner, /projects api-keys/);
  assert.match(runner, /--reveal/);
  assert.match(runner, /finally \{/);
  assert.match(runner, /Remove-Item "Env:\$name"/);
  assert.doesNotMatch(runner, /Write-Host|Out-File|Set-Content|Add-Content|\.env/);
});

