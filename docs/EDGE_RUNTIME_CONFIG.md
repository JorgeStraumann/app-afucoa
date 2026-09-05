# AFUCOA V2 — configuración runtime de Edge Functions

Estado: código versionado en `afucoa-v2`, todavía no desplegado

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

## Despliegue futuro

Esta fase no despliega funciones ni cambia secrets. Antes de un despliegue autorizado en DEV:

1. configurar `AFUCOA_ENV=dev`;
2. declarar de forma explícita todos y solo los origins DEV necesarios en `AFUCOA_ALLOWED_ORIGINS`;
3. confirmar que `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` existen sin imprimir valores;
4. conservar Resend/VAPID actuales sin moverlos al frontend;
5. ejecutar `pnpm test:edge-config` y las suites LIVE autorizadas después del despliegue;
6. probar CORS permitido/rechazado y E2E de recuperación/push.

Para PROD se repite con proyecto, origins, credenciales, VAPID y correo exclusivamente PROD. Nunca se copia configuración DEV.

## Verificación local

```text
pnpm test:edge-config
```

La suite ejecuta los escenarios unitarios y el inventario estático. También forma parte de `pnpm test:staging`. No necesita red, secretos ni conexión a Supabase.
