# AFUCOA V2 — configuración runtime de Edge Functions

Estado: código versionado en `afucoa-v2`; las cuatro funciones están validadas en DEV y las dos funciones Push fueron desplegadas y validadas E2E en PROD durante Fase 3I

Alcance: recuperación de acceso y Web Push

Implementación compartida: `supabase/functions/_shared/runtime-config.ts`

Origin PROD aprobado y configurado como única allowlist server-side Push: `https://afucoa-v2-prod.pages.dev`. No se permiten previews, GitHub Pages, localhost ni origins DEV.

## Objetivo

Las cuatro Edge Functions admitidas para producción consumen una configuración explícita por ambiente y fallan cerradas cuando es inválida. El código ejecutable ya no usa la URL de DEV ni orígenes de staging/localhost como defaults.

No se agregó ninguna variable al frontend. La clave privilegiada permanece exclusivamente en el runtime server-side y no se imprime, serializa ni devuelve.

## Variables obligatorias compartidas

| Variable | DEV | PROD | Regla |
| --- | --- | --- | --- |
| `AFUCOA_ENV` | `dev` | `prod` | Obligatoria; cualquier otro valor falla cerrado. |
| `AFUCOA_ALLOWED_ORIGINS` | Lista explícita de origins DEV necesarios | Lista explícita de origins PROD HTTPS | CSV, sin wildcard, paths, query, fragment, credenciales ni entradas vacías. No hay defaults. |
| `SUPABASE_URL` | La URL server-side provista por el proyecto DEV | La URL provista por el proyecto PROD | Obligatoria, HTTPS, host `*.supabase.co`, sin path/query/fragment/credenciales. PROD rechaza el project ref DEV. |
| `SUPABASE_SECRET_KEYS` | Mapa JSON server-side provisto por Supabase DEV | Mapa JSON server-side provisto por Supabase PROD | Debe contener una nueva Secret API Key `sb_secret_*`; nunca `VITE_*`, frontend, repositorio, respuestas o logs. |
| `AFUCOA_SECRET_KEY_NAME` | Nombre explícito de la clave activa DEV | Nombre explícito de la clave activa PROD | Opcional; usa `default` si no se define. Solo selecciona una entrada del mapa y no contiene el valor de la clave. |

Las cuatro Edge Functions usan `SUPABASE_URL` y una entrada de `SUPABASE_SECRET_KEYS`. DEV migró y validó este contrato antes de desactivar sus legacy API keys. El código ya no lee `SUPABASE_SERVICE_ROLE_KEY`.

Variables adicionales que conservan su semántica:

- recuperación: `RESEND_API_KEY`, `RECOVERY_EMAIL_FROM`;
- push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

`RECOVERY_ALLOWED_ORIGINS` ya no se lee. Todos los handlers usan exclusivamente `AFUCOA_ALLOWED_ORIGINS` para evitar listas divergentes.

## Validación fail-closed

`runtime-config.ts`:

- valida la presencia y el valor de `AFUCOA_ENV`;
- valida y normaliza la URL Supabase sin fallback;
- exige el mapa de Secret API Keys, selecciona una entrada válida `sb_secret_*` y la conserva como propiedad no enumerable;
- retira únicamente un fallback `Authorization: Bearer <secret key>` y mantiene `apikey` más el JWT real del usuario para que Auth/RLS/AAL sigan siendo efectivos;
- normaliza cada origin a `URL.origin` y rechaza wildcard, paths, query, fragment, credenciales, duplicados y elementos vacíos;
- en PROD rechaza HTTP, localhost, subdominios `.localhost`, loopback IPv4/IPv6, el origen del staging GitHub Pages y el project ref DEV;
- en DEV permite localhost únicamente cuando aparece explícitamente en la lista;
- emite solo el error estable `runtime_configuration_invalid`, sin valores de configuración.

Las cuatro funciones devuelven un error genérico y no realizan I/O de negocio si la configuración no carga.

## Contrato CORS

- Un `Origin` permitido se devuelve exactamente en `Access-Control-Allow-Origin`.
- Un `Origin` no permitido recibe HTTP 403, sin reflexión y sin origin alternativo de fallback.
- Todas las respuestas incluyen `Vary: Origin`.
- `OPTIONS` solo devuelve 204 cuando contiene un origin permitido. Sin origin o con origin ajeno devuelve 403.
- No se acepta `*`.

Los POST server-to-server sin header `Origin` se conservan. CORS es un control del navegador, no una autenticación de servidores: recuperación mantiene validación de cuerpo y límites IP/identidad/global; push exige JWT real con `auth.getUser`, perfil activo y rol cuando corresponde. Las respuestas sin `Origin` no incluyen `Access-Control-Allow-Origin`.

## Inventario de producción

`supabase/functions/PRODUCTION_FUNCTIONS.json` permite exactamente:

1. `request-password-recovery`;
2. `confirm-password-recovery`;
3. `push-config`;
4. `send-notification-push`.

`dev-seed-test-users` no forma parte del manifiesto y no debe desplegarse en PROD.

`scripts/check-edge-runtime-config.mjs` falla si el inventario cambia, falta un entrypoint, aparece una función DEV/test, reaparecen hardcodes DEV fuera del validador de rechazo, existen fallbacks URL silenciosos o un handler deja de consumir la configuración compartida.

## Despliegue y validación real en DEV — Fases 2C/3H

La parametrización de Fase 2B fue desplegada posteriormente solo en AFUCOA V2 DEV. Las cuatro funciones quedaron `ACTIVE`:

| Función | Versión DEV validada |
| --- | ---: |
| `request-password-recovery` | 32 |
| `confirm-password-recovery` | 30 |
| `push-config` | 16 |
| `send-notification-push` | 19 |

El runtime DEV tiene `AFUCOA_ENV=dev`, una lista explícita en `AFUCOA_ALLOWED_ORIGINS` y selección server-side de la nueva Secret API Key. `SUPABASE_URL`, el mapa y la clave permanecen fuera del frontend; Resend y VAPID existentes fueron preservados. Recovery, Push y MFA LIVE pasaron después de la migración. Las legacy API keys DEV quedaron desactivadas. Este documento no publica nombres internos de claves, valores de origins, claves, remitentes ni secretos.

La recuperación real con el usuario sintético DEV `10000001` completó solicitud desde staging, recepción del correo, recepción y aceptación del código de ocho dígitos, cambio de contraseña y login con la contraseña nueva. La evidencia en base registró `delivery_status=sent`, `consumed=true` e `invalidated=false`. No se conserva aquí el código ni la contraseña.

Web Push también fue revalidado después del despliegue: con `10000001` deslogueado, logout conservó las notificaciones y un envío administrativo produjo toast en Windows/Chrome. La última notificación generó dos deliveries enviados, cero fallidos y cero inactivos porque el perfil tenía dos endpoints web activos distintos. No fue una duplicación sobre el mismo endpoint; representa dos suscripciones válidas y el diseño admite múltiples dispositivos o contextos. No corresponde desactivar ni limpiar esas suscripciones como parte de este cierre documental.

## Despliegue PROD Push — Fase 3I

Desde el SHA `aff2a701590cb60ba14067ed5139478e2ba3b87c` se desplegaron únicamente `push-config` v1 y `send-notification-push` v1 en `rywdochyzhgfaymrmxek`. Quedaron `ACTIVE` con `AFUCOA_ENV=prod`, origin canónico exclusivo, Secret API Key PROD seleccionada y un par VAPID nuevo/exclusivo cuyo subject es `https://afucoa-v2-prod.pages.dev`. Recovery no fue desplegado.

Las Secret API Keys opacas no son JWT; las funciones usan gateway `verify_jwt=false` y validan obligatoriamente el JWT real del usuario dentro del handler mediante `auth.getUser`, perfil activo y AAL2 para envío administrativo. La clave server-side nunca sustituye ese JWT.

La evidencia de seguridad, entrega real Windows/Chrome, ledger, retry, logout, reconciliación, baja y cleanup está en `docs/PROD_WEB_PUSH.md`. B05 quedó cerrado; B04/Recovery permanece abierto y no recibió configuración ni deploy PROD.

## Verificación local

```text
pnpm test:edge-config
```

La suite ejecuta los escenarios unitarios y el inventario estático. También forma parte de `pnpm test:staging`. No necesita red, secretos ni conexión a Supabase.
