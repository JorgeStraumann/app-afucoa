import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createECDH} from 'node:crypto';
import webpush from 'web-push';

const root=new URL('../',import.meta.url);
async function module(path,env,names) {
  const source=(await readFile(new URL(path,root),'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'').replace('import.meta.env.BASE_URL',"'/app-afucoa/'");
  return vm.runInNewContext(source+`;({${names.join(',')}})`,{URL,Response,Request,Uint8Array,atob,TextDecoder,setTimeout,clearTimeout,console,...env});
}
const policy=await module('supabase/functions/_shared/push-policy.ts',{},['safeTarget','allowedEndpoint','preferenceFor','genericPayload','dispatchPush']);
const key=Buffer.concat([Buffer.from([4]),Buffer.alloc(64,1)]).toString('base64url');
async function browser({permission='default',compatible=true,enabled=true,existing=false}={}) {
  const stats={permission:0,subscribe:0,register:0,unregister:0,touch:0,sw:0};
  let subscription=existing?sub():null,active=existing;
  function sub(){return {endpoint:'https://fcm.googleapis.com/test-only',options:{applicationServerKey:Buffer.from(key,'base64url')},toJSON:()=>({endpoint:'https://fcm.googleapis.com/test-only',keys:{p256dh:key,auth:'x'.repeat(22)}}),unsubscribe:async()=>{subscription=null;return true;}};}
  const Notification={permission,requestPermission:async()=>{stats.permission++;Notification.permission='granted';return 'granted';}};
  const reg={active:true,pushManager:{getSubscription:async()=>subscription,subscribe:async()=>{stats.subscribe++;subscription=sub();return subscription;}}};
  const client={functions:{invoke:async()=>({data:{enabled,publicKey:enabled?key:null}})},rpc:async name=>{
    if(name==='register_my_push_subscription'){stats.register++;active=true;return {data:'device-id'};}
    if(name==='unregister_my_push_subscription'){stats.unregister++;active=false;return {data:true};}
    stats.touch++;return {data:active};
  }};
  const api=await module('src/services/push-service.js',{
    appMode:'supabase',requireSupabase:()=>client,Notification,
    window:{isSecureContext:true,Notification,...(compatible?{PushManager:{}}:{})},
    navigator:{serviceWorker:{getRegistration:async()=>reg,register:async(path,options)=>{stats.sw++;assert.equal(path,'/app-afucoa/push-sw.js');assert.equal(options.scope,'/app-afucoa/');return reg;}}},
  },['getPushState','activatePush','deactivatePush','registerPushWorker','vapidBytes']);
  return {api,stats,Notification,setActive:value=>{active=value;}};
}
test('A granted + existente: estado activo, sin pedir permiso ni duplicar',async()=>{
  const f=await browser({permission:'granted',existing:true});assert.equal((await f.api.getPushState()).state,'active');
  await f.api.activatePush();assert.equal(f.stats.permission,0);assert.equal(f.stats.subscribe,0);assert.equal(f.stats.register,1);
});
test('B default: consultar no solicita permiso ni suscribe',async()=>{const f=await browser();assert.equal((await f.api.getPushState()).state,'inactive');assert.equal(f.stats.permission,0);assert.equal(f.stats.subscribe,0);});
test('C denied: no insiste',async()=>{const f=await browser({permission:'denied'});assert.equal((await f.api.getPushState()).state,'denied');await f.api.activatePush();assert.equal(f.stats.permission,0);});
test('D sin PushManager: no compatible',async()=>{const f=await browser({compatible:false});assert.equal((await f.api.getPushState()).state,'unsupported');await f.api.activatePush();assert.equal(f.stats.permission,0);});
test('E activación explícita y V scope GitHub Pages',async()=>{const f=await browser();assert.equal((await f.api.activatePush()).state,'active');assert.equal(f.stats.permission,1);assert.equal(f.stats.subscribe,1);assert.equal(f.stats.sw,1);});
test('F desactivación, G registro duplicado sin segunda suscripción',async()=>{const f=await browser({permission:'granted'});await f.api.activatePush();await f.api.activatePush();assert.equal(f.stats.subscribe,1);await f.api.deactivatePush();assert.equal(f.stats.unregister,1);assert.equal((await f.api.getPushState()).state,'inactive');});
test('H dispositivo de otra cuenta no se adopta al consultar; exige activación',async()=>{const f=await browser({permission:'granted',existing:true});f.setActive(false);assert.equal((await f.api.getPushState()).state,'inactive');assert.equal(f.stats.register,0);await f.api.activatePush();assert.equal(f.stats.register,1);});
test('M allowPush=false: sin permiso, registro ni suscripción',async()=>{const f=await browser({enabled:false});await f.api.getPushState();await f.api.activatePush();assert.equal(f.stats.permission+f.stats.register+f.stats.subscribe,0);});
for(const [type,expected] of Object.entries({convenio:'agreements',evento:'events',tramite:'request_updates',institucional:'news',documento:'news',propuesta:'news',sistema:'news'})) {
  test(`I–L mapeo ${type} -> ${expected}`,()=>assert.equal(policy.preferenceFor(type),expected));
}
test('U targets externos, javascript, traversal, encoding y query son rechazados',()=>{
  for(const value of ['https://evil.test/','#//evil.test','javascript:alert(1)','#/../admin','#/notificaciones?token=x','#/solicitudes/%2e%2e',null]) assert.equal(policy.safeTarget(value),'#/notificaciones');
  assert.equal(policy.safeTarget('#/tramites'),'#/tramites');
  assert.equal(policy.safeTarget('#/'),'#/');
});
test('SSRF: endpoints HTTPS exclusivamente en proveedores permitidos',()=>{
  for(const url of ['https://127.0.0.1/x','https://fcm.googleapis.com.evil.test/x','https://evil.test','http://fcm.googleapis.com/x','https://user@fcm.googleapis.com/x','https://fcm.googleapis.com:444/x'])assert.equal(policy.allowedEndpoint(url),false);
  assert.equal(policy.allowedEndpoint('https://web.push.apple.com/test'),true);
});
test('payload no contiene contenido privado de la notificación',()=>{
  const payload=policy.genericPayload({title:'Nombre privado',body:'Cédula y expediente privados',target_path:'#/tramites'});
  assert.deepEqual(JSON.parse(payload),{target_path:'#/tramites'});
});

function senderDb() {
  const writes=[];
  return {writes,rpc:async()=>({data:true}),from:table=>{
    let value;const query={update:v=>{value=v;return query;},eq:()=>query,then:resolve=>{writes.push({table,value});resolve({error:null});}};return query;
  }};
}
for(const code of [201,404,410,500])test(`Q/R proveedor ${code}: resultado y política de baja`,async()=>{
  const db=senderDb();const summary=await policy.dispatchPush({db,notification:{id:'n',target_path:'#/tramites'},targets:[{device_id:'d',profile_id:'p',endpoint:'https://fcm.googleapis.com/test'}],send:async()=>code});
  assert.equal(summary.sent,code===201?1:0);
  assert.equal(db.writes.some(w=>w.table==='push_devices'),[404,410].includes(code));
  assert.equal(summary.deactivated,[404,410].includes(code)?1:0);
});
test('claims rechazados no envían (duplicados, preferencias o kill switch)',async()=>{
  const db=senderDb();db.rpc=async()=>({data:false});let sent=0;
  await policy.dispatchPush({db,notification:{id:'n'},targets:[{endpoint:'https://fcm.googleapis.com/test'}],send:async()=>{sent++;return 201;}});assert.equal(sent,0);
});

for(const [role,expected] of [['socio',403],['admin',null],['superadmin',null]])test(`N/O/P autenticación servidor ${role}`,async()=>{
  const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:{id:'profile',role}})};
  const api=await module('supabase/functions/_shared/push-http.ts',{
    Deno:{env:{get:name=>name==='SUPABASE_URL'?'https://imiplnspvmsrsuikulwm.supabase.co':'synthetic'}},
    createClient:()=>({auth:{getUser:async()=>({data:{user:{id:'user'}}})},from:()=>query}),
  },['authenticate']);
  assert.equal((await api.authenticate(new Request('https://dev.test',{headers:{authorization:'Bearer synthetic'}}),true)).error || null,expected);
});

async function worker(open,target='#/tramites') {
  const events={},shown=[],navigation=[],focus=[];let opened;
  vm.runInNewContext(await readFile(new URL('public/push-sw.js',root),'utf8'),{URL,self:{
    addEventListener:(name,fn)=>{events[name]=fn;},
    registration:{scope:'https://jorgestraumann.github.io/app-afucoa/',showNotification:async(title,options)=>shown.push({title,options})},
    clients:{matchAll:async()=>open?[{url:'https://jorgestraumann.github.io/app-afucoa/#/',navigate:async url=>navigation.push(url),focus:async()=>focus.push(true)}]:[],openWindow:async url=>{opened=url;}},
  }});
  let work;events.push({data:{json:()=>({title:'Privado',body:'Privado',target_path:'#/tramites'})},waitUntil:promise=>{work=promise;}});await work;
  assert.equal(shown[0].title,'AFUCOA');assert.equal(shown[0].options.body,'Tenés una nueva notificación en AFUCOA.');
  events.notificationclick({notification:{close(){},data:{target_path:target}},waitUntil:promise=>{work=promise;}});await work;
  return {opened,navigation,focus};
}
test('S click enfoca y navega ventana AFUCOA existente',async()=>{const f=await worker(true);assert.equal(f.focus.length,1);assert.equal(f.navigation[0],'https://jorgestraumann.github.io/app-afucoa/#/tramites');assert.equal(f.opened,undefined);});
test('T click abre AFUCOA cerrada bajo la base correcta',async()=>assert.equal((await worker(false)).opened,'https://jorgestraumann.github.io/app-afucoa/#/tramites'));

test('U Service Worker bloquea destinos externos incluso en click',async()=>{
  for(const target of ['https://evil.test/','#//evil.test','#/../admin','javascript:alert(1)'])
    assert.equal((await worker(false,target)).opened,'https://jorgestraumann.github.io/app-afucoa/#/notificaciones');
});
test('registrar worker al cargar no solicita permiso ni suscribe',async()=>{
  const f=await browser();await f.api.registerPushWorker();assert.equal(f.stats.permission+f.stats.subscribe,0);
});
test('controles push ocultos prevalecen sobre display de botones',async()=>{
  const css=await readFile(new URL('src/styles/components.css',root),'utf8');
  assert.match(css,/\.push-controls \[hidden\]\s*\{\s*display:none!important/);
  const controls=await readFile(new URL('src/components/push-controls.js',root),'utf8');
  assert.ok(controls.includes('card push-controls'));
});
test('envío continúa lotes acotados y agrega solo resultados públicos',async()=>{
  let calls=0;
  const api=await module('src/services/push-service.js',{requireSupabase:()=>({functions:{invoke:async()=>({data:{status:'complete',found:++calls===1?40:1,sent:calls===1?40:1,limited:calls===1,endpoint:'never-forward'}})}})},['sendNotificationPush']);
  const result=await api.sendNotificationPush('notification-id');
  assert.equal(calls,2);assert.equal(result.sent,41);assert.equal(result.limited,false);assert.equal(result.endpoint,undefined);
});
test('push falla sin propagar excepción a la notificación interna',async()=>{
  const api=await module('src/services/push-service.js',{requireSupabase:()=>({functions:{invoke:async()=>{throw new Error('private provider error');}}})},['sendNotificationPush']);
  assert.equal((await api.sendNotificationPush('notification-id')).status,'unavailable');
});
test('cifrado real aes128gcm y VAPID con claves efímeras solo en memoria',()=>{
  const vapid=webpush.generateVAPIDKeys(),ecdh=createECDH('prime256v1');ecdh.generateKeys();
  const details=webpush.generateRequestDetails({endpoint:'https://fcm.googleapis.com/test',keys:{p256dh:ecdh.getPublicKey().toString('base64url'),auth:Buffer.alloc(16,1).toString('base64url')}},policy.genericPayload({target_path:'#/notificaciones'}),{
    vapidDetails:{...vapid,subject:'https://jorgestraumann.github.io/app-afucoa/'},contentEncoding:'aes128gcm',TTL:300,
  });
  assert.equal(details.headers['Content-Encoding'],'aes128gcm');assert.ok(details.body.length>0);assert.ok(details.headers.Authorization);
});
