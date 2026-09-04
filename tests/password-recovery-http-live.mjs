import assert from 'node:assert/strict';
const url=process.env.AFUCOA_SUPABASE_URL;
const key=process.env.AFUCOA_PUBLISHABLE_KEY;
if(url !== 'https://imiplnspvmsrsuikulwm.supabase.co' || !key?.startsWith('sb_publishable_')) {
  throw new Error('Se requiere únicamente la publishable key de DEV.');
}
const origin='https://jorgestraumann.github.io';
const headers={apikey:key,origin,'content-type':'application/json'};
const results=[];
for(const name of ['request-password-recovery','confirm-password-recovery']) {
  const response=await fetch(url+'/functions/v1/'+name,{method:'OPTIONS',headers});
  assert.equal(response.status,204);
  assert.equal(response.headers.get('access-control-allow-origin'),origin);
  results.push(name+': CORS 204');
}
let neutral;
for(const document_number of ['10000001','99999999']) {
  const response=await fetch(url+'/functions/v1/request-password-recovery',{
    method:'POST',headers,body:JSON.stringify({document_number}),
  });
  assert.equal(response.status,200);
  const body=await response.json();
  if(neutral) assert.deepEqual(body,neutral); else neutral=body;
}
results.push('respuesta neutra existente/inexistente idéntica');
const invalid=await fetch(url+'/functions/v1/confirm-password-recovery',{
  method:'POST',headers,body:JSON.stringify({document_number:'99999999',code:'00000000',new_password:'Ficticia-Solo-Test-2026!'}),
});
assert.equal(invalid.status,400); assert.equal((await invalid.json()).error,'invalid_code');
results.push('código inválido rechazado');
const originDenied=await fetch(url+'/functions/v1/request-password-recovery',{
  method:'POST',headers:{...headers,origin:'https://evil.invalid'},body:'{}',
});
assert.equal(originDenied.status,403); results.push('origen ajeno rechazado');
for(const path of ['/rest/v1/password_recovery_codes?select=id','/rest/v1/password_recovery_rate_limits?select=scope']) {
  const response=await fetch(url+path,{headers:{apikey:key}});
  assert.ok([401,403].includes(response.status)); results.push('acceso anónimo denegado: '+path.split('?')[0]);
}
const settings=await fetch(url+'/auth/v1/settings',{headers:{apikey:key}});
assert.equal(settings.status,200);
assert.equal((await settings.json()).disable_signup,true);
results.push('altas públicas deshabilitadas');
console.log(JSON.stringify({passed:results.length,failed:0,results},null,2));
