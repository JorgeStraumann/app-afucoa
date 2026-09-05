# Web Push — AFUCOA V2 DEV

Implementación sobre baseline `0adc63eb42ba93454c17599f4c02d5376791b2be`, exclusivamente `afucoa-v2` y proyecto `imiplnspvmsrsuikulwm`. Pilot 01 suspendido; sin importaciones ni cambios a main, V1 o producción.

## Diseño y archivos

- `public/push-sw.js`: worker sin caché ni interceptación fetch, scope `/app-afucoa/`. El payload solo contiene una ruta hash validada. Título y cuerpo siempre genéricos, incluso si llega un payload con texto privado.
- `src/services/push-service.js`: soporte, worker, permiso solo por clic, configuración pública, suscripción, alta/baja/touch RPC. Logout conserva la suscripción. Cada login/refresh toca la suscripción si mantiene dueño o la reasocia atómicamente si cambió la cuenta, antes de exponer la sesión de app.
- `src/components/push-controls.js` y Mi Cuenta: cuatro estados, instrucciones discretas, botón deshabilitado si falta configuración o está apagado allowPush.
- Admin mantiene notifications/notification_recipients aunque falle push. Muestra cantidades agregadas, sin endpoints ni claves. Máximo 40 dispositivos por llamada, concurrencia 4 y timeout de proveedor 8 segundos; hasta cinco lotes desde frontend. Un envío parcial se identifica como incidencia.
- Edge `push-config`: perfil activo autenticado, devuelve exclusivamente enabled/publicKey.
- Edge `send-notification-push`: getUser verifica JWT y el rol se obtiene de profiles, nunca de metadata editable. Solo admin/superadmin. notification_id es la fuente de destinatarios; ignora destinatarios arbitrarios. CORS restringido, cuerpo limitado, URL DEV fijada. Gateway verify_jwt=false porque ambas funciones implementan autenticación explícita; esto NO significa acceso anónimo.
- `_shared/push-http.ts`, `_shared/push-policy.ts`: autenticación, payload seguro, whitelist HTTPS de proveedores, cifrado aes128gcm/VAPID mediante web-push 3.6.7 fijado. Redirecciones bloqueadas y errores del proveedor nunca registrados.

## Migraciones aplicadas y versionadas

1. `20260904023548_web_push_dev.sql`: endpoint único, claves de suscripción privadas, índices, RPC de propietario y ledger server-only.
2. `20260904024725_web_push_active_device_limit.sql`: máximo 20 dispositivos ACTIVOS por perfil con bloqueo transaccional. Bajas anteriores no agotan una cuota vitalicia.
3. `20260905002735_reconcile_existing_push_subscription.sql`: permite reasociar una suscripción existente y con claves coincidentes aun bajo kill switch, sin permitir nuevas altas. La identidad sigue derivándose de Auth.

La tabla inicial estaba vacía; token legacy permanece nullable. El cambio de propietario exige posesión del mismo endpoint y ambas claves. Las escrituras directas y la lectura de endpoint/claves están revocadas a clientes; solo se permiten columnas de estado propias. Las RPC derivan identidad de auth.uid/current_profile_id y fijan search_path. No se modificaron funciones SECURITY DEFINER ajenas a esta fase.

Ledger: claims atómicos evitan envíos concurrentes duplicados; un envío confirmado no se repite. 404/410 desactivan; 5xx conservan la suscripción. Fallos pueden reintentarse después de 60 segundos, hasta tres intentos. Un claim interrumpido en estado sending no se reintenta automáticamente para evitar duplicación; requiere revisión operativa. Web Push no garantiza recepción exactamente una vez.

## Preferencias

| Tipo | Preferencia |
| --- | --- |
| convenio | agreements |
| evento | events |
| tramite | request_updates |
| institucional, documento, propuesta, sistema | news |

allowPush=false bloquea nuevas altas y envíos; el centro interno permanece disponible. El servidor revalida preferencias, destinatario, actividad y kill switch en el claim.

## Pruebas ejecutadas

Fecha: 2026-09-03 Uruguay / 2026-09-04 UTC.

| Suite | Resultado |
| --- | --- |
| test:staging | PASS; 5 archivos, sin source maps ni secretos privilegiados |
| test:session | 11/11 |
| test:recovery | 11/11; no se reenvió correo real |
| test:pilot | 6/6, exclusivamente sintética |
| test:push | 38/38 |
| test:navigation | 5/5 |
| tests/push-rls.sql | PASS; transacción revertida |
| tests/push-http-live.mjs | 23/23, endpoints desplegados DEV |
| test:session-live | 8/8 |
| test:rls | 40/40 |
| test:integration | 34/34 |

Cobertura A–H/M/V: frontend con API de navegador simulada y código real de servicio. I–L: mapeo unitario y filtros SQL reales. N–P: autenticación de servidor unitaria y HTTP con los tres roles DEV. Q/R: proveedor simulado 201/404/410/500 con dispatcher real. S/T/U: ejecución real del script worker en VM, ventana abierta/cerrada y destinos hostiles. Cifrado aes128gcm y firma VAPID reales con claves efímeras solo en memoria, sin contactar un proveedor.

Las suites HTTP utilizaron credenciales transitorias exclusivamente para las tres identidades DEV. Los hashes de contraseña y roles originales se restauraron y se verificaron por igualdad al terminar. No se publican credenciales ni hashes. La contraseña anteriormente disponible de 10000001 fue rechazada; no se la sustituyó permanentemente. La matriz de aislamiento asigna temporalmente rol socio a DEV10000002 y lo restituye a admin. Las suites existentes dejan fixtures de negocio identificados como sintéticos DEV; el archivo de Storage creado por integración fue retirado por su cleanup.

## Seguridad y Advisor

El build se escanea por nombres de secretos, sb_secret, service_role, PEM y JWT privilegiados. Frontend solo recibe la publishable key DEV y, cuando se configure, la VAPID pública.

Las advertencias SECURITY DEFINER de las tres RPC push son intencionales y revisadas: identidad derivada del JWT y columnas privadas no expuestas. Ledger con RLS sin policies es intencionalmente server-only, igual que rate limits de recuperación. Los índices FK nuevos sin uso aún se conservan. No se debilita seguridad para eliminar avisos.

- [RLS sin policies / tablas server-only](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [SECURITY DEFINER autenticadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Índices sin uso inicial](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
- [Leaked Password Protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) sigue pendiente antes de producción; fuera de esta fase DEV.

## Estado operativo y límites

Jorge confirmó la prueba Web Push real end-to-end en DEV: Admin, notificación interna, recipient, Edge Function, proveedor y navegador/Windows. Los secretos VAPID continúan exclusivamente en Edge Function Secrets; nunca en VITE, GitHub ni el repositorio.

El cierre posterior corrige que logout desactivaba el dispositivo. El único mecanismo de baja es ahora el botón explícito. Un fallo de reconciliación no cierra Supabase Auth, pero evita exponer una sesión de app vinculada al dueño anterior y permite reintentar con el siguiente evento Auth.

Chrome/Edge/Firefox compatibles requieren contexto HTTPS y soporte del sistema. iOS/iPadOS requiere una versión compatible y la app agregada a Inicio; el permiso debe solicitarse por gesto explícito. Navegadores embebidos o privados pueden carecer de PushManager. El sistema operativo/proveedor puede demorar o suprimir avisos. No se implementó modo offline ni caché privada.

## QA pública y SHA

El resultado del workflow, SHA desplegado y comprobación de UI pública se registran en `WEB_PUSH_STAGING_QA.md` después del despliegue. La aprobación del código no equivale a recepción push real: esta última está bloqueada por la configuración VAPID.
