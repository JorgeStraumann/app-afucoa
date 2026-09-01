import { createClient } from '@supabase/supabase-js';

const url = process.env.AFUCOA_SUPABASE_URL;
const key = process.env.AFUCOA_PUBLISHABLE_KEY;
const users = JSON.parse(process.env.AFUCOA_TEST_USERS);
const ids = {
  profileA: 'c552684f-e196-4d00-9625-2bbeb5e2c410',
  requestA: '22222222-2222-4222-8222-222222222222',
  fileA: '33333333-3333-4333-8333-333333333333',
  document: '44444444-4444-4444-8444-444444444444',
  proposalOpen: '55555555-5555-4555-8555-555555555555',
  proposalClosed: '66666666-6666-4666-8666-666666666666',
};

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

for (const [label, c, expected] of [
  ['anon', anon, 0], ['socio A', socioA, 1], ['socio B', socioB, 0], ['admin', admin, 1],
]) {
  const r = await visibleCount(c, 'profiles', 'id', ids.profileA);
  check(`Leer perfil socio A — ${label}`, !r.error && r.count === expected, r.error?.message ?? `count=${r.count}`);
}

for (const [label, c, expected] of [
  ['anon', anon, 0], ['socio A', socioA, 1], ['socio B', socioB, 0], ['admin', admin, 1],
]) {
  const r = await visibleCount(c, 'requests', 'id', ids.requestA);
  check(`Leer solicitud socio A — ${label}`, !r.error && r.count === expected, r.error?.message ?? `count=${r.count}`);
  const f = await visibleCount(c, 'request_files', 'id', ids.fileA);
  check(`Leer adjunto solicitud A — ${label}`, !f.error && f.count === expected, f.error?.message ?? `count=${f.count}`);
}

for (const [label, c, expected] of [
  ['anon', anon, 0], ['socio A', socioA, 1], ['socio B', socioB, 1], ['admin', admin, 1],
]) {
  const r = await visibleCount(c, 'documents', 'id', ids.document);
  check(`Leer documento publicado — ${label}`, !r.error && r.count === expected, r.error?.message ?? `count=${r.count}`);
}

for (const [label, c, expected] of [
  ['anon', anon, 0], ['socio A', socioA, 0], ['socio B', socioB, 0], ['admin', admin, 1],
]) {
  const r = await visibleCount(c, 'audit_log', 'entity_id', 'rls-test');
  check(`Leer audit_log — ${label}`, !r.error && r.count === expected, r.error?.message ?? `count=${r.count}`);
}

for (const [label, c] of [['anon', anon], ['socio A', socioA], ['socio B', socioB], ['admin', admin]]) {
  const r = await visibleCount(c, 'password_recovery_codes', 'id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  check(`Leer códigos recuperación — ${label}`, Boolean(r.error) || r.count === 0, r.error?.message ?? `count=${r.count}`);
}

for (const [label, c, expected] of [['anon', anon, 1], ['socio A', socioA, 1], ['socio B', socioB, 1], ['admin', admin, 1]]) {
  const { data, error } = await c.rpc('verify_membership_token', { p_token: 'RLS_VALID_TOKEN' });
  check(`QR vigente — ${label}`, !error && (data?.length ?? 0) === expected, error?.message ?? `rows=${data?.length ?? 0}`);
}
for (const token of ['RLS_EXPIRED_TOKEN', 'RLS_REVOKED_TOKEN']) {
  const { data, error } = await anon.rpc('verify_membership_token', { p_token: token });
  check(`QR inválido — ${token}`, !error && (data?.length ?? 0) === 0, error?.message ?? `rows=${data?.length ?? 0}`);
}

for (const [label, c, shouldWork] of [['anon', anon, false], ['socio A', socioA, true], ['socio B', socioB, true], ['admin', admin, true]]) {
  const { error } = await c.rpc('create_my_proposal', { p_title: `Prueba ${label}`, p_description: 'Descripción de prueba suficientemente extensa para validar RLS.' });
  check(`Crear propuesta propia — ${label}`, shouldWork ? !error : Boolean(error), error?.message ?? 'ok');
}

for (const [label, c] of [['socio A', socioA], ['socio B', socioB], ['admin', admin]]) {
  const first = await c.rpc('support_proposal', { p_proposal_id: ids.proposalOpen });
  const second = await c.rpc('support_proposal', { p_proposal_id: ids.proposalOpen });
  const { data: ownProfile } = await c.rpc('get_my_profile');
  const { count, error } = await c.from('proposal_supports').select('*', { count: 'exact', head: true })
    .eq('proposal_id', ids.proposalOpen)
    .eq('profile_id', ownProfile?.[0]?.id);
  check(`Apoyo único — ${label}`, !first.error && first.data === true && !second.error && second.data === false && !error && count === 1, `first=${first.data} second=${second.data} count=${count} error=${first.error?.message ?? second.error?.message ?? error?.message ?? ''}`);
}

const closed = await socioA.rpc('support_proposal', { p_proposal_id: ids.proposalClosed });
check('Propuesta cerrada rechaza apoyo', Boolean(closed.error), closed.error?.message ?? 'sin error');

const roleEdit = await socioA.from('profiles').update({ role: 'superadmin', member_number: 'HACKED' }).eq('id', ids.profileA).select('id');
check('Socio no puede editar rol/ficha', Boolean(roleEdit.error) || (roleEdit.data?.length ?? 0) === 0, roleEdit.error?.message ?? `rows=${roleEdit.data?.length ?? 0}`);

const foreignUpload = await socioB.storage.from('request-files').upload(`${ids.requestA}/foreign.pdf`, new TextEncoder().encode('%PDF-1.4 RLS'), { contentType: 'application/pdf' });
check('Archivo con path ajeno rechazado', Boolean(foreignUpload.error), foreignUpload.error?.message ?? 'sin error');

for (const c of [socioA, socioB, admin]) await c.auth.signOut();
console.log(JSON.stringify({ passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, results }, null, 2));
if (results.some(r => !r.pass)) process.exitCode = 1;
