/* Service worker de AFUCOA.
   Estrategia: "network-first" (primero internet) para que la app SIEMPRE
   se actualice cuando hay conexión, y solo use la copia guardada si no hay internet. */

const CACHE = 'afucoa-v4';
const ARCHIVOS = [
  'index.html',
  'manifest.json',
  'logo-header.png',
  'fondo-palacio.jpg',
  'icono-192.png',
  'icono-512.png'
];

// Al instalar: guardar una copia base y activarse de inmediato
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).catch(()=>{})
  );
  self.skipWaiting();  // el service worker nuevo toma control enseguida
});

// Al activarse: borrar las cachés viejas
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(claves =>
      Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(()=> self.clients.claim())
  );
});

// Al pedir un archivo:
self.addEventListener('fetch', e => {
  const req = e.request;

  // Solo manejamos GET; el resto (POST a Supabase, etc.) pasa directo
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // No tocar pedidos a otros dominios (Supabase, Firebase, CDNs): van directo a la red
  if (url.origin !== self.location.origin) return;

  // Para el index.html y la navegación: SIEMPRE intentar la red primero (traer lo último)
  const esPaginaPrincipal = req.mode === 'navigate' ||
                            url.pathname.endsWith('/') ||
                            url.pathname.endsWith('index.html');

  if (esPaginaPrincipal) {
    e.respondWith(
      fetch(req)
        .then(resp => {
          const copia = resp.clone();
          caches.open(CACHE).then(c => c.put('index.html', copia)).catch(()=>{});
          return resp;
        })
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  // Para el resto de archivos propios: red primero, con respaldo en caché
  e.respondWith(
    fetch(req)
      .then(resp => {
        const copia = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copia)).catch(()=>{});
        return resp;
      })
      .catch(() => caches.match(req))
  );
});
