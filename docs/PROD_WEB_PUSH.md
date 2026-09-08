# AFUCOA V2 — Web Push PROD / Fase 3I

Fecha de validación: 8 de septiembre de 2026 (America/Montevideo)

Proyecto: Supabase PROD `rywdochyzhgfaymrmxek`

Origin canónico: `https://afucoa-v2-prod.pages.dev`

SHA fuente del deploy Edge: `aff2a701590cb60ba14067ed5139478e2ba3b87c`

Estado: **B05 CLOSED**. La validación usó únicamente identidades y contenido inequívocamente sintéticos, eliminados al finalizar. Web Push no ofrece semántica exactly-once: el transporte es at-least-once y AFUCOA agrega claim/deduplicación server-side.

## Infraestructura desplegada

- Se generó un par VAPID nuevo y exclusivo de PROD. Nunca se copió VAPID DEV.
- `VAPID_SUBJECT=https://afucoa-v2-prod.pages.dev`.
- La clave privada existe solo como Edge Function Secret; no se incorporó a Git, docs, frontend, artifacts ni logs.
- Runtime: `AFUCOA_ENV=prod`, allowlist con el único origin canónico y selección de la Secret API Key PROD activa mediante `AFUCOA_SECRET_KEY_NAME`. `SUPABASE_URL` y `SUPABASE_SECRET_KEYS` son defaults server-side del proyecto.
- No hay wildcard CORS; GitHub Pages staging, localhost y origins ajenos devolvieron HTTP 403.
- Se desplegaron exclusivamente `push-config` v1 y `send-notification-push` v1. Ambas quedaron `ACTIVE` el 8 de septiembre de 2026 a las 02:04 UTC. Recovery no se desplegó.

Las nuevas Secret API Keys son opacas y no son JWT. Por eso el gateway figura con `verify_jwt=false`; la autenticación de usuario continúa activa dentro de ambos handlers: exigen `Authorization: Bearer <JWT de usuario>`, validan el token con `auth.getUser`, perfil activo y, para envío, rol admin/superadmin más claim `aal=aal2`. La Secret API Key se usa únicamente como `apikey` server-side y nunca sustituye el JWT real del usuario.

## Security check LIVE

| Escenario | Resultado |
| --- | --- |
| `push-config` sin JWT | HTTP 401, DENIED |
| `push-config` socio AAL1, origin canónico | HTTP 200; solo `enabled` y `publicKey` |
| `push-config` origin staging, localhost o ajeno | HTTP 403, DENIED |
| `send-notification-push` sin JWT | HTTP 401, DENIED |
| `send-notification-push` socio AAL1 | HTTP 403, DENIED |
| `send-notification-push` admin AAL1 | HTTP 403, DENIED |
| `send-notification-push` admin AAL2 | Autorizado; UUID inexistente produjo el 404 de negocio esperado |

El harness `tests/push-prod-live.mjs` exige project ref y URL exactos, falla si PROD no está vacío, genera passwords/TOTP aleatorios solo de forma efímera, usa logout local durante pruebas y tiene cleanup por marcas sintéticas. Nunca imprime credenciales, TOTP, tokens, endpoints ni claves.

## E2E físico y ciclo del dispositivo

- Navegador real: Google Chrome sobre Windows, origin canónico PROD.
- Service Worker, permiso por gesto explícito, PushSubscription HTTPS, registro RPC y ownership quedaron operativos.
- Una notificación sintética encontró 1 target, envió 1, falló 0 y desactivó 0. Jorge confirmó el toast visible en Windows/Chrome.
- El ledger registró una sola fila `sent`, con `attempts=1`.
- El retry del mismo `notification_id` devolvió `found=0`, `sent=0`; no hubo segundo toast.
- Después de eliminar el primer lote sintético, el mismo navegador inició sesión con una identidad sintética nueva. La suscripción existente se reasoció mediante RPC al perfil autenticado y permaneció exactamente 1 dispositivo activo: no hubo duplicado ni mezcla de destinatarios.
- Logout mantuvo el dispositivo `active=1`. Una notificación distinta, enviada con el socio deslogueado, quedó `sent` y generó otro toast real en Chrome/Windows.
- La acción explícita **Desactivar notificaciones** cambió el dispositivo a `active=0`. Un envío posterior encontró 0 targets y no creó filas de ledger.
- Edge se probó manualmente, pero no produjo una segunda suscripción independiente; el objetivo multidispositivo era ideal, no criterio singular de cierre. El contrato automático cubre múltiples dispositivos, reasignación y límites.

La corrección de copy del frontend aclara el comportamiento real: cerrar sesión no desactiva el dispositivo. No se solicita permiso automáticamente.

## Payload y privacidad

El payload cifrado está limitado a:

- `target_path` interno normalizado;
- `profile_id` UUID opaco para el guard de ownership;
- `notification_id` UUID opaco para tag/deduplicación.

No contiene nombre, documento, email, teléfono, título interno ni cuerpo interno. El Service Worker muestra título/body genéricos, rechaza ownership incorrecto y destinos hostiles, usa un tag determinístico por `notification_id` y no usa `renotify`.

## 404/410 y reintentos

No se forzó un 404/410 LIVE porque la invalidación del endpoint por el proveedor no es determinística. No se inventó evidencia. La combinación aceptada es:

- ciclo LIVE de alta, entrega, persistencia tras logout, reasignación y baja explícita;
- contrato automático que ejecuta respuestas 404 y 410 y verifica `push_devices.active=false` más delivery `inactive`;
- contrato automático que conserva el dispositivo ante 5xx;
- claim atómico que permite reintentar fallos transitorios después de 60 segundos, hasta tres intentos, sin reenviar deliveries `sent`.

Un claim `sending` interrumpido no se reintenta automáticamente para evitar duplicados; requiere revisión operativa. El batch server-side es 40 targets, concurrencia 4, timeout 8 segundos y TTL 300 segundos. El frontend puede continuar hasta cinco batches.

## Observabilidad y respuesta

Registrar métricas agregadas `found`, `sent`, `failed`, `skipped`, `deactivated`, `limited` e incidentes por status. El ledger privado es `public.notification_push_deliveries`; no se expone a `anon`/`authenticated` ni incluye endpoint. Nunca registrar un endpoint completo.

- 404/410: confirmar delivery `inactive` y dispositivo desactivado; investigar si la tasa crece.
- 5xx/timeout: conservar dispositivo, respetar ventana y máximo de retries, revisar incidentes del proveedor.
- `sending` estancado: revisar manualmente antes de cualquier nueva entrega.
- `limited=true`: continuar lotes acotados y vigilar duración/volumen.
- discrepancia entre recipients y targets: revisar preferencias, perfil activo, kill switch y ownership.

La integración con alertas externas sigue dentro de B09; no invalida el cierre técnico de B05.

## Cleanup final

Se ejecutaron tres ciclos controlados durante el diagnóstico del login físico, siempre con máximo dos identidades concurrentes. En total se crearon y eliminaron 6 Auth users sintéticos (3 socios y 3 admins), con sus profiles/factores/datos asociados. El estado final verificado fue:

- Auth users: 0;
- profiles: 0;
- factores MFA sintéticos: 0, por eliminación de sus Auth users;
- push devices sintéticos: 0;
- notifications sintéticas: 0;
- delivery rows sintéticas: 0;
- Storage objects: 0, sin cambios respecto del baseline.

No se usaron datos reales, no se desplegó Recovery, no se tocó V1, `main`, Pilot 01 ni DNS.
