import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { loadAuth, loadProfile, loadSession } from './helpers/session-harness.mjs';

const url=process.env.AFUCOA_SUPABASE_URL;
const key=process.env.AFUCOA_PUBLISHABLE_KEY;
const password=process.env.AFUCOA_SOCIO_DEV_PASSWORD;
if(url!=='https://imiplnspvmsrsuikulwm.supabase.co' || !key?.startsWith('sb_publishable_') || !password) {
  throw new Error('Se requieren URL/key pública DEV y contraseña efímera del socio DEV.');
}
const results=[], requests=[];
const client=createClient(url,key,{
  auth:{persistSession:false,autoRefreshToken:false},
  global:{fetch:async (input,options) => {
    const response=await fetch(input,options);
    // Only path/status; never headers, query strings, body or credentials.
    requests.push({path:new URL(typeof input==='string'?input:input.url ?? input.toString()).pathname,status:response.status});
    return response;
  }},
});
const auth=await loadAuth(client), profiles=await loadProfile(client);
const session=await loadSession({...auth,...profiles,authSignOut:auth.signOut});
const check=(name,condition) => { assert.ok(condition,name); results.push(name); };
let original, contactChanged=false, manualLogout=false;
try {
  await session.bootstrapSession();
  const result=await auth.signInWithDocument('10000001',password);
  await session.startRealSession(result);
  check('1. Login socio DEV',session.getSession()?.profile?.role==='socio');
  await new Promise(resolve=>setTimeout(resolve,1000));
  check('2. Sesión activa sin logout automático',Boolean((await auth.getAuthSession())?.access_token) && !requests.some(r=>r.path.endsWith('/logout')));
  original=await profiles.fetchMyProfile();
  check('3. get_my_profile autenticado',original.document_number==='10000001');
  const email='session-regression@example.invalid', phone='000000000';
  contactChanged=true;
  assert.equal(await profiles.updateMyContact({email,phone}),true);
  await session.refreshProfile();
  check('4. Contacto persistido',session.getSession().profile.email===email && session.getSession().profile.phone===phone);
  const proof=await client.rpc('create_membership_verification_token');
  check('5. QR autenticado',!proof.error && Boolean((Array.isArray(proof.data)?proof.data[0]:proof.data)?.token));
  // Route-facing operations use exactly the same store/client as the UI.
  for(const rpc of ['current_profile_id','list_visible_proposals','get_my_profile']) {
    const response=await client.rpc(rpc); assert.ifError(response.error);
    assert.ok(session.getSession()?.auth?.access_token);
  }
  check('6. RPC entre pantallas mantienen la sesión',!requests.some(r=>r.status===401 || r.path.endsWith('/logout')));
  const refreshed=await client.auth.refreshSession(); assert.ifError(refreshed.error);
  await new Promise(resolve=>setTimeout(resolve,100));
  check('Refresh de token preserva perfil',session.getSession()?.profile?.id===original.id && session.getSession().auth.access_token===refreshed.data.session.access_token);
  assert.equal(await profiles.updateMyContact({email:original.email,phone:original.phone}),true);
  contactChanged=false;
  await session.endSession(); manualLogout=true;
  check('7. Logout manual',session.getSession()===null && await auth.getAuthSession()===null);
  console.log(JSON.stringify({project:'imiplnspvmsrsuikulwm',passed:results.length,failed:0,results,requests},null,2));
} finally {
  if(contactChanged && original) {
    const restored=await profiles.updateMyContact({email:original.email,phone:original.phone});
    assert.equal(restored,true,'Restauración de contacto DEV');
  }
  if(!manualLogout) await session.endSession();
}
