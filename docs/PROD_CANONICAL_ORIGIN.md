# AFUCOA V2 — origin canónico PROD

Fecha: 5 de septiembre de 2026 (America/Montevideo)

Estado: **ACTIVO para frontend estático; no es aprobación completa de producción**

## Decisión

El origin canónico de AFUCOA V2 PROD es:

```text
https://afucoa-v2-prod.pages.dev
```

No se comprará dominio propio para esta fase. No son canónicos el deployment hash, `foundation`, GitHub Pages, localhost ni ningún origin DEV.

## Deployment

| Campo | Valor |
| --- | --- |
| Cloudflare Pages project | `afucoa-v2-prod` |
| Environment | Production |
| Branch | `afucoa-v2` |
| Deployment ID | `f7645b3e-61e9-4fb8-b513-f1b741accbc7` |
| Artefacto SHA | `63140a03654386f18b0e4d1198dc7ea3c20b5bb7` |
| Preview histórico | `https://348d68b4.afucoa-v2-prod.pages.dev` |

Se desplegó mediante Wrangler Direct Upload sin reconstruir después de aprobar el artefacto. No se conectó custom domain, DNS externo, repositorio ni plan pago.

## Artefacto canónico

El build usó modo `supabase`, base `/`, Supabase PROD `rywdochyzhgfaymrmxek`, alias `auth.afucoa.local` y el modo `canonical-domain`. La publishable key PROD se mantuvo solo en memoria durante el build; no se documenta su valor.

El release manifest `afucoa-v2-prod-3d-release-63140a0-release-manifest.json` tiene SHA-256:

```text
8ecbc534f3a5ed969e01072641638dd2104a8a63b4af9f1c2e037e4728e7926b
```

## Verificación pública

El origin estable respondió correctamente:

- HTTPS/TLS válido y HTTP 200 en `/`;
- refresh directo y fallback SPA en `/login`;
- manifest y `push-sw.js` HTTP 200;
- scope `/` y `Service-Worker-Allowed: /`;
- CSP estricta con `connect-src 'self' https://rywdochyzhgfaymrmxek.supabase.co`;
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`;
- sin `X-Robots-Tag: noindex`;
- HTML/worker sin caché, manifest revalidable y assets hashed inmutables;
- 0 referencias DEV, GitHub Pages/staging, sourcemaps o material privilegiado.

El contenido remoto coincidió byte a byte con el `dist` aprobado. No se inició sesión ni se crearon usuarios.

## Supabase Auth PROD

Configuración verificada después del deployment:

- `Site URL`: `https://afucoa-v2-prod.pages.dev`;
- `uri_allow_list`: vacío, porque el frontend usa login por contraseña y recovery mediante Edge Function propia, sin OAuth callback;
- signup público cerrado;
- contraseña mínima 12 con minúscula, mayúscula, número y símbolo;
- Leaked Password Protection habilitado;
- teléfono, anónimo y OAuth/social deshabilitados;
- 0 Auth users y 0 profiles.

No se agregaron localhost, GitHub Pages, previews, deployment hash ni DEV.

## Alcance y pendientes

Esta decisión cierra B06 respecto del hosting/origin canónico. No despliega Edge Functions ni configura Resend, VAPID, secrets o recuperación PROD. B03 continúa PARTIAL por MFA privilegiado, ciclo operativo de cuentas y recovery PROD; B04, B05 y B07–B10 continúan OPEN. Pilot 01 permanece PARKED.

La futura configuración server-side deberá usar exactamente este valor en `AFUCOA_ALLOWED_ORIGINS`; no se debe copiar configuración DEV.
