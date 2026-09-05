# Web Push — AFUCOA V2 DEV

Implementación sobre baseline `0adc63eb42ba93454c17599f4c02d5376791b2be`, exclusivamente `afucoa-v2` y proyecto `imiplnspvmsrsuikulwm`. Pilot 01 suspendido; sin importaciones ni cambios a main, V1 o producción.

## Diseño y archivos

- `public/push-sw.js`: worker sin caché ni interceptación fetch, scope `/app-afucoa/`. El payload cifrado contiene exclusivamente `target_path`, `profile_id` y el UUID opaco `notification_id`; no contiene título, cuerpo ni PII. Título y cuerpo siempre son genéricos, incluso si llega un payload con texto privado. El UUID validado produce un tag determinístico por notificación: dos notificaciones distintas generan avisos distintos y un retry de la misma conserva la deduplicación. Payloads legacy o IDs inválidos se muestran sin tag.
- `src/services/push-service.js`: soporte, worker, permiso solo por clic, configuración pública, suscripción, alta/baja/touch RPC. Logout conserva la suscripción. Cada login/refresh toca la suscripción si mantiene dueño o la reasocia atómicamente si cambió la cuenta, antes de exponer la sesión de app.
- `src/components/push-controls.js` y Mi Cuenta: cuatro estados, instrucciones discretas, botón deshabilitado si falta configuración o está apagado allowPush.
- Admin mantiene notifications/notification_recipients aunque falle push. Muestra cantidades agregadas, sin endpoints ni claves. Máximo 40 dispositivos por llamada, concurrencia 4 y timeout de proveedor 8 segundos; hasta cinco lotes desde frontend. Un envío parcial se identifica como incidencia.
- Edge `push-config`: perfil activo autenticado, devuelve exclusivamente enabled/publicKey.
- Edge `send-notification-push`: getUser verifica JWT y el rol se obtiene de profiles, nunca de metadata editable. Solo admin/superadmin. notification_id es la fuente de destinatarios; ignora destinatarios arbitrarios. CORS restringido y cuerpo limitado. Gateway verify_jwt=false porque ambas funciones implementan autenticación explícita; esto NO significa acceso anónimo.
- `_shared/runtime-config.ts`: configuración explícita `dev|prod`, URL Supabase server-side y origins sin defaults; PROD rechaza HTTP, loopback, staging GitHub y project ref DEV. `_shared/push-http.ts` consume esa configuración para autenticación/CORS.
- `_shared/push-policy.ts`: payload seguro, whitelist HTTPS de proveedores, cifrado aes128gcm/VAPID mediante web-push 3.6.7 fijado. Redirecciones bloqueadas y errores del proveedor nunca registrados.

La parametrización de Fase 2B está versionada, desplegada y validada E2E únicamente en DEV. `push-config` v9 y `send-notification-push` v12 quedaron `ACTIVE`; el runtime usa `AFUCOA_ENV=dev`, `AFUCOA_ALLOWED_ORIGINS` explícita y las variables Supabase server-side. VAPID existente fue preservado y no se publican valores de configuración ni secretos.

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

Última ejecución completa: 2026-09-05 Uruguay.

| Suite | Resultado |
| --- | --- |
| test:edge-config | 12/12 + inventario/hardcodes PASS; exclusivamente local |
| test:staging | PASS; 5 archivos, sin source maps ni secretos privilegiados |
| test:session | 11/11 |
| test:recovery | 13/13; no se reenvió correo real |
| test:pilot | 6/6, exclusivamente sintética |
| test:push | 44/44 |
| test:navigation | 5/5 |
| tests/push-rls.sql | PASS; transacción revertida |
| tests/push-http-live.mjs | 23/23, endpoints desplegados DEV |
| test:session-live | 8/8 |
| test:rls | 40/40 |
| test:integration | 34/34 |

Cobertura A–H/M/V: frontend con API de navegador simulada y código real de servicio. I–L: mapeo unitario y filtros SQL reales. N–P: autenticación de servidor unitaria y HTTP con los tres roles DEV. Q/R: proveedor simulado 201/404/410/500 con dispatcher real. S/T/U: ejecución real del script worker en VM, ventana abierta/cerrada y destinos hostiles. Cifrado aes128gcm y firma VAPID reales con claves efímeras solo en memoria, sin contactar un proveedor.

Las suites HTTP utilizaron credenciales transitorias exclusivamente para las tres identidades DEV. Los hashes de contraseña y roles originales se restauraron y se verificaron por igualdad al terminar. No se publican credenciales ni hashes. La contraseña anteriormente disponible de 10000001 fue rechazada; no se la sustituyó permanentemente. La matriz de aislamiento asigna temporalmente rol socio a DEV10000002 y lo restituye a admin. Las suites existentes dejan fixtures de negocio identificados como sintéticos DEV; el archivo de Storage creado por integración fue retirado por su cleanup.

## Seguridad y Advisor

El build se escanea por nombres de secretos, sb_secret, service_role, PEM y JWT privilegiados. Frontend solo recibe la publishable key DEV y la clave VAPID pública.

Las advertencias SECURITY DEFINER de las tres RPC push son intencionales y revisadas: identidad derivada del JWT y columnas privadas no expuestas. Ledger con RLS sin policies es intencionalmente server-only, igual que rate limits de recuperación. Los índices FK nuevos sin uso aún se conservan. No se debilita seguridad para eliminar avisos.

- [RLS sin policies / tablas server-only](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [SECURITY DEFINER autenticadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Índices sin uso inicial](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
- [Leaked Password Protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) sigue pendiente antes de producción; fuera de esta fase DEV.

## Estado operativo y límites

VAPID DEV está configurado exclusivamente en Edge Function Secrets, sin publicar sus valores. Jorge confirmó la prueba Web Push real end-to-end en DEV: Admin, notificación interna, recipient, Edge Function, proveedor y navegador/Windows. Los secretos VAPID nunca se incorporaron a VITE, GitHub ni el repositorio.

El cierre posterior corrige que logout desactivaba el dispositivo. La validación real confirmó que logout conserva la suscripción, no ejecuta `unregister_my_push_subscription` y mantiene activo el dispositivo del usuario DEV `10000001` aun con la sesión cerrada. El único mecanismo de baja es el botón explícito. Un fallo de reconciliación no cierra Supabase Auth, pero evita exponer una sesión de app vinculada al dueño anterior y permite reintentar con el siguiente evento Auth.

Con `10000001` deslogueado, el admin DEV `10000002` envió una notificación: la entrega terminó con `status=sent` y apareció como toast en Windows/Chrome. Una segunda notificación distinta, enviada inmediatamente después, también terminó con `status=sent` y produjo un segundo toast visible. La validación confirma que distintas `notification_id` generan tags diferentes y no se reemplazan entre sí. Un retry de la misma `notification_id` conserva el mismo tag para deduplicación; no se usa `renotify`.

Después del despliegue parametrizado se repitió la validación real con `10000001` deslogueado: una nueva notificación administrativa produjo correctamente los toast en Windows/Chrome. La evidencia server-side de la última notificación registró dos deliveries para `10000001`, ambos `sent`, con cero `failed` y cero `inactive`. Existen dos endpoints web activos distintos para ese perfil; por tanto, no fue una doble entrega al mismo endpoint sino un envío a dos suscripciones válidas. El diseño soporta múltiples dispositivos o contextos del navegador. No se desactivan ni limpian esas suscripciones como parte de Fase 2C.

El payload Web Push cifrado no incluye título, body, cédula, nombre, email ni otra PII. Contiene únicamente datos técnicos mínimos: `target_path`, `profile_id` y `notification_id`, con UUID opacos. Web Push no garantiza entrega exactly-once: el ledger y el tag determinístico reducen duplicados, pero el proveedor, el navegador y el sistema operativo conservan semántica de entrega propia.

Chrome/Edge/Firefox compatibles requieren contexto HTTPS y soporte del sistema. iOS/iPadOS requiere una versión compatible y la app agregada a Inicio; el permiso debe solicitarse por gesto explícito. Navegadores embebidos o privados pueden carecer de PushManager. El sistema operativo/proveedor puede demorar o suprimir avisos. No se implementó modo offline ni caché privada.

## QA pública y SHA

El resultado del workflow, SHA desplegado y comprobación pública se registran en `WEB_PUSH_STAGING_QA.md` después del despliegue.
