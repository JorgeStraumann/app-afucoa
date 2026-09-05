import { appMode, requireSupabase } from './supabase.js';

const base = import.meta.env.BASE_URL;
let preparedConfig;
const supported = () => appMode === 'supabase' && window.isSecureContext &&
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export function vapidBytes(value) {
  const normalized = value.replace(/-/g,'+').replace(/_/g,'/');
  const bytes = Uint8Array.from(atob(normalized.padEnd(Math.ceil(normalized.length/4)*4,'=')), char => char.charCodeAt(0));
  if (bytes.length !== 65 || bytes[0] !== 4) throw new Error('Configuración push no disponible.');
  return bytes;
}

async function config() {
  const {data,error} = await requireSupabase().functions.invoke('push-config');
  if (error) throw new Error('No se pudo consultar el servicio push.');
  preparedConfig=data;
  return data;
}

export async function registerPushWorker() {
  if (!supported()) return null;
  return navigator.serviceWorker.register(`${base}push-sw.js`, {scope:base,updateViaCache:'none'});
}

async function registration() {
  const reg = await registerPushWorker();
  if (!reg) return null;
  if (reg.active) return reg;
  // Do not wait forever if worker installation is blocked or fails.
  return new Promise((resolve,reject) => {
    const worker = reg.installing || reg.waiting;
    if (!worker) return reject(new Error('No se pudo iniciar el servicio push.'));
    const timer = setTimeout(() => {worker.removeEventListener('statechange',changed);reject(new Error('El servicio push no respondió.'));},10000);
    function changed() {
      if (worker.state === 'activated') {clearTimeout(timer);worker.removeEventListener('statechange',changed);resolve(reg);}
      if (worker.state === 'redundant') {clearTimeout(timer);worker.removeEventListener('statechange',changed);reject(new Error('No se pudo iniciar el servicio push.'));}
    }
    worker.addEventListener('statechange',changed); changed();
  });
}

export async function getPushState() {
  if (!supported()) return {state:'unsupported',enabled:false};
  const settings = await config();
  const reg = await navigator.serviceWorker.getRegistration(base);
  const subscription = await reg?.pushManager.getSubscription();
  let active = false;
  if (subscription && Notification.permission === 'granted') {
    const result = await requireSupabase().rpc('touch_my_push_subscription',{p_endpoint:subscription.endpoint});
    if (result.error) throw new Error('No se pudo verificar este dispositivo.');
    active = result.data === true;
  }
  return {...settings,active,canDeactivate:Boolean(subscription),state:Notification.permission==='denied'?'denied':active?'active':'inactive'};
}

async function setPushOwner(profileId) {
  const request=indexedDB.open('afucoa-push-state',1);
  const db=await new Promise((resolve,reject)=>{
    request.onupgradeneeded=()=>request.result.createObjectStore('state');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
  await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(profileId,'profile');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
  db.close();
}

export async function reconcilePushSubscription(profileId) {
  if (!supported()) return {state:'unavailable'};
  if(!/^[0-9a-f-]{36}$/i.test(profileId || ''))throw new Error('No se pudo reconciliar este dispositivo.');
  // Change the local delivery guard first. If the RPC then fails, old-account
  // pushes are suppressed while the app session remains unavailable for retry.
  await setPushOwner(profileId);
  if(Notification.permission !== 'granted')return {state:'unavailable'};
  const reg = await navigator.serviceWorker.getRegistration(base);
  const subscription = await reg?.pushManager.getSubscription();
  if (!subscription) return {state:'absent'};
  const client=requireSupabase();
  const touched=await client.rpc('touch_my_push_subscription',{p_endpoint:subscription.endpoint});
  if(touched.error) throw new Error('No se pudo reconciliar este dispositivo.');
  if(touched.data===true)return {state:'unchanged'};
  const serialized=subscription.toJSON();
  const registered=await client.rpc('register_my_push_subscription',{
    p_endpoint:serialized.endpoint,p_p256dh:serialized.keys?.p256dh,p_auth:serialized.keys?.auth,p_platform:'web',
  });
  if(registered.error)throw new Error('No se pudo reconciliar este dispositivo.');
  return {state:'reassigned'};
}

export async function activatePush() {
  if (!supported()) return {state:'unsupported'};
  // Mi Cuenta loads public config before enabling the button. Reuse it here so
  // requestPermission remains in the click's user-activation turn (Safari/iOS).
  const settings = preparedConfig || await config();
  if (!settings.enabled || !settings.publicKey) return {...settings,state:'inactive'};
  if (Notification.permission === 'denied') return {state:'denied'};
  // The only requestPermission call; invoked solely by the explicit UI button.
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') return {state:permission==='denied'?'denied':'inactive'};
  const reg = await registration();
  let subscription = await reg.pushManager.getSubscription();
  const key = vapidBytes(settings.publicKey);
  if (subscription?.options?.applicationServerKey &&
      Array.from(new Uint8Array(subscription.options.applicationServerKey)).join(',') !== Array.from(key).join(',')) {
    await deactivatePush(); subscription=null;
  }
  const created = !subscription;
  subscription ||= await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  const serialized = subscription.toJSON();
  const {error} = await requireSupabase().rpc('register_my_push_subscription',{
    p_endpoint:serialized.endpoint,p_p256dh:serialized.keys.p256dh,p_auth:serialized.keys.auth,p_platform:'web',
  });
  if (error) {
    if (created) await subscription.unsubscribe().catch(() => {});
    throw new Error('No se pudo activar este dispositivo. Intentá nuevamente.');
  }
  return getPushState();
}

export async function deactivatePush() {
  if (!supported()) return;
  const reg = await navigator.serviceWorker.getRegistration(base);
  const subscription = await reg?.pushManager.getSubscription();
  if (!subscription) return;
  let error;
  try { ({error} = await requireSupabase().rpc('unregister_my_push_subscription',{p_endpoint:subscription.endpoint})); }
  finally { await subscription.unsubscribe(); }
  if (error) throw new Error('El dispositivo se desuscribió; no se pudo confirmar la baja en el servidor.');
}

export async function sendNotificationPush(notificationId) {
  const summary={status:'complete',found:0,sent:0,failed:0,deactivated:0,limited:false};
  try {
    // Small server batches stay below the Edge wall-clock limit. The delivery ledger
    // excludes completed claims, so continuation never resends successful deliveries.
    for(let batch=0;batch<5;batch++) {
      const {data,error} = await requireSupabase().functions.invoke('send-notification-push',{body:{notification_id:notificationId}});
      if(error || !data) return {...summary,status:'unavailable'};
      if(!['complete','incidents'].includes(data.status)) return {...summary,status:data.status};
      for(const field of ['found','sent','failed','deactivated']) summary[field]+=Math.max(0,Number(data[field])||0);
      if(data.status==='incidents') summary.status='incidents';
      summary.limited=data.limited===true;
      if(!summary.limited)return summary;
    }
    return {...summary,status:'incidents'};
  } catch { return {...summary,status:'unavailable'}; }
}
