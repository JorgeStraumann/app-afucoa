/* No fetch handler or cache: authenticated data and credentials are never cached. */
const internalTarget = value => {
  if (typeof value !== 'string') return '#/notificaciones';
  return /^#\/(?:notificaciones|tramites|carnet|convenios|noticias|documentos|propuestas|cuenta|solicitudes\/[0-9a-f-]{36})?$/.test(value)
    ? value : '#/notificaciones';
};
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { /* Always use a generic notice. */ }
  event.waitUntil(self.registration.showNotification('AFUCOA', {
    body: 'Tenés una nueva notificación en AFUCOA.',
    tag: 'afucoa-notification',
    data: { target_path: internalTarget(payload.target_path) },
  }));
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
