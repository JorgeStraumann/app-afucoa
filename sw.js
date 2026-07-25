/* Service worker mínimo: guarda la app para que abra sin conexión. */
const CACHE = 'afucoa-v2';
const ARCHIVOS = [
  'index.html',
  'manifest.json',
  'logo-header.png',
  'icono-192.png',
  'icono-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(claves =>
      Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(resp => resp || fetch(e.request))
  );
});
