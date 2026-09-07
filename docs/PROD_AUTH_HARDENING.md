# AFUCOA V2 — Hardening de Auth PROD

Fecha: 5 de septiembre de 2026 (America/Montevideo)

Estado: hardening base de Auth y URL canónica configurados; **AFUCOA V2 no está habilitada completamente para producción**.

## Destino y alcance

| Campo | Evidencia |
| --- | --- |
| Project ref PROD | `rywdochyzhgfaymrmxek` |
| Organización | `AFUCOA PROD` |
| Plan | Pro |
| Región | `sa-east-1` |
| Rama | `afucoa-v2` |
| Baseline previo | `24c69c33285548db32edba1b01957cc512172879` |

El vínculo local fue verificado contra ese project ref antes de actuar. No se consultó ni modificó DEV, V1, `main`, Pilot 01, datos reales, Edge Functions, secretos, Storage o esquema SQL. No se creó ninguna migración.

## Configuración antes y después

La lectura y actualización se realizaron mediante la Management API de Supabase. El token de operación permaneció únicamente en memoria y no se volcó a archivos, repositorio ni documentación.

| Control Auth | Antes | Después |
| --- | --- | --- |
| Signup público | Habilitado (`disable_signup=false`) | **Deshabilitado** (`disable_signup=true`) |
| Email/password | Habilitado | Habilitado para login y altas administrativas server-side |
| Signup/login por teléfono | Deshabilitado | Deshabilitado |
| Signup anónimo | Deshabilitado | Deshabilitado |
| OAuth/social | 0 proveedores habilitados | 0 proveedores habilitados |
| SAML | Deshabilitado | Deshabilitado |
| Longitud mínima | 6 | **12** |
| Caracteres requeridos | Sin requisito | **Minúscula + mayúscula + dígito + símbolo** |
| Leaked Password Protection | Deshabilitada | **Habilitada** (`password_hibp_enabled=true`) |
| Confirmación automática de email | Deshabilitada | Deshabilitada |
| Login con email no verificado | Deshabilitado | Deshabilitado |

La política de caracteres usa la opción más fuerte admitida por Supabase. La validación es server-side y no depende de controles del frontend. Leaked Password Protection queda disponible porque la organización PROD usa Pro.

## Sesiones, OTP y recuperación observados

Estos valores fueron capturados en modo read-only y no se cambiaron en esta fase:

| Control | Valor observado |
| --- | ---: |
| JWT expiry | 3600 s |
| Refresh token rotation | Habilitada |
| Refresh token reuse interval | 10 s |
| Session timebox | Sin límite configurado (`0`) |
| Session inactivity timeout | Sin límite configurado (`0`) |
| Single session per user | Deshabilitado |
| Email OTP expiry | 3600 s |
| Email OTP length | 8 |
| Rate limit email sent | 2 |
| Rate limit token refresh | 150 |
| Rate limit anonymous users | 30 |

La recuperación propia de AFUCOA sigue pendiente en PROD: las Edge Functions, email/dominio y secretos de producción no fueron desplegados ni configurados. B04 permanece abierto.

## Decisión sobre confirmación de email

Se conserva `mailer_autoconfirm=false` y se rechaza el login con email no verificado. El signup público está cerrado. Las futuras cuentas AFUCOA deberán ser creadas por el proceso administrativo server-side aprobado y confirmadas explícitamente durante el alta controlada, sin depender de un signup público ni migrar contraseñas anteriores.

El alias Auth de cédula no representa el correo de contacto del socio. Antes de habilitar recuperación PROD se debe verificar por un procedimiento separado la titularidad del correo real almacenado en el perfil. No se configuró SMTP/Resend ni se envió correo en esta fase.

## Site URL y redirect URLs

- `Site URL` quedó configurada exactamente como `https://afucoa-v2-prod.pages.dev`.
- La allowlist de redirects permanece vacía porque el frontend actual usa login por contraseña y recuperación mediante Edge Function propia; no necesita OAuth ni callback de Auth.
- No se agregaron localhost, GitHub Pages, preview, deployment hash, DEV ni comodines amplios.
- El origin canónico y su TLS/HSTS fueron verificados antes de actualizar Auth.

B03 permanece **PARTIAL** únicamente por Recovery PROD/B04 E2E; la URL, MFA privilegiado y ciclo operativo de cuentas ya no son pendientes.

## MFA

### Usuarios de la aplicación

Fase 3H implementó TOTP obligatorio para `admin` y `superadmin`, con enforcement server-side por `auth.jwt()->>'aal' = 'aal2'`, gate frontend y procedimiento operativo de alta, baja, revocación, pérdida de factor y re-enrollment. WebAuthn y phone MFA no se usan en la aplicación. Los socios continúan admitidos en AAL1.

La migración canónica #18, `20260906182340_privileged_aal2_enforcement.sql`, fue aplicada primero en DEV y después en PROD. La validación LIVE sintética confirmó AAL1 denegado y AAL2 autorizado para admin/superadmin, challenge tras re-login, desactivación/revocación/reactivación y cleanup completo. Ver `docs/PROD_PRIVILEGED_MFA.md` y `docs/PROD_ACCOUNT_LIFECYCLE.md`.

### Cuenta y organización Supabase

La existencia de la organización separada y el plan Pro quedaron confirmados. Fase 3G verificó owner, acceso mínimo, MFA individual, billing y cost governance; B02 está **CLOSED**. El MFA de la aplicación para roles privilegiados es independiente del MFA de la cuenta Supabase.

## Prueba controlada de signup cerrado

Se usó únicamente la identidad sintética reservada `afucoa-prod-phase3b-signup-probe@example.invalid`, con una contraseña efímera generada en memoria y no registrada.

| Control | Resultado |
| --- | --- |
| Solicitud pública `POST /auth/v1/signup` | HTTP 422 |
| Respuesta | `Signups not allowed for this instance` |
| Usuario sintético creado | No |
| Email enviado | No |
| Profile creado | No |
| Usuarios Auth finales | **0** |
| Profiles finales | **0** |

No fue necesario ejecutar cleanup porque no se creó ninguna identidad.

## Invariantes posteriores

- Historial remoto: **18 migraciones canónicas**, sin migration repair y con dry-run posterior vacío.
- Edge Functions PROD: **0**.
- Usuarios Auth PROD: **0**.
- Profiles PROD: **0**.
- Pilot 01: **PARKED**.
- Site URL: `https://afucoa-v2-prod.pages.dev`.
- Redirect URLs: allowlist vacía por diseño actual.
- Factores MFA PROD: **0** después del cleanup sintético.
- Objetos Storage y datos de negocio PROD: **0**.
- B02: **CLOSED**.
- B03: **PARTIAL**.
- B04–B05: **OPEN**.
- B06: **CLOSED** para el origin canónico Pages.dev; ver `docs/PROD_CANONICAL_ORIGIN.md`.
- B07–B08: **CLOSED**; B09–B10: **OPEN**.

## Validación local

| Comando | Resultado |
| --- | --- |
| `pnpm test:migrations` | PASS — 18/18 checksums, 0 obsoletas |
| `pnpm test:prod-operations` | PASS — 12/12 y contrato operativo PASS |
| `pnpm test:prod-hosting` | PASS — 18/18 |
| `pnpm test:prod-artifact` | PASS — 16/16 y build sintético sin referencias DEV, source maps ni clave privilegiada |
| `pnpm test:edge-config` | PASS — 14/14 y check estático |
| `pnpm test:recovery` | PASS — 13/13 |
| `pnpm test:push` | PASS — 46/46 |
| `pnpm test:session` | PASS — 11/11 |
| `pnpm test:navigation` | PASS — 5/5 |
| `pnpm test:mfa` | PASS — 14/14 |
| `pnpm test:staging` | PASS — build de 142 módulos, 5 archivos, 0 source maps y 0 clave privilegiada |

Referencias: [Supabase — Password security](https://supabase.com/docs/guides/auth/password-security), [Supabase — General configuration](https://supabase.com/docs/guides/auth/general-configuration), [Supabase — Platform security](https://supabase.com/docs/guides/security/platform-security) y [Supabase — Production checklist](https://supabase.com/docs/guides/deployment/going-into-prod).
