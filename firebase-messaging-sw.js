/* Service worker de notificaciones push de AFUCOA (Firebase Cloud Messaging) */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDqEWyShhf_PXHcgC3pd08PItgPyTpLNFA",
  authDomain: "afucoa-app.firebaseapp.com",
  projectId: "afucoa-app",
  storageBucket: "afucoa-app.firebasestorage.app",
  messagingSenderId: "142637438305",
  appId: "1:142637438305:web:577e2cf4c151dcf97f6120"
});

const messaging = firebase.messaging();

// cuando llega una notificación y la app está cerrada / en segundo plano
messaging.onBackgroundMessage(function(payload) {
  const titulo = (payload.notification && payload.notification.title) || 'AFUCOA';
  const opciones = {
    body: (payload.notification && payload.notification.body) || '',
    icon: 'logo-header.png',
    badge: 'logo-header.png',
    data: { url: (payload.data && payload.data.url) || './' }
  };
  self.registration.showNotification(titulo, opciones);
});

// al tocar la notificación, abrir la app
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(lista) {
      for (const cliente of lista) {
        if ('focus' in cliente) return cliente.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
