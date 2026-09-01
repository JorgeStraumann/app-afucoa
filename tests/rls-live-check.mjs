import { createClient } from '@supabase/supabase-js';

const url = process.env.AFUCOA_SUPABASE_URL;
const key = process.env.AFUCOA_PUBLISHABLE_KEY;
const users = JSON.parse(process.env.AFUCOA_TEST_USERS);
const expiredQrToken = process.env.AFUCOA_EXPIRED_QR_TOKEN || 'expired-token-not-present';

const results = [];
const check = (name, pass, detail = '') => results.push({ name, pass: Boolean(pass), detail });
const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function login(user) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  return c;
}

async function visibleCount(c, table, column, value) {
  const { count, error } = await c.from(table).select('*', { count: 'exact', head: true }).eq(column, value);
  return { count: count ?? 0, error };
}

const anon = client();
const socioA = await login(users.socioA);
const socioB = await login(users.socioB);
const admin = await login(users.admin);

const { data: profileData, error: profileError } = await socioA.rpc('get_my_profile');
if (profileError) throw profileError;
const profileA = Array.isArray(profileData) ? profileData[0] : profileData;
const { data: requestData, error: requestError } = await socioA.from('requests').select('id').order('created_at', { ascending: false }).limit(1).single();
if (requestError) throw new Error(`Falta una solicitud propia para la matriz: ${requestError.message}`);
let { data: fileData, error: fileError } = await admin.from('request_files').select('id,request:requests!inner(profile_id)').eq('request.profile_id', profileA.id).limit(1).maybeSingle();
if (fileError) throw fileError;
let createdFilePath = null;
if (!fileData) {
  createdFilePath = `${requestData.id}/rls-check-${Date.now()}.pdf`;
  const upload = await socioA.storage.from('request-files').upload(createdFilePath, new TextEncoder().encode('%PDF-1.4 RLS checklist'), { contentType:'application/pdf', upsert:false });
  if (upload.error) throw upload.error;
  const registered = await socioA.rpc('register_my_request_file', { p_request_id:requestData.id, p_storage_path:createdFilePath, p_file_name:'rls-check.pdf', p_mime_type:'application/pdf' });
  if (registered.error) throw registered.error;
  fileData = { id: registered.data };
}
const { data: documentData, error: documentError } = await admin.from('documents').select('id').eq('status','publicado').eq('is_current',true).limit(1).single();
if (documentError) throw new Error(`Falta un documento publicado para la matriz: ${documentError.message}`);

for (const [label, c, expected] of [
  ['anon', anon, 0], ['socio A', socioA, 1], ['socio B', socioB, 0], ['admin', admin, 1],
]) {
  const r = await visibleCount(c, 'profiles', 'id', profileA.id);
  check(`Leer perfil socio A — ${label}`, !r.error && r.count === expected, r.error?.message ?? `count=${r.count}`);
}

for (const [label, c, expected] of [
  ['anon', anon, 0], ['socio A', socioA, 1], ['socio B', socioB, 0], ['admin', admin, 1],
]) {
  const r = await visibleCount(c, 'requests', 'id', requestData.id);
  check(`Leer solicitud socio A — ${label}`, !r.error && r.count === expected, r.error?.message ?? `count=${r.count}`);
  const f = await visibleCount(c, 'request_files', 'id', fileData.id);
  check(`Leer adjunto solicitud A — ${label}`, !f.error && f.count === expected, f.error?.message ?? `count=${f.count}`);
}

for (const [label, c, expected] of [
  ['anon', anon, 0], ['socio A', socioA, 1], ['socio B', socioB, 1], ['admin', admin, 1],
]) {
  const r = await visibleCount(c, 'documents', 'id', documentData.id);
  check(`Leer documento publicado — ${label}`, !r.error && r.count === expected, r.error?.message ?? `count=${r.count}`);
}

for (const [label, c, expected] of [
  ['anon', anon, 0], ['socio A', socioA, 0], ['socio B', socioB, 0], ['admin', admin, 1],
]) {
  const { count, error } = await c.from('audit_log').select('*', { count: 'exact', head: true });
  check(`Leer audit_log — ${label}`, !error && (expected ? count > 0 : count === 0), error?.message ?? `count=${count}`);
}

for (const [label, c] of [['anon', anon], ['socio A', socioA], ['socio B', socioB], ['admin', admin]]) {
  const r = await visibleCount(c, 'password_recovery_codes', 'id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  check(`Leer códigos recuperación — ${label}`, Boolean(r.error) || r.count === 0, r.error?.message ?? `count=${r.count}`);
}

const tokenResult = await socioA.rpc('create_membership_verification_token');
if (tokenResult.error) throw tokenResult.error;
const validQrToken = Array.isArray(tokenResult.data) ? tokenResult.data[0]?.token : tokenResult.data?.token;
for (const [label, c, expected] of [['anon', anon, 1], ['socio A', socioA, 1], ['socio B', socioB, 1], ['admin', admin, 1]]) {
  const { data, error } = await c.rpc('verify_membership_token', { p_token: validQrToken });
  check(`QR vigente — ${label}`, !error && (data?.length ?? 0) === expected, error?.message ?? `rows=${data?.length ?? 0}`);
}
const replacementToken = await socioA.rpc('create_membership_verification_token');
if (replacementToken.error) throw replacementToken.error;
for (const [name, token] of [['vencido', expiredQrToken], ['revocado', validQrToken]]) {
  const { data, error } = await anon.rpc('verify_membership_token', { p_token: token });
  check(`QR ${name} rechazado`, !error && (data?.length ?? 0) === 0, error?.message ?? `rows=${data?.length ?? 0}`);
}

for (const [label, c, shouldWork] of [['anon', anon, false], ['socio A', socioA, true], ['socio B', socioB, true], ['admin', admin, true]]) {
  const { data, error } = await c.rpc('create_my_proposal', { p_title: `Prueba RLS ${label} ${Date.now()}`, p_description: 'Descripción de prueba suficientemente extensa para validar RLS.' });
  check(`Crear propuesta propia — ${label}`, shouldWork ? !error : Boolean(error), error?.message ?? 'ok');
}

const openProposal = await socioA.rpc('create_my_proposal', { p_title: `Apoyo RLS ${Date.now()}`, p_description: 'Propuesta temporal publicada para validar apoyo único y cierre.' });
if (openProposal.error) throw openProposal.error;
const publishedProposal = await admin.from('proposals').update({ status:'publicada', published_at:new Date().toISOString() }).eq('id',openProposal.data).select('id').single();
if (publishedProposal.error) throw publishedProposal.error;

for (const [label, c] of [['socio A', socioA], ['socio B', socioB], ['admin', admin]]) {
  const first = await c.rpc('support_proposal', { p_proposal_id: openProposal.data });
  const second = await c.rpc('support_proposal', { p_proposal_id: openProposal.data });
  const { data: ownProfile } = await c.rpc('get_my_profile');
  const { count, error } = await c.from('proposal_supports').select('*', { count: 'exact', head: true })
    .eq('proposal_id', openProposal.data)
    .eq('profile_id', ownProfile?.[0]?.id);
  check(`Apoyo único — ${label}`, !first.error && first.data === true && !second.error && second.data === false && !error && count === 1, `first=${first.data} second=${second.data} count=${count} error=${first.error?.message ?? second.error?.message ?? error?.message ?? ''}`);
}

const closedUpdate = await admin.from('proposals').update({ status:'cerrada', closed_at:new Date().toISOString() }).eq('id',openProposal.data);
const closed = await socioA.rpc('support_proposal', { p_proposal_id: openProposal.data });
check('Propuesta cerrada rechaza apoyo', !closedUpdate.error && Boolean(closed.error), closed.error?.message ?? 'sin error');

const roleEdit = await socioA.from('profiles').update({ role: 'superadmin', member_number: 'HACKED' }).eq('id', profileA.id).select('id');
check('Socio no puede editar rol/ficha', Boolean(roleEdit.error) || (roleEdit.data?.length ?? 0) === 0, roleEdit.error?.message ?? `rows=${roleEdit.data?.length ?? 0}`);

const foreignUpload = await socioB.storage.from('request-files').upload(`${requestData.id}/foreign-${Date.now()}.pdf`, new TextEncoder().encode('%PDF-1.4 RLS'), { contentType: 'application/pdf' });
check('Archivo con path ajeno rechazado', Boolean(foreignUpload.error), foreignUpload.error?.message ?? 'sin error');

if (createdFilePath) {
  await admin.storage.from('request-files').remove([createdFilePath]);
  await admin.from('request_files').delete().eq('id', fileData.id);
}
for (const c of [socioA, socioB, admin]) await c.auth.signOut();
console.log(JSON.stringify({ passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, results }, null, 2));
if (results.some(r => !r.pass)) process.exitCode = 1;
