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

La revalidación pública de la corrección se entrega con el SHA final y el workflow posterior. La suite final push es 34/34 y la validación del build pasa.

## Backend y seguridad

push-config v1, send-notification-push v3 activos en DEV. HTTP 23/23: anónimo rechazado, socio sin permiso de envío, admin/superadmin autorizados, notification_id inexistente rechazado, notificación interna conservada ante push no configurado, sin destinatarios arbitrarios.

Config responde enabled=false/publicKey=null. No se enviaron pushes externos ni se generó un par VAPID operativo. No se publicaron endpoints, claves de suscripción, tokens ni credenciales en evidencias.

RLS 40/40 e integración 34/34 ejecutadas después de ambas migraciones; ver WEB_PUSH_DEV.md para detalle y alcance de cada test.

## Pendiente de VAPID, no aprobado end-to-end todavía

No se pudieron validar permiso granted en navegador real, suscripción real activa, recepción del proveedor, clic de una notificación real, ni ciclos de baja/reactivación con proveedor. Esas rutas están cubiertas automáticamente, pero no equivalen a recepción real. Tras configurar VAPID, usar un navegador compatible con permiso disponible y completar la secuencia indicada en WEB_PUSH_DEV.md.
