/* No fetch handler or cache: authenticated data and credentials are never cached. */
const internalTarget = value => {
  if (typeof value !== 'string') return '#/notificaciones';
  return /^#\/(?:notificaciones|tramites|carnet|convenios|noticias|documentos|propuestas|cuenta|solicitudes\/[0-9a-f-]{36})?$/.test(value)
    ? value : '#/notificaciones';
};
const notificationUuid = value => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  ? value.toLowerCase() : null;
const ownerDb = () => new Promise((resolve,reject) => {
  const request=indexedDB.open('afucoa-push-state',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('state');
  request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error);
});
const readOwner=async () => {
  const db=await ownerDb();
  const value=await new Promise((resolve,reject)=>{const request=db.transaction('state').objectStore('state').get('profile');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  db.close();return value;
};
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { /* Always use a generic notice. */ }
  event.waitUntil((async()=>{
    const owner=await readOwner().catch(()=>null);
    if(!owner || payload.profile_id!==owner)return;
    const notificationId=notificationUuid(payload.notification_id);
    return self.registration.showNotification('AFUCOA', {
      body:'Tenés una nueva notificación en AFUCOA.',
      ...(notificationId?{tag:`afucoa-${notificationId}`}:{}),
      data:{target_path:internalTarget(payload.target_path)},
    });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const base = new URL(self.registration.scope);
  const destination = new URL(internalTarget(event.notification.data?.target_path), base).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for (const client of windows) {
      const url = new URL(client.url);
      if (url.origin === base.origin && url.pathname === base.pathname) {
        try { await client.navigate(destination); return await client.focus(); } catch { /* Try another window. */ }
      }
    }
    return self.clients.openWindow(destination);
  })());
});
