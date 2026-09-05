# QA pública Web Push DEV

URL: https://jorgestraumann.github.io/app-afucoa/

Primer despliegue: `2a68ad4c23a8d41b6208e417059c22d55047c887`.
[Workflow 33831349107](https://github.com/JorgeStraumann/app-afucoa/actions/runs/33831349107): build y deploy success.

## Evidencia funcional observada

- Login de socio DEV10000001 en URL pública, sin localhost.
- Contraseña transitoria de QA restaurada inmediatamente después de iniciar sesión; comprobación de igualdad del hash original exitosa. Las credenciales de los otros DEV también se restauraron después de las suites.
- Refresh sobre GitHub Pages mantiene la sesión y permite abrir Mi Cuenta.
- Mi Cuenta conserva contacto/preferencias y presenta la nueva sección de dispositivo.
- Navegador disponible: Codex in-app browser. Estado observado: Permiso bloqueado. Activar aparece deshabilitado y no hay solicitud automática de permiso.
- Se detectó un defecto real de CSS: el display de .button sobreescribía hidden y mostraba Desactivar sin suscripción. Corregido mediante regla scoped .push-controls [hidden], con regresión automática añadida.
- Los errores de navegador se muestran con mensajes genéricos, sin propagar objetos de proveedor.

La suite final push es 44/44 y la validación del build pasa.

## Backend y seguridad

push-config y send-notification-push activos en DEV. HTTP 23/23: anónimo rechazado, socio sin permiso de envío, admin/superadmin autorizados, notification_id inexistente rechazado, notificación interna conservada, sin destinatarios arbitrarios.

VAPID DEV está configurado y sus secretos permanecen exclusivamente en Edge Function Secrets, sin publicar sus valores. El frontend recibe únicamente la clave VAPID pública. No se publicaron endpoints, claves privadas de suscripción, tokens ni credenciales en evidencias.

RLS 40/40 e integración 34/34 ejecutadas después de ambas migraciones; ver WEB_PUSH_DEV.md para detalle y alcance de cada test.

## Cierre posterior

La validación real final confirmó la entrega Web Push end-to-end en navegador/Windows. Logout conserva la suscripción: no ejecuta `unregister_my_push_subscription` y el dispositivo del usuario DEV `10000001` permanece activo con la sesión cerrada. La reasignación segura por cambio de cuenta y la protección adminOnly server-side/RLS se mantienen además de la visibilidad de UI.

Con `10000001` deslogueado, el admin DEV `10000002` envió una notificación que terminó con `status=sent` y produjo un toast visible en Windows/Chrome. Una segunda notificación distinta enviada inmediatamente después también terminó con `status=sent` y produjo un segundo toast visible.

Queda confirmado que `afucoa-<notification_id>` genera tags diferentes para notificaciones internas distintas y evita que se reemplacen entre sí. Un retry de la misma `notification_id` conserva el mismo tag para deduplicación. No se usa `renotify`.

El payload cifrado continúa sin título, body ni PII: contiene únicamente `target_path`, `profile_id` y `notification_id` como datos técnicos mínimos y UUID opacos. Web Push no garantiza entrega exactly-once.
