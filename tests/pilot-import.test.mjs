import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepareMemberCsv, preparedCsv, runPilotImport, rollbackPilot, authEmailForDocument } from '../scripts/lib/pilot-members.mjs';
import { assertDevTarget, publicReport, DEV_PROJECT_REF } from '../scripts/lib/pilot-cli.mjs';
import { PROFILE_ACTIVITY_REFERENCES } from '../scripts/lib/pilot-supabase-adapter.mjs';

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

test('rollback elimina perfil sin actividad y sigue siendo idempotente al repetirse y reimportar', async () => {
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
  assert.equal(rollback.deleted, 2);
  assert.ok(rollback.items.every(item => item.status === 'deleted' && item.auth_user_deleted));
  assert.equal(adapter.auth.size, 0);
  assert.equal(adapter.profiles.size, 0);
  const repeated = await rollbackPilot({ journal: { batch_id: first.batch_id, rollback: first.rollback }, adapter });
  assert.equal(repeated.deleted, 2);
  assert.ok(repeated.items.every(item => item.status === 'deleted' && item.idempotent_replay));

  const reimported = await runPilotImport({ rows, adapter, batchId: 'pilot01-test-idempotent', apply: true });
  assert.equal(reimported.summary.imported, 2);
  assert.equal(reimported.summary.rejected, 0);
  assert.equal(adapter.auth.size, 2);
  assert.equal(adapter.profiles.size, 2);
  const repeatedImport = await runPilotImport({ rows, adapter, batchId: 'pilot01-test-idempotent', apply: true });
  assert.equal(repeatedImport.summary.unchanged, 2);
  assert.equal(repeatedImport.summary.auth_created, 0);
});

test('rollback preserva socio con trámite y propuesta, invalida acceso y bloquea apropiación histórica', async () => {
  const row = prepareMemberCsv(fs.readFileSync(fixture, 'utf8')).accepted[0];
  const adapter = new MemoryAdapter();
  const imported = await runPilotImport({ rows:[row], adapter, batchId:'pilot01-test-history', apply:true });
  const profileId = imported.items[0].profile_id;
  const authUserId = imported.items[0].auth_user_id;
  adapter.addActivity(profileId, 'requests', 'profile_id');
  adapter.addActivity(profileId, 'proposals', 'profile_id');

  const rollback = await rollbackPilot({ journal:{ batch_id:imported.batch_id, rollback:imported.rollback }, adapter });
  assert.equal(rollback.deactivated_preserved_history, 1);
  assert.equal(rollback.items[0].status, 'deactivated_preserved_history');
  assert.deepEqual(rollback.items[0].activity.dependencies.map(item => item.table), ['requests', 'proposals']);
  assert.equal(rollback.items[0].auth_user_deleted, true);
  assert.deepEqual(adapter.profiles.get(profileId), {
    ...adapter.profiles.get(profileId),
    auth_user_id: null,
    status: 'inactivo',
  });
  assert.equal(adapter.auth.has(authUserId), false);
  assert.ok(adapter.events.indexOf(`profile-inactive:${profileId}`) < adapter.events.indexOf(`auth-delete:${authUserId}`));

  const repeated = await rollbackPilot({ journal:{ batch_id:imported.batch_id, rollback:imported.rollback }, adapter });
  assert.equal(repeated.deactivated_preserved_history, 1);
  assert.equal(repeated.items[0].idempotent_replay, true);

  const reimport = await runPilotImport({ rows:[row], adapter, batchId:'pilot01-test-history', apply:true });
  assert.equal(reimport.summary.rejected, 1);
  assert.equal(reimport.items[0].rejection_reason, 'perfil_historico_inactivo_requiere_revision');
  assert.equal(adapter.auth.size, 0);
  assert.equal(adapter.profiles.get(profileId).auth_user_id, null);

  const wrongIdentity = await runPilotImport({
    rows:[{ ...row, migration_external_id:'V1-HISTORICO-DISTINTO' }],
    adapter,
    batchId:'pilot01-test-wrong-history',
    apply:true,
  });
  assert.equal(wrongIdentity.summary.rejected, 1);
  assert.equal(wrongIdentity.items[0].rejection_reason, 'perfil_existente_sin_trazabilidad_v1');
  assert.equal(adapter.auth.size, 0);
});

test('catálogo de actividad cubre negocio, mensajes y auditoría', () => {
  const references = new Set(PROFILE_ACTIVITY_REFERENCES.map(([table, column]) => `${table}.${column}`));
  for (const required of ['requests.profile_id', 'proposals.profile_id', 'request_messages.author_profile_id', 'request_files.uploaded_by', 'audit_log.actor_profile_id']) {
    assert.equal(references.has(required), true, `falta ${required}`);
  }
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
  constructor() { this.profiles = new Map(); this.auth = new Map(); this.activity = new Map(); this.events = []; this.profileSequence = 0; this.authSequence = 0; }
  async findProfiles(row) { return [...this.profiles.values()].filter(p => (p.migration_source === row.migration_source && p.migration_external_id === row.migration_external_id) || p.document_number === row.document_number || p.member_number === row.member_number); }
  async findProfileByAuthUser(id) { return [...this.profiles.values()].find(p => p.auth_user_id === id) || null; }
  async getProfile(id) { return this.profiles.get(id) || null; }
  async getProfileActivity(id) { const dependencies=this.activity.get(id) || []; return { has_activity:dependencies.length > 0, dependencies:structuredClone(dependencies) }; }
  async findAuthUserByEmail(email) { return [...this.auth.values()].find(user => user.email.toLowerCase() === email.toLowerCase()) || null; }
  async getAuthUser(id) { return this.auth.get(id) || null; }
  async createAuthUser(attributes) { const id=`auth-${++this.authSequence}`; const user={ id, email:attributes.email, app_metadata:attributes.app_metadata }; this.auth.set(id,user); return user; }
  async deleteAuthUser(id) { this.events.push(`auth-delete:${id}`); this.auth.delete(id); }
  async createProfile(payload) { const id=`profile-${++this.profileSequence}`; const profile={id,...payload}; this.profiles.set(id,profile); return profile; }
  async updateProfile(id,patch) { const profile={...this.profiles.get(id),...patch}; this.profiles.set(id,profile); if (patch.status === 'inactivo' && patch.auth_user_id === null) this.events.push(`profile-inactive:${id}`); return profile; }
  async deleteProfile(id) { this.events.push(`profile-delete:${id}`); this.profiles.delete(id); }
  addActivity(id, table, column, count=1) { const rows=this.activity.get(id) || []; rows.push({table,column,count}); this.activity.set(id,rows); }
}
