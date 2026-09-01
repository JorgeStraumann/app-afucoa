import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepareMemberCsv, preparedCsv, runPilotImport, rollbackPilot, authEmailForDocument } from '../scripts/lib/pilot-members.mjs';
import { assertDevTarget, publicReport, DEV_PROJECT_REF } from '../scripts/lib/pilot-cli.mjs';

const fixture = new URL('./fixtures/pilot-v1-sample.csv', import.meta.url);

test('preparación valida dígito, duplicados y conserva trazabilidad', () => {
  const result = prepareMemberCsv(fs.readFileSync(fixture, 'utf8'));
  assert.equal(result.accepted.length, 5);
  assert.equal(result.rejected.length, 3);
  assert.deepEqual(result.rejected.map(row => row.reasons[0]), ['cedula_duplicada_en_archivo', 'cedula_invalida', 'cedula_duplicada_en_archivo']);
  assert.ok(result.accepted.every(row => row.migration_source === 'v1' && row.migration_external_id === row.member_number));
  const output = preparedCsv(result.accepted);
  assert.match(output, /migration_source;migration_external_id/);
  assert.doesNotMatch(output.toLowerCase(), /password|contraseña/);
  assert.throws(() => prepareMemberCsv('cedula;ficha;nombre;apellido;estado;password\n1.234.567-2;P1;A;B;activo;vieja'), /columnas prohibidas/);
});

test('importación es idempotente y rollback elimina solo el lote', async () => {
  const rows = prepareMemberCsv(fs.readFileSync(fixture, 'utf8')).accepted.slice(0, 2);
  const adapter = new MemoryAdapter();
  const first = await runPilotImport({ rows, adapter, batchId: 'pilot01-test-idempotent', apply: true });
  assert.deepEqual(first.summary, { ready: 0, imported: 2, unchanged: 0, rejected: 0, auth_created: 2, profiles_linked: 2 });
  assert.equal(adapter.auth.size, 2);
  assert.equal(adapter.profiles.size, 2);
  assert.equal(first.credentials.length, 2);
  assert.ok(first.credentials.every(item => item.temporary_password.length >= 20));

  const second = await runPilotImport({ rows, adapter, batchId: 'pilot01-test-idempotent', apply: true });
  assert.equal(second.summary.imported, 0);
  assert.equal(second.summary.unchanged, 2);
  assert.equal(second.summary.auth_created, 0);
  assert.equal(adapter.auth.size, 2);
  assert.equal(adapter.profiles.size, 2);

  const rollback = await rollbackPilot({ journal: { batch_id: first.batch_id, rollback: first.rollback }, adapter });
  assert.equal(rollback.rolled_back, 2);
  assert.equal(adapter.auth.size, 0);
  assert.equal(adapter.profiles.size, 0);
  const repeated = await rollbackPilot({ journal: { batch_id: first.batch_id, rollback: first.rollback }, adapter });
  assert.equal(repeated.already_absent, 2);
});

test('no reutiliza un email Auth ajeno a la trazabilidad V1', async () => {
  const row = prepareMemberCsv(fs.readFileSync(fixture, 'utf8')).accepted[0];
  const adapter = new MemoryAdapter();
  adapter.auth.set('auth-existing', { id:'auth-existing', email:authEmailForDocument(row.document_number), app_metadata:{} });
  const report = await runPilotImport({ rows:[row], adapter, batchId:'pilot01-test-conflict', apply:true });
  assert.equal(report.summary.rejected, 1);
  assert.equal(report.items[0].rejection_reason, 'email_auth_en_uso');
  assert.equal(adapter.profiles.size, 0);
});

test('bloquea destinos distintos de DEV y separa credenciales del reporte', () => {
  assert.doesNotThrow(() => assertDevTarget(`https://${DEV_PROJECT_REF}.supabase.co`, DEV_PROJECT_REF));
  assert.throws(() => assertDevTarget('https://produccion.supabase.co', DEV_PROJECT_REF), /Destino rechazado/);
  const clean = publicReport({ summary:{rejected:0}, items:[], rollback:[{secret:true}], credentials:[{temporary_password:'secret'}] });
  assert.equal('credentials' in clean, false);
  assert.equal('rollback' in clean, false);
  assert.doesNotMatch(JSON.stringify(clean), /secret/);
});

class MemoryAdapter {
  constructor() { this.profiles = new Map(); this.auth = new Map(); this.profileSequence = 0; this.authSequence = 0; }
  async findProfiles(row) { return [...this.profiles.values()].filter(p => (p.migration_source === row.migration_source && p.migration_external_id === row.migration_external_id) || p.document_number === row.document_number || p.member_number === row.member_number); }
  async findProfileByAuthUser(id) { return [...this.profiles.values()].find(p => p.auth_user_id === id) || null; }
  async getProfile(id) { return this.profiles.get(id) || null; }
  async findAuthUserByEmail(email) { return [...this.auth.values()].find(user => user.email.toLowerCase() === email.toLowerCase()) || null; }
  async getAuthUser(id) { return this.auth.get(id) || null; }
  async createAuthUser(attributes) { const id=`auth-${++this.authSequence}`; const user={ id, email:attributes.email, app_metadata:attributes.app_metadata }; this.auth.set(id,user); return user; }
  async deleteAuthUser(id) { this.auth.delete(id); }
  async createProfile(payload) { const id=`profile-${++this.profileSequence}`; const profile={id,...payload}; this.profiles.set(id,profile); return profile; }
  async updateProfile(id,patch) { const profile={...this.profiles.get(id),...patch}; this.profiles.set(id,profile); return profile; }
  async deleteProfile(id) { this.profiles.delete(id); }
}
