# AFUCOA V2 — Hardening de Auth PROD

Fecha: 5 de septiembre de 2026 (America/Montevideo)

Estado: hardening base de Auth completado; **AFUCOA V2 no está habilitada para producción**.

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

- `Site URL` permanece en `http://localhost:3000`, valor predeterminado **TEMPORARY / NOT APPROVED**.
- La allowlist de redirects permanece vacía.
- No se inventó un dominio final ni se reutilizó staging, DEV o `/app-afucoa/`.
- Cuando AFUCOA apruebe el dominio HTTPS final, B03 exige reemplazar el valor temporal y registrar únicamente redirects exactos, sin comodines amplios.

Por este pendiente, B03 no puede cerrarse.

## MFA

### Usuarios de la aplicación

TOTP enrollment y verification están disponibles en Auth; WebAuthn y phone MFA no están habilitados. Esta fase no cambió esas capacidades ni agregó comportamiento al producto. No existe aún enforcement por rol o `aal2`.

Antes del alta de cuentas privilegiadas debe aprobarse uno de estos caminos para `admin` y `superadmin`:

1. MFA TOTP obligatorio, con enforcement verificable server-side/RLS y procedimiento de recuperación; o
2. excepción de riesgo formal, con dueño, controles compensatorios y fecha de remediación.

No se habilita MFA obligatorio para socios en esta fase. La decisión debe considerar soporte, pérdida del factor, accesibilidad, enrolamiento y cuentas de emergencia sin debilitar RLS.

### Cuenta y organización Supabase

La existencia de la organización separada y el plan Pro quedaron confirmados. El estado MFA de la cuenta propietaria y una eventual política de enforcement de organización no pudieron verificarse de forma segura con la evidencia API disponible. No se activó enforcement organizacional para evitar bloquear al propietario sin confirmar previamente su MFA.

B02 permanece **PARTIAL** hasta registrar responsable operativo, owner de facturación, miembros mínimos, MFA de cada cuenta con acceso, política organizacional aplicable y alertas de billing/uso disponibles.

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

- Historial remoto: **17 migraciones canónicas**, sin cambios ni repair.
- Edge Functions PROD: **0**.
- Usuarios Auth PROD: **0**.
- Profiles PROD: **0**.
- Pilot 01: **PARKED**.
- Site URL y redirects: pendientes de dominio final aprobado.
- B02: **PARTIAL**.
- B03: **PARTIAL**.
- B04–B10: **OPEN**.

## Validación local

| Comando | Resultado |
| --- | --- |
| `pnpm test:migrations` | PASS — 17/17 checksums, 0 obsoletas |
| `pnpm test:prod-operations` | PASS — 6/6 y contrato operativo de 18 archivos |
| `pnpm test:prod-hosting` | PASS — 12/12 |
| `pnpm test:prod-artifact` | PASS — 16/16 y build sintético sin referencias DEV, source maps ni clave privilegiada |
| `pnpm test:edge-config` | PASS — 12/12 y check estático |
| `pnpm test:recovery` | PASS — 13/13 |
| `pnpm test:push` | PASS — 44/44 |
| `pnpm test:session` | PASS — 11/11 |
| `pnpm test:navigation` | PASS — 5/5 |
| `pnpm test:staging` | PASS — build de 163 módulos, 5 archivos, 0 source maps y 0 clave privilegiada |

Referencias: [Supabase — Password security](https://supabase.com/docs/guides/auth/password-security), [Supabase — General configuration](https://supabase.com/docs/guides/auth/general-configuration), [Supabase — Platform security](https://supabase.com/docs/guides/security/platform-security) y [Supabase — Production checklist](https://supabase.com/docs/guides/deployment/going-into-prod).
