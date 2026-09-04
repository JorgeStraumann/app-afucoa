import { createClient } from '@supabase/supabase-js';

const url = process.env.AFUCOA_SUPABASE_URL;
const key = process.env.AFUCOA_PUBLISHABLE_KEY;
const users = JSON.parse(process.env.AFUCOA_TEST_USERS || '{}');
const cases = [
  ['socio', users.socioA],
  ['admin', users.socioB],
  ['superadmin', users.admin],
];

if (!url || !key || cases.some(([, user]) => !user?.email || !user?.password)) {
  throw new Error('Faltan variables efímeras para probar Auth DEV.');
}

const results = [];
for (const [expectedRole, user] of cases) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  const profile = login.error ? null : await client.rpc('get_my_profile');
  const row = Array.isArray(profile?.data) ? profile.data[0] : profile?.data;
  results.push({
    role: expectedRole,
    login: !login.error && Boolean(login.data.session),
    profile: !profile?.error && row?.role === expectedRole,
  });
  await client.auth.signOut();
}

const passed = results.every((result) => result.login && result.profile);
console.log(JSON.stringify({ passed, results }, null, 2));
if (!passed) process.exitCode = 1;
