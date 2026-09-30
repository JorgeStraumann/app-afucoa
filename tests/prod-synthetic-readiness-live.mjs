import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createClient } from '@supabase/supabase-js';

const PROJECT_REF = 'rywdochyzhgfaymrmxek';
const PROD_URL = `https://${PROJECT_REF}.supabase.co`;
const PROD_ORIGIN = 'https://afucoa-v2-prod.pages.dev';
const confirmation = process.env.AFUCOA_PROD_SYNTHETIC_CONFIRM || '';
const supabaseUrl = process.env.SUPABASE_URL || '';
const publishableKey = process.env.AFUCOA_PROD_PUBLISHABLE_KEY || '';
const secretKey = process.env.SUPABASE_SECRET_KEY || '';

if (confirmation !== PROJECT_REF) throw new Error('Falta la confirmación exacta del project ref PROD.');
if (supabaseUrl !== PROD_URL) throw new Error('SUPABASE_URL no corresponde exclusivamente a AFUCOA V2 PROD.');
if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) throw new Error('Falta la publishable key PROD.');
if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(secretKey)) throw new Error('Falta una Secret API Key PROD válida.');

const secretBearer = `Bearer ${secretKey}`;
const secretFetch = async (input, init = {}) => {
  const headers = new Headers(init.headers);
  if (headers.get('authorization') === secretBearer) headers.delete('authorization');
  return fetch(input, { ...init, headers });
};
const adminClient = createClient(PROD_URL, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: secretFetch },
});
const publicClient = () => createClient(PROD_URL, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const ZERO_TABLES = [
  'profiles', 'agreements', 'agreement_locations', 'agreement_favorites', 'request_definitions',
  'requests', 'request_events', 'request_files', 'request_drafts', 'request_messages', 'content_items',
  'documents', 'document_versions', 'document_favorites', 'proposals', 'proposal_supports',
  'proposal_moderation_events', 'notifications', 'notification_recipients', 'notification_preferences',
  'push_devices', 'membership_verification_tokens', 'audit_log', 'notification_campaigns',
  'password_recovery_codes', 'password_recovery_rate_limits', 'notification_push_deliveries',
];
const created = {
  users: [], profiles: [], storage: [], agreements: [], definitions: [], requests: [], proposals: [],
  notifications: [], documents: [],
};
const clients = [];
const checks = [];
const marker = `e01e02-${Date.now()}-${randomBytes(4).toString('hex')}`;
const rateHash = createHash('sha256').update(marker).digest('hex');
let cleanupVerified = false;

function safeError(error) {
  if (!error) return '';
  return String(error.message || error).replace(/[A-Za-z0-9_-]{32,}/g, '[redacted]').slice(0, 240);
}

function check(name, condition, detail = '') {
  checks.push({ name, pass: Boolean(condition), detail: String(detail || '').slice(0, 240) });
  assert.ok(condition, `${name}${detail ? `: ${detail}` : ''}`);
}

function strongPassword() {
  return `Aa1!${randomBytes(32).toString('base64url')}`;
}

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = String(value).replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  let bits = '';
  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('TOTP sintético inválido.');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

function totp(secret, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 30_000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

async function tableCount(table) {
  const { count, error } = await adminClient.from(table).select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

async function assertEmptyBaseline(label) {
  const { data: users, error: userError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (userError) throw userError;
  check(`${label}: Auth users = 0`, (users?.users?.length ?? -1) === 0, `count=${users?.users?.length ?? -1}`);
  for (const table of ZERO_TABLES) {
    const count = await tableCount(table);
    check(`${label}: ${table} = 0`, count === 0, `count=${count}`);
  }
}

async function createIdentity(role, ordinal) {
  const documentNumber = `98${String(Date.now()).slice(-4)}${String(ordinal).padStart(2, '0')}`;
  const email = `${marker}-${role}-${ordinal}@auth.afucoa.local`;
  const password = strongPassword();
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { synthetic_test: 'prod-readiness-e01-e02', marker },
  });
  if (error) throw error;
  const identity = { role, ordinal, email, password, authUserId: data.user.id, profileId: null, client: null };
  created.users.push(identity);
  const { data: profile, error: profileError } = await adminClient.from('profiles').insert({
    auth_user_id: identity.authUserId,
    role,
    first_name: 'Synthetic',
    last_name: `Readiness ${role}`,
    document_number: documentNumber,
    member_number: `SYN-${role.toUpperCase()}-${String(Date.now()).slice(-6)}-${ordinal}`,
    status: 'activo',
    migration_source: 'prod_readiness_synthetic',
    migration_external_id: `${marker}-${role}-${ordinal}`,
  }).select('id').single();
  if (profileError) throw profileError;
  identity.profileId = profile.id;
  created.profiles.push(profile.id);
  return identity;
}

async function login(identity) {
  const client = publicClient();
  clients.push(client);
  const { data, error } = await client.auth.signInWithPassword({ email: identity.email, password: identity.password });
  if (error) throw error;
  identity.client = client;
  check(`Login ${identity.role} sintético`, Boolean(data.session?.access_token));
  return client;
}

async function enrollMfa(identity) {
  const { data: enrolled, error: enrollError } = await identity.client.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `AFUCOA PROD ${marker}`,
  });
  if (enrollError) throw enrollError;
  const { data: challenged, error: challengeError } = await identity.client.auth.mfa.challenge({ factorId: enrolled.id });
  if (challengeError) throw challengeError;
  const { error: verifyError } = await identity.client.auth.mfa.verify({
    factorId: enrolled.id,
    challengeId: challenged.id,
    code: totp(enrolled.totp.secret),
  });
  if (verifyError) throw verifyError;
  const { data: assurance, error: assuranceError } = await identity.client.auth.mfa.getAuthenticatorAssuranceLevel();
  check(`${identity.role} opera en AAL2`, !assuranceError && assurance.currentLevel === 'aal2', safeError(assuranceError));
}

async function visibleCount(client, table, column, value) {
  const { count, error } = await client.from(table).select('*', { count: 'exact', head: true }).eq(column, value);
  return { count: count ?? 0, error };
}

async function boundedMeasurements(tasks, concurrency = 5) {
  const samples = [];
  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length) {
      const index = cursor++;
      const started = performance.now();
      const ok = await tasks[index]();
      samples.push({ ok, ms: performance.now() - started });
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  const latencies = samples.map(sample => sample.ms).sort((a, b) => a - b);
  const percentile = p => Math.round(latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * p) - 1)] || 0);
  return {
    requests: samples.length,
    succeeded: samples.filter(sample => sample.ok).length,
    failed: samples.filter(sample => !sample.ok).length,
    p50_ms: percentile(0.5),
    p95_ms: percentile(0.95),
    concurrency,
  };
}

async function exerciseE01() {
  const anon = publicClient();
  // Sequential creation keeps cleanup deterministic even if one admin call fails.
  const socioA = await createIdentity('socio', 1);
  const socioB = await createIdentity('socio', 2);
  const admin = await createIdentity('admin', 3);
  const superadmin = await createIdentity('superadmin', 4);
  await Promise.all([login(socioA), login(socioB), login(admin), login(superadmin)]);

  const adminAal1 = await visibleCount(admin.client, 'profiles', 'id', socioA.profileId);
  check('Admin AAL1 no obtiene privilegios RLS', !adminAal1.error && adminAal1.count === 0, safeError(adminAal1.error));
  await enrollMfa(admin);
  await enrollMfa(superadmin);

  for (const identity of [socioA, socioB, admin, superadmin]) {
    const { data, error } = await identity.client.rpc('get_my_profile');
    check(`get_my_profile ${identity.role}`, !error && data?.[0]?.role === identity.role, safeError(error));
  }
  for (const [label, client, expected] of [
    ['anon', anon, 0], ['socio A', socioA.client, 1], ['socio B', socioB.client, 0],
    ['admin AAL2', admin.client, 1], ['superadmin AAL2', superadmin.client, 1],
  ]) {
    const result = await visibleCount(client, 'profiles', 'id', socioA.profileId);
    check(`Aislamiento perfil socio A — ${label}`, !result.error && result.count === expected, safeError(result.error));
  }

  const contact = await socioA.client.rpc('update_my_contact', { p_email: `${marker}@example.invalid`, p_phone: '+59800000000' });
  const profileAfter = await socioA.client.rpc('get_my_profile');
  check('Mi Cuenta modifica solo contacto propio', !contact.error && profileAfter.data?.[0]?.email === `${marker}@example.invalid`, safeError(contact.error));
  const escalation = await socioA.client.from('profiles').update({ role: 'superadmin' }).eq('id', socioA.profileId).select('id');
  check('Socio no puede escalar rol', Boolean(escalation.error) || (escalation.data?.length ?? 0) === 0, safeError(escalation.error));

  const agreement = await admin.client.from('agreements').insert({
    name: `Convenio ${marker}`, slug: marker, category: 'Sintético', short_benefit: 'Validación', status: 'publicado',
  }).select('id').single();
  if (agreement.error) throw agreement.error;
  created.agreements.push(agreement.data.id);
  const agreementVisible = await visibleCount(socioA.client, 'agreements', 'id', agreement.data.id);
  check('Convenio publicado visible al socio', !agreementVisible.error && agreementVisible.count === 1, safeError(agreementVisible.error));
  const favorite = await socioA.client.from('agreement_favorites').insert({ profile_id: socioA.profileId, agreement_id: agreement.data.id });
  check('Favorito propio permitido', !favorite.error, safeError(favorite.error));
  const foreignFavorite = await socioB.client.from('agreement_favorites').insert({ profile_id: socioA.profileId, agreement_id: agreement.data.id });
  check('Favorito ajeno rechazado', Boolean(foreignFavorite.error), safeError(foreignFavorite.error));

  const definition = await admin.client.from('request_definitions').insert({
    name: `Trámite ${marker}`, slug: marker, category: 'Sintético', description: 'Validación RLS PROD',
    fields: [{ name: 'detalle', type: 'text', required: true }], active: true,
  }).select('id').single();
  if (definition.error) throw definition.error;
  created.definitions.push(definition.data.id);
  const draft = await socioA.client.rpc('save_my_request_draft', { p_definition_id: definition.data.id, p_payload: { detalle: marker }, p_current_step: 0 });
  check('Socio guarda borrador propio', !draft.error && Boolean(draft.data), safeError(draft.error));
  const submitted = await socioA.client.rpc('submit_my_request', { p_definition_id: definition.data.id, p_payload: { detalle: marker } });
  const request = submitted.data?.[0];
  check('Socio crea trámite', !submitted.error && Boolean(request?.id), safeError(submitted.error));
  created.requests.push(request.id);
  for (const [label, client, expected] of [['socio A', socioA.client, 1], ['socio B', socioB.client, 0], ['admin', admin.client, 1], ['anon', anon, 0]]) {
    const result = await visibleCount(client, 'requests', 'id', request.id);
    check(`Aislamiento trámite — ${label}`, !result.error && result.count === expected, safeError(result.error));
  }
  const ownMessage = await socioA.client.from('request_messages').insert({
    request_id: request.id, author_profile_id: socioA.profileId, body: `Mensaje ${marker}`, visible_to_member: true,
  }).select('id').single();
  check('Mensaje propio permitido', !ownMessage.error, safeError(ownMessage.error));
  const foreignMessage = await socioB.client.from('request_messages').insert({
    request_id: request.id, author_profile_id: socioB.profileId, body: 'Intrusión sintética', visible_to_member: true,
  });
  check('Mensaje ajeno rechazado', Boolean(foreignMessage.error), safeError(foreignMessage.error));
  const adminUpdate = await admin.client.rpc('admin_update_request', { p_request_id: request.id, p_status: 'en_revision', p_note: `QA ${marker}` });
  check('Admin AAL2 actualiza trámite', !adminUpdate.error && adminUpdate.data === true, safeError(adminUpdate.error));
  const socioAdminAttempt = await socioA.client.rpc('admin_update_request', { p_request_id: request.id, p_status: 'resuelta' });
  check('Socio no ejecuta operación admin', Boolean(socioAdminAttempt.error), safeError(socioAdminAttempt.error));

  const requestPath = `${request.id}/${marker}.pdf`;
  const pdf = new TextEncoder().encode('%PDF-1.4\n% AFUCOA PROD synthetic readiness\n');
  const upload = await socioA.client.storage.from('request-files').upload(requestPath, pdf, { contentType: 'application/pdf', upsert: false });
  check('Archivo privado propio permitido', !upload.error, safeError(upload.error));
  created.storage.push({ bucket: 'request-files', path: requestPath });
  const register = await socioA.client.rpc('register_my_request_file', {
    p_request_id: request.id, p_storage_path: requestPath, p_file_name: `${marker}.pdf`, p_mime_type: 'application/pdf',
  });
  check('Metadatos de archivo propio permitidos', !register.error, safeError(register.error));
  const signedA = await socioA.client.storage.from('request-files').createSignedUrl(requestPath, 60);
  const signedB = await socioB.client.storage.from('request-files').createSignedUrl(requestPath, 60);
  check('Socio A firma su archivo', !signedA.error && Boolean(signedA.data?.signedUrl), safeError(signedA.error));
  check('Socio B no firma archivo ajeno', Boolean(signedB.error) || !signedB.data?.signedUrl, safeError(signedB.error));

  const proposal = await socioA.client.rpc('create_my_proposal', {
    p_title: `Idea ${marker}`, p_description: `Descripción sintética completa para validar ${marker}.`,
  });
  if (proposal.error) throw proposal.error;
  created.proposals.push(proposal.data);
  const beforePublish = await visibleCount(socioB.client, 'proposals', 'id', proposal.data);
  check('Propuesta recibida no visible a otro socio', !beforePublish.error && beforePublish.count === 0, safeError(beforePublish.error));
  const moderate = await admin.client.rpc('admin_moderate_proposal', { p_proposal_id: proposal.data, p_status: 'publicada', p_note: `QA ${marker}` });
  check('Admin AAL2 publica propuesta', !moderate.error && moderate.data === true, safeError(moderate.error));
  const supportA1 = await socioA.client.rpc('support_proposal', { p_proposal_id: proposal.data });
  const supportA2 = await socioA.client.rpc('support_proposal', { p_proposal_id: proposal.data });
  const supportB = await socioB.client.rpc('support_proposal', { p_proposal_id: proposal.data });
  check('Apoyo idempotente por socio', !supportA1.error && supportA1.data === true && !supportA2.error && supportA2.data === false, safeError(supportA1.error || supportA2.error));
  check('Segundo socio puede apoyar', !supportB.error && supportB.data === true, safeError(supportB.error));
  const visibleProposals = await socioA.client.rpc('list_visible_proposals');
  const proposalView = visibleProposals.data?.find(row => row.id === proposal.data);
  check('Listado de propuestas informa autor y 2 apoyos', !visibleProposals.error && proposalView?.mine === true && Number(proposalView?.support_count) === 2, safeError(visibleProposals.error));

  const notification = await admin.client.from('notifications').insert({
    type: 'sistema', title: 'Sintética', body: 'Validación PROD', target_path: '/notificaciones',
  }).select('id').single();
  if (notification.error) throw notification.error;
  created.notifications.push(notification.data.id);
  const recipient = await admin.client.from('notification_recipients').insert({ notification_id: notification.data.id, profile_id: socioA.profileId });
  if (recipient.error) throw recipient.error;
  const notificationA = await visibleCount(socioA.client, 'notifications', 'id', notification.data.id);
  const notificationB = await visibleCount(socioB.client, 'notifications', 'id', notification.data.id);
  check('Notificación visible solo a destinatario', !notificationA.error && notificationA.count === 1 && !notificationB.error && notificationB.count === 0, safeError(notificationA.error || notificationB.error));
  const markRead = await socioA.client.rpc('mark_my_notification_read', { p_notification_id: notification.data.id });
  check('Destinatario marca notificación leída', !markRead.error && markRead.data === true, safeError(markRead.error));

  const token1 = await socioA.client.rpc('create_membership_verification_token');
  const raw1 = token1.data?.[0]?.token;
  const verify1 = await anon.rpc('verify_membership_token', { p_token: raw1 });
  const token2 = await socioA.client.rpc('create_membership_verification_token');
  const verifyOld = await anon.rpc('verify_membership_token', { p_token: raw1 });
  check('QR vigente verifica datos mínimos', !token1.error && !verify1.error && verify1.data?.length === 1, safeError(token1.error || verify1.error));
  check('Nuevo QR revoca el anterior', !token2.error && !verifyOld.error && verifyOld.data?.length === 0, safeError(token2.error || verifyOld.error));

  const documentPath = `synthetic/${marker}.pdf`;
  const documentUpload = await admin.client.storage.from('documents-private').upload(documentPath, pdf, { contentType: 'application/pdf', upsert: false });
  check('Admin AAL2 sube documento privado', !documentUpload.error, safeError(documentUpload.error));
  created.storage.push({ bucket: 'documents-private', path: documentPath });
  const document = await admin.client.from('documents').insert({
    title: `Documento ${marker}`, category: 'Sintético', storage_path: documentPath, status: 'publicado', is_current: true,
  }).select('id').single();
  if (document.error) throw document.error;
  created.documents.push(document.data.id);
  const documentA = await socioA.client.storage.from('documents-private').createSignedUrl(documentPath, 60);
  const documentAnon = await anon.storage.from('documents-private').createSignedUrl(documentPath, 60);
  check('Socio autenticado firma documento publicado', !documentA.error && Boolean(documentA.data?.signedUrl), safeError(documentA.error));
  check('Anónimo no firma documento privado', Boolean(documentAnon.error) || !documentAnon.data?.signedUrl, safeError(documentAnon.error));

  const auditAdmin = await admin.client.from('audit_log').select('id', { count: 'exact', head: true });
  const auditSocio = await socioA.client.from('audit_log').select('id', { count: 'exact', head: true });
  check('Admin AAL2 accede auditoría', !auditAdmin.error && (auditAdmin.count ?? 0) > 0, safeError(auditAdmin.error));
  check('Socio no accede auditoría', Boolean(auditSocio.error) || (auditSocio.count ?? 0) === 0, safeError(auditSocio.error));
  const recoveryAnon = await anon.from('password_recovery_codes').select('id', { count: 'exact', head: true });
  const recoverySocio = await socioA.client.from('password_recovery_codes').select('id', { count: 'exact', head: true });
  check('Códigos de recuperación no son públicos', Boolean(recoveryAnon.error) && Boolean(recoverySocio.error), safeError(recoveryAnon.error || recoverySocio.error));
  const invalidPush = await socioA.client.rpc('register_my_push_subscription', {
    p_endpoint: 'https://evil.example.invalid/push', p_p256dh: 'x'.repeat(87), p_auth: 'y'.repeat(22), p_platform: 'web',
  });
  check('Suscripción push hostil rechazada', Boolean(invalidPush.error), safeError(invalidPush.error));

  const superadminProfiles = await superadmin.client.from('profiles').select('id', { count: 'exact', head: true });
  check('Superadmin AAL2 accede a Administración', !superadminProfiles.error && superadminProfiles.count === 4, safeError(superadminProfiles.error));
}

async function exerciseE02() {
  const healthTasks = Array.from({ length: 30 }, () => async () => {
    const response = await fetch(`${PROD_URL}/rest/v1/rpc/production_health`, {
      method: 'POST',
      headers: { apikey: publishableKey, 'content-type': 'application/json' },
      body: '{}',
    });
    if (!response.ok) return false;
    const body = await response.json();
    return body?.ok === true
      && body?.database === true
      && body?.rls === true
      && body?.storage === true
      && body?.push === true
      && body?.schemaContract === 19;
  });
  const pageTasks = Array.from({ length: 20 }, () => async () => {
    const response = await fetch(`${PROD_ORIGIN}/#/login`, { redirect: 'follow' });
    return response.ok && /text\/html/i.test(response.headers.get('content-type') || '');
  });
  const [health, hosting] = await Promise.all([
    boundedMeasurements(healthTasks, 5),
    boundedMeasurements(pageTasks, 5),
  ]);
  check('Carga acotada health: 30/30 sin error', health.succeeded === 30 && health.failed === 0, JSON.stringify(health));
  check('Carga acotada hosting: 20/20 sin error', hosting.succeeded === 20 && hosting.failed === 0, JSON.stringify(hosting));

  const attempts = await Promise.all(Array.from({ length: 8 }, () => adminClient.rpc('take_password_recovery_rate_limit', {
    p_scope: 'request_identity', p_subject_hash: rateHash, p_limit: 3, p_window_seconds: 60, p_block_seconds: 60,
  })));
  const allowed = attempts.filter(result => !result.error && result.data === true).length;
  const blocked = attempts.filter(result => !result.error && result.data === false).length;
  check('Rate limiting concurrente permite 3 y bloquea 5', allowed === 3 && blocked === 5, `allowed=${allowed} blocked=${blocked}`);

  const anon = publicClient();
  const probes = await Promise.all(['profiles', 'requests', 'proposals', 'notifications', 'audit_log'].map(async table => {
    const { data, error } = await anon.from(table).select('*').limit(1);
    return Boolean(error) || (data?.length ?? 0) === 0;
  }));
  check('Sondeos anónimos no exponen datos', probes.every(Boolean));
  return { health, hosting, rate_limit: { attempts: 8, allowed, blocked } };
}

async function cleanup() {
  for (const client of clients) await client.auth.signOut({ scope: 'local' }).catch(() => {});
  for (const object of [...created.storage].reverse()) {
    const { error } = await adminClient.storage.from(object.bucket).remove([object.path]);
    if (error) throw error;
  }
  const deleteIn = async (table, column, values) => {
    if (!values.length) return;
    const { error } = await adminClient.from(table).delete().in(column, values);
    if (error) throw error;
  };
  await deleteIn('notification_push_deliveries', 'profile_id', created.profiles);
  await deleteIn('notification_recipients', 'profile_id', created.profiles);
  await deleteIn('notifications', 'id', created.notifications);
  await deleteIn('proposal_moderation_events', 'proposal_id', created.proposals);
  await deleteIn('proposal_supports', 'proposal_id', created.proposals);
  await deleteIn('proposals', 'id', created.proposals);
  await deleteIn('request_files', 'request_id', created.requests);
  await deleteIn('request_messages', 'request_id', created.requests);
  await deleteIn('request_events', 'request_id', created.requests);
  await deleteIn('requests', 'id', created.requests);
  await deleteIn('request_drafts', 'profile_id', created.profiles);
  await deleteIn('request_definitions', 'id', created.definitions);
  await deleteIn('document_favorites', 'document_id', created.documents);
  await deleteIn('document_versions', 'document_id', created.documents);
  await deleteIn('documents', 'id', created.documents);
  await deleteIn('agreement_favorites', 'profile_id', created.profiles);
  await deleteIn('agreement_locations', 'agreement_id', created.agreements);
  await deleteIn('agreements', 'id', created.agreements);
  await deleteIn('content_items', 'created_by', created.profiles);
  await deleteIn('notification_preferences', 'profile_id', created.profiles);
  await deleteIn('push_devices', 'profile_id', created.profiles);
  await deleteIn('membership_verification_tokens', 'profile_id', created.profiles);
  await deleteIn('password_recovery_codes', 'profile_id', created.profiles);
  await deleteIn('notification_campaigns', 'created_by', created.profiles);
  const { error: rateError } = await adminClient.from('password_recovery_rate_limits').delete().eq('subject_hash', rateHash);
  if (rateError) throw rateError;
  const { error: auditError } = await adminClient.from('audit_log').delete().in('actor_profile_id', created.profiles);
  if (auditError) throw auditError;
  for (const profileId of [...created.profiles].reverse()) {
    const { error } = await adminClient.from('profiles').delete().eq('id', profileId);
    if (error) throw error;
  }
  for (const identity of [...created.users].reverse()) {
    const { error } = await adminClient.auth.admin.deleteUser(identity.authUserId);
    if (error && error.status !== 404) throw error;
    identity.password = null;
  }
  await assertEmptyBaseline('Cleanup verificado');
  cleanupVerified = true;
}

let loadBaseline = null;
let failure = null;
try {
  await assertEmptyBaseline('Preflight PROD vacío');
  await exerciseE01();
  loadBaseline = await exerciseE02();
} catch (error) {
  failure = safeError(error);
} finally {
  try {
    await cleanup();
  } catch (cleanupError) {
    failure = `${failure ? `${failure}; ` : ''}cleanup: ${safeError(cleanupError)}`;
  }
}

const output = {
  project_ref: PROJECT_REF,
  synthetic_only: true,
  checks_passed: checks.filter(item => item.pass).length,
  checks_failed: checks.filter(item => !item.pass).length,
  cleanup_verified_zero: cleanupVerified,
  load_baseline: loadBaseline,
  failure,
};
console.log(JSON.stringify(output, null, 2));
if (failure || output.checks_failed || !cleanupVerified) process.exitCode = 1;
