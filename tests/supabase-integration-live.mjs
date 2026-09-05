import { createClient } from '@supabase/supabase-js';

const url = process.env.AFUCOA_SUPABASE_URL;
const key = process.env.AFUCOA_PUBLISHABLE_KEY;
const users = JSON.parse(process.env.AFUCOA_TEST_USERS || '{}');
if (!url || !key || !users.socioA || !users.socioB || !users.admin) {
  throw new Error('Faltan AFUCOA_SUPABASE_URL, AFUCOA_PUBLISHABLE_KEY o AFUCOA_TEST_USERS.');
}

const marker = `codex-${Date.now()}`;
const results = [];
const authenticatedClients = [];
const check = (name, pass, detail = '') => results.push({ name, pass: Boolean(pass), detail });
const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function login(user) {
  const db = client();
  authenticatedClients.push(db);
  const { data, error } = await db.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  check(`Login ${user.label}`, Boolean(data.session), data.user?.id || 'sin sesión');
  return db;
}

async function profile(db) {
  const { data, error } = await db.rpc('get_my_profile');
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

async function count(db, table, column, value) {
  const result = await db.from(table).select('*', { count: 'exact', head: true }).eq(column, value);
  return { count: result.count ?? 0, error: result.error };
}

async function run() {
const anon = client();
const socioA = await login({ ...users.socioA, label: 'socio A' });
const socioB = await login({ ...users.socioB, label: 'socio B' });
const admin = await login({ ...users.admin, label: 'superadmin' });
const [profileA, profileB, profileAdmin] = await Promise.all([profile(socioA), profile(socioB), profile(admin)]);

check('Rol socio A', profileA?.role === 'socio', profileA?.role);
check('Rol socio B temporal', profileB?.role === 'socio', profileB?.role);
check('Rol superadmin', profileAdmin?.role === 'superadmin', profileAdmin?.role);

const adminProfiles = await admin.from('profiles').select('id', { count: 'exact' });
check('Superadmin lista perfiles', !adminProfiles.error && (adminProfiles.count ?? 0) >= 3, adminProfiles.error?.message || `count=${adminProfiles.count}`);
const adminAudit = await admin.from('audit_log').select('id', { count: 'exact', head: true });
check('Superadmin accede auditoría', !adminAudit.error, adminAudit.error?.message || `count=${adminAudit.count ?? 0}`);
const socioAudit = await socioA.from('audit_log').select('id', { count: 'exact', head: true });
check('Socio no accede auditoría', Boolean(socioAudit.error) || (socioAudit.count ?? 0) === 0, socioAudit.error?.message || `count=${socioAudit.count ?? 0}`);

const originalContact = { email: profileA.email, phone: profileA.phone };
const contactUpdate = await socioA.rpc('update_my_contact', { p_email: `${marker}@example.invalid`, p_phone: '+59899000000' });
const changedProfile = await profile(socioA);
check('Mi Cuenta actualiza solo contacto', !contactUpdate.error && changedProfile.email === `${marker}@example.invalid` && changedProfile.phone === '+59899000000', contactUpdate.error?.message || `${changedProfile.email}/${changedProfile.phone}`);
const forbiddenProfileUpdate = await socioA.from('profiles').update({ role: 'superadmin', member_number: `HACK-${marker}` }).eq('id', profileA.id).select('id');
const protectedProfile = await profile(socioA);
check('Mi Cuenta no modifica rol ni ficha', (Boolean(forbiddenProfileUpdate.error) || (forbiddenProfileUpdate.data?.length ?? 0) === 0) && protectedProfile.role === 'socio' && protectedProfile.member_number === profileA.member_number, forbiddenProfileUpdate.error?.message || `rows=${forbiddenProfileUpdate.data?.length ?? 0}`);
const contactRestore = await socioA.rpc('update_my_contact', { p_email: originalContact.email, p_phone: originalContact.phone });
check('Contacto restaurado', !contactRestore.error, contactRestore.error?.message || 'ok');

const definition = await admin.from('request_definitions').insert({
  name: `Trámite DEV ${marker}`,
  slug: `tramite-${marker}`,
  description: 'Definición temporal para la integración real.',
  category: 'Pruebas DEV',
  estimated_days: 1,
  fields: [{ id: 'datos', title: 'Datos', fields: [{ name: 'detalle', label: 'Detalle', type: 'text', required: true }] }],
  active: true,
}).select('id').single();
if (definition.error) throw definition.error;

const draft = await socioA.rpc('save_my_request_draft', { p_definition_id: definition.data.id, p_payload: { detalle: marker }, p_current_step: 0 });
check('Socio guarda borrador propio', !draft.error && Boolean(draft.data), draft.error?.message || String(draft.data));
const submitted = await socioA.rpc('submit_my_request', { p_definition_id: definition.data.id, p_payload: { detalle: marker } });
const request = Array.isArray(submitted.data) ? submitted.data[0] : submitted.data;
check('Socio crea trámite real', !submitted.error && Boolean(request?.id) && Boolean(request?.request_number), submitted.error?.message || request?.request_number);
if (!request?.id) throw submitted.error || new Error('submit_my_request no devolvió una solicitud.');

for (const [label, db, expected] of [['socio A', socioA, 1], ['socio B', socioB, 0], ['superadmin', admin, 1], ['anon', anon, 0]]) {
  const visible = await count(db, 'requests', 'id', request.id);
  check(`Aislamiento del trámite — ${label}`, !visible.error && visible.count === expected, visible.error?.message || `count=${visible.count}`);
}

const memberMessage = await socioA.from('request_messages').insert({ request_id: request.id, author_profile_id: profileA.id, body: `Mensaje privado ${marker}`, visible_to_member: true }).select('id').single();
check('Socio agrega mensaje al trámite propio', !memberMessage.error && Boolean(memberMessage.data?.id), memberMessage.error?.message || memberMessage.data?.id);
const foreignMessage = await socioB.from('request_messages').insert({ request_id: request.id, author_profile_id: profileB.id, body: `Intrusión ${marker}`, visible_to_member: true }).select('id');
check('Socio B no agrega mensaje al trámite A', Boolean(foreignMessage.error) || (foreignMessage.data?.length ?? 0) === 0, foreignMessage.error?.message || `rows=${foreignMessage.data?.length ?? 0}`);
const hiddenAdminMessage = await admin.from('request_messages').insert({ request_id: request.id, author_profile_id: profileAdmin.id, body: `Nota interna ${marker}`, visible_to_member: false }).select('id').single();
if (hiddenAdminMessage.error) throw hiddenAdminMessage.error;
const messageA = await count(socioA, 'request_messages', 'id', memberMessage.data.id);
const messageB = await count(socioB, 'request_messages', 'id', memberMessage.data.id);
const hiddenA = await count(socioA, 'request_messages', 'id', hiddenAdminMessage.data.id);
check('Mensaje propio visible solo al socio A', !messageA.error && messageA.count === 1 && !messageB.error && messageB.count === 0, `A=${messageA.count} B=${messageB.count}`);
check('Nota administrativa interna oculta al socio', !hiddenA.error && hiddenA.count === 0, hiddenA.error?.message || `count=${hiddenA.count}`);

const storagePath = `${request.id}/${marker}.pdf`;
const bytes = new TextEncoder().encode('%PDF-1.4\n% AFUCOA DEV integration test\n');
const upload = await socioA.storage.from('request-files').upload(storagePath, bytes, { contentType: 'application/pdf', upsert: false });
check('Socio sube archivo al path propio', !upload.error, upload.error?.message || storagePath);
const registeredFile = await socioA.rpc('register_my_request_file', { p_request_id: request.id, p_storage_path: storagePath, p_file_name: `${marker}.pdf`, p_mime_type: 'application/pdf' });
check('Socio registra metadatos del archivo', !registeredFile.error && Boolean(registeredFile.data), registeredFile.error?.message || String(registeredFile.data));
const signedA = await socioA.storage.from('request-files').createSignedUrl(storagePath, 60);
const signedB = await socioB.storage.from('request-files').createSignedUrl(storagePath, 60);
let signedFetchOk = false;
if (signedA.data?.signedUrl) {
  const response = await fetch(signedA.data.signedUrl);
  signedFetchOk = response.ok && (await response.text()).includes('AFUCOA DEV');
}
check('Socio A descarga archivo privado firmado', !signedA.error && signedFetchOk, signedA.error?.message || `fetch=${signedFetchOk}`);
check('Socio B no firma archivo del socio A', Boolean(signedB.error) || !signedB.data?.signedUrl, signedB.error?.message || 'URL inesperada');
const foreignUpload = await socioB.storage.from('request-files').upload(`${request.id}/${marker}-foreign.pdf`, bytes, { contentType: 'application/pdf', upsert: false });
check('Socio B no sube al path del socio A', Boolean(foreignUpload.error), foreignUpload.error?.message || 'sin error');

const proposalCreate = await socioA.rpc('create_my_proposal', { p_title: `Idea ${marker}`, p_description: `Descripción completa de propuesta para ${marker}.` });
if (proposalCreate.error) throw proposalCreate.error;
const proposalId = proposalCreate.data;
const publish = await admin.from('proposals').update({ status: 'publicada', published_at: new Date().toISOString() }).eq('id', proposalId).select('id').single();
check('Superadmin publica propuesta', !publish.error && publish.data?.id === proposalId, publish.error?.message || publish.data?.id);
const supportA1 = await socioA.rpc('support_proposal', { p_proposal_id: proposalId });
const supportA2 = await socioA.rpc('support_proposal', { p_proposal_id: proposalId });
const supportB1 = await socioB.rpc('support_proposal', { p_proposal_id: proposalId });
const supportB2 = await socioB.rpc('support_proposal', { p_proposal_id: proposalId });
check('Apoyo único socio A', !supportA1.error && supportA1.data === true && !supportA2.error && supportA2.data === false, `first=${supportA1.data} second=${supportA2.data}`);
check('Apoyo único socio B', !supportB1.error && supportB1.data === true && !supportB2.error && supportB2.data === false, `first=${supportB1.data} second=${supportB2.data}`);
const visibleProposals = await socioA.rpc('list_visible_proposals');
const proposalView = visibleProposals.data?.find(row => row.id === proposalId);
check('Listado de propuestas informa autor, apoyo y total', !visibleProposals.error && proposalView?.mine === true && proposalView?.supported === true && Number(proposalView?.support_count) === 2, visibleProposals.error?.message || JSON.stringify(proposalView));
const close = await admin.from('proposals').update({ status: 'cerrada', closed_at: new Date().toISOString() }).eq('id', proposalId);
const supportClosed = await socioA.rpc('support_proposal', { p_proposal_id: proposalId });
check('Propuesta cerrada rechaza apoyo', !close.error && Boolean(supportClosed.error), supportClosed.error?.message || 'sin error');

const token1 = await socioA.rpc('create_membership_verification_token');
const raw1 = Array.isArray(token1.data) ? token1.data[0]?.token : token1.data?.token;
const verify1 = await anon.rpc('verify_membership_token', { p_token: raw1 });
check('QR vigente verifica al socio activo', !token1.error && !verify1.error && verify1.data?.length === 1 && verify1.data[0].member_number === profileA.member_number, token1.error?.message || verify1.error?.message || `rows=${verify1.data?.length ?? 0}`);
const token2 = await socioA.rpc('create_membership_verification_token');
const raw2 = Array.isArray(token2.data) ? token2.data[0]?.token : token2.data?.token;
const [oldToken, newToken] = await Promise.all([
  anon.rpc('verify_membership_token', { p_token: raw1 }),
  anon.rpc('verify_membership_token', { p_token: raw2 }),
]);
check('Nuevo QR revoca el anterior', !oldToken.error && oldToken.data?.length === 0 && !newToken.error && newToken.data?.length === 1, `old=${oldToken.data?.length ?? 0} new=${newToken.data?.length ?? 0}`);

await admin.storage.from('request-files').remove([storagePath]);

const output = {
  marker,
  fixtures: { definitionId: definition.data.id, requestId: request.id, proposalId, storagePath },
  passed: results.filter(result => result.pass).length,
  failed: results.filter(result => !result.pass).length,
  results,
};
console.log(JSON.stringify(output, null, 2));
if (output.failed) process.exitCode = 1;
}

try {
  await run();
} finally {
  for (const db of authenticatedClients) await db.auth.signOut({ scope: 'local' });
}
