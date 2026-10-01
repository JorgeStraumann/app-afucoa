import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  PROD_PROJECT_REF,
  assertProdDryRunTarget,
  prodSecretCredentialsFromEnv,
  summarizeProdCohortReport,
} from '../scripts/lib/prod-cohort-cli.mjs';

test('preflight acepta solo el proyecto PROD confirmado exactamente', () => {
  assert.doesNotThrow(() => assertProdDryRunTarget(`https://${PROD_PROJECT_REF}.supabase.co`, PROD_PROJECT_REF));
  assert.throws(() => assertProdDryRunTarget('https://imiplnspvmsrsuikulwm.supabase.co', PROD_PROJECT_REF), /Destino rechazado/);
  assert.throws(() => assertProdDryRunTarget(`https://${PROD_PROJECT_REF}.supabase.co`, 'imiplnspvmsrsuikulwm'), /Destino rechazado/);
});

test('preflight exige Secret API Key moderna y bloquea claves privilegiadas VITE', () => {
  const safe = {
    SUPABASE_URL: `https://${PROD_PROJECT_REF}.supabase.co`,
    SUPABASE_SECRET_KEY: ['sb', 'secret', 'test-only-value'].join('_'),
  };
  assert.equal(prodSecretCredentialsFromEnv(safe).secretKey, safe.SUPABASE_SECRET_KEY);
  assert.throws(() => prodSecretCredentialsFromEnv({ ...safe, SUPABASE_SECRET_KEY: 'legacy-value' }), /Secret API Key moderna/);
  assert.throws(() => prodSecretCredentialsFromEnv({ ...safe, VITE_SUPABASE_SECRET_KEY: safe.SUPABASE_SECRET_KEY }), /prefijo VITE/);
});

test('resumen publico agrega conflictos sin exponer identidades', () => {
  const summary = summarizeProdCohortReport({
    summary: { ready: 2, unchanged: 1, rejected: 2 },
    items: [
      { status: 'ready', document_number: '11111111' },
      { status: 'ready', document_number: '22222222' },
      { status: 'unchanged', document_number: '33333333' },
      { status: 'rejected', rejection_reason: 'email_auth_en_uso', document_number: '44444444' },
      { status: 'rejected', rejection_reason: 'perfil_existente_sin_trazabilidad_v1', document_number: '55555555' },
    ],
  });
  assert.deepEqual(summary, { input_rows: 5, ready: 2, unchanged: 1, rejected: 2, profile_conflicts: 1, auth_conflicts: 1, conflicts: 2 });
  assert.doesNotMatch(JSON.stringify(summary), /11111111|55555555/);
});

test('comando PROD es dry-run only, maximo cinco y no acepta service_role legacy', async () => {
  const [script, runner] = await Promise.all([
    readFile(new URL('../scripts/prod-cohort-dry-run.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/run-prod-cohort-dry-run.ps1', import.meta.url), 'utf8'),
  ]);
  assert.match(script, /no implementa --apply/);
  assert.match(script, /PROD_COHORT_MAX_MEMBERS/);
  assert.match(script, /changes_applied: false/);
  assert.doesNotMatch(script, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(runner, /SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(runner, /Write-Host|Get-ChildItem\s+Env:/i);
});
