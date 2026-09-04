import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';

const url=process.env.AFUCOA_SUPABASE_URL,key=process.env.AFUCOA_PUBLISHABLE_KEY;
const users=JSON.parse(process.env.AFUCOA_TEST_USERS || '{}');
assert.equal(url,'https://imiplnspvmsrsuikulwm.supabase.co');
assert.ok(key?.startsWith('sb_publishable_'));
const results=[],clients=[];
const check=(name,value)=>{assert.ok(value,name);results.push(name);};
const invoke=async(name,token,body)=>fetch(url+'/functions/v1/'+name,{
  method:'POST',headers:{apikey:key,'content-type':'application/json',origin:'https://jorgestraumann.github.io',...(token?{authorization:'Bearer '+token}:{})},
  body:JSON.stringify(body || {}),
});
let notificationId,adminDb;
try {
  check('push-config anónimo rechazado',(await invoke('push-config')).status===401);
  check('send anónimo rechazado',(await invoke('send-notification-push')).status===401);
  for(const [expectedRole,user] of [['socio',users.socioA],['admin',users.socioB],['superadmin',users.admin]]) {
    const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});clients.push(db);
    const login=await db.auth.signInWithPassword(user);check('login '+expectedRole,!login.error && !!login.data.session);
    const profile=await db.rpc('get_my_profile');check('perfil '+expectedRole,!profile.error && profile.data?.[0]?.role===expectedRole);
    const token=login.data.session.access_token;
    const config=await invoke('push-config',token);const data=await config.json();
    check('config pública '+expectedRole,config.status===200 && Object.keys(data).every(k=>['enabled','publicKey'].includes(k)));
    if(expectedRole==='socio') {
      check('socio no puede enviar',(await invoke('send-notification-push',token,{notification_id:'00000000-0000-0000-0000-000000000000'})).status===403);
      continue;
    }
    adminDb=db;
    if(!notificationId) {
      const created=await db.from('notifications').insert({type:'sistema',title:'PUSH HTTP DEV TEST',body:'Sintético; sin destinatarios push reales.',target_path:'#/notificaciones'}).select('id').single();
      check('notificación interna creada',!created.error);notificationId=created.data.id;
    }
    const sent=await invoke('send-notification-push',token,{notification_id:notificationId,recipients:['ignored']});
    const report=await sent.json();
    check('envío autorizado '+expectedRole,sent.status===200 && ['not_configured','disabled','complete'].includes(report.status));
    check('sin destinatarios arbitrarios '+expectedRole,Number(report.sent || 0)===0);
    const retained=await db.from('notifications').select('id').eq('id',notificationId).single();
    check('interna conservada '+expectedRole,!retained.error && !!retained.data);
    check('notification_id inexistente '+expectedRole,(await invoke('send-notification-push',token,{notification_id:'00000000-0000-0000-0000-000000000000'})).status===404);
    if(!data.enabled)check('config incompleta no revela clave '+expectedRole,data.publicKey===null);
  }
  console.log(JSON.stringify({passed:results.length,failed:0,results}));
} finally {
  if(notificationId && adminDb)await adminDb.from('notifications').delete().eq('id',notificationId);
  for(const db of clients)await db.auth.signOut({scope:'local'});
}
