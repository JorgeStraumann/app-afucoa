# AFUCOA V2 — configuración runtime de Edge Functions

Estado: código versionado en `afucoa-v2`, desplegado y validado E2E únicamente en AFUCOA V2 DEV; no desplegado en PROD

Alcance: recuperación de acceso y Web Push

Implementación compartida: `supabase/functions/_shared/runtime-config.ts`

## Objetivo

Las cuatro Edge Functions admitidas para producción consumen una configuración explícita por ambiente y fallan cerradas cuando es inválida. El código ejecutable ya no usa la URL de DEV ni orígenes de staging/localhost como defaults.

No se agregó ninguna variable al frontend. La clave privilegiada permanece exclusivamente en el runtime server-side y no se imprime, serializa ni devuelve.

## Variables obligatorias compartidas

| Variable | DEV | PROD | Regla |
| --- | --- | --- | --- |
| `AFUCOA_ENV` | `dev` | `prod` | Obligatoria; cualquier otro valor falla cerrado. |
| `AFUCOA_ALLOWED_ORIGINS` | Lista explícita de origins DEV necesarios | Lista explícita de origins PROD HTTPS | CSV, sin wildcard, paths, query, fragment, credenciales ni entradas vacías. No hay defaults. |
| `SUPABASE_URL` | La URL server-side provista por el proyecto DEV | La URL provista por el proyecto PROD | Obligatoria, HTTPS, host `*.supabase.co`, sin path/query/fragment/credenciales. PROD rechaza el project ref DEV. |
| `SUPABASE_SERVICE_ROLE_KEY` | Provista por el runtime DEV | Provista por el runtime PROD | Obligatoria y server-side. Nunca `VITE_*`, GitHub Pages, repositorio, respuestas o logs. |

Supabase expone `SUPABASE_URL` y la legacy `SUPABASE_SERVICE_ROLE_KEY` como variables server-side del runtime. Una futura migración a `SUPABASE_SECRET_KEYS` debe tratarse como una fase independiente y probarse antes de desactivar claves legacy.

Variables adicionales que conservan su semántica:

- recuperación: `RESEND_API_KEY`, `RECOVERY_EMAIL_FROM`;
- push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

`RECOVERY_ALLOWED_ORIGINS` ya no se lee. Todos los handlers usan exclusivamente `AFUCOA_ALLOWED_ORIGINS` para evitar listas divergentes.

## Validación fail-closed

`runtime-config.ts`:

- valida la presencia y el valor de `AFUCOA_ENV`;
- valida y normaliza la URL Supabase sin fallback;
- exige la clave server-side y la conserva como propiedad no enumerable;
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

## Despliegue y validación real en DEV — Fase 2C

La parametrización de Fase 2B fue desplegada posteriormente solo en AFUCOA V2 DEV. Las cuatro funciones quedaron `ACTIVE`:

| Función | Versión DEV validada |
| --- | ---: |
| `request-password-recovery` | 23 |
| `confirm-password-recovery` | 23 |
| `push-config` | 9 |
| `send-notification-push` | 12 |

El runtime DEV tiene `AFUCOA_ENV=dev` y una lista explícita en `AFUCOA_ALLOWED_ORIGINS`. `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` siguen provistas únicamente server-side; la configuración Resend y VAPID existente fue preservada. Este documento no publica valores de origins, claves, remitentes ni secretos.

La recuperación real con el usuario sintético DEV `10000001` completó solicitud desde staging, recepción del correo, recepción y aceptación del código de ocho dígitos, cambio de contraseña y login con la contraseña nueva. La evidencia en base registró `delivery_status=sent`, `consumed=true` e `invalidated=false`. No se conserva aquí el código ni la contraseña.

Web Push también fue revalidado después del despliegue: con `10000001` deslogueado, logout conservó las notificaciones y un envío administrativo produjo toast en Windows/Chrome. La última notificación generó dos deliveries enviados, cero fallidos y cero inactivos porque el perfil tenía dos endpoints web activos distintos. No fue una duplicación sobre el mismo endpoint; representa dos suscripciones válidas y el diseño admite múltiples dispositivos o contextos. No corresponde desactivar ni limpiar esas suscripciones como parte de este cierre documental.

## Despliegue PROD futuro

La validación DEV no habilita producción. Para PROD se debe repetir el proceso con proyecto, origins, credenciales, VAPID, dominio y correo exclusivamente PROD, y ejecutar nuevamente las pruebas E2E autorizadas. Nunca se copia configuración DEV.

## Verificación local

```text
pnpm test:edge-config
```

La suite ejecuta los escenarios unitarios y el inventario estático. También forma parte de `pnpm test:staging`. No necesita red, secretos ni conexión a Supabase.
