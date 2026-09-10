# AFUCOA V2 — Password Recovery PROD

Fecha de validación: 9 de septiembre de 2026 (America/Montevideo)

Estado: **B04 CLOSED**. Recovery PROD está activo y validado end-to-end. Esto no autoriza usuarios reales: B10 GO/NO-GO permanece abierto y Pilot 01 continúa `PARKED`.

## Proveedor y configuración

- Proveedor PROD: Brevo Free, costo USD 0 en el volumen actual.
- Remitente individual controlado y verificado; no se publica la dirección.
- No se compró ni autenticó un dominio propio. Brevo puede reescribir técnicamente el `From`; se acepta como riesgo residual no bloqueante.
- `RECOVERY_EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, remitente y nombre viven solo en Edge Function Secrets.
- DEV conserva `RECOVERY_EMAIL_PROVIDER=resend` y su configuración Resend independiente.
- Ninguna credencial se incorporó a Vite, Cloudflare Pages, GitHub, documentación, logs públicos o artefactos.
- Sandbox/drop de Brevo aceptó el request y no entregó correo antes del único E2E real.

El helper compartido `supabase/functions/_shared/recovery-email.ts` conserva un único contrato sensible y falla cerrado ante ambiente, proveedor, remitente o clave inválidos. Brevo recibe únicamente `sender`, destinatario, subject, texto y HTML; no recibe cédula, profile/auth ID ni metadata adicional.

## Despliegue PROD

| Función | Versión | Estado | JWT gateway |
| --- | ---: | --- | --- |
| `request-password-recovery` | 1 | `ACTIVE` | `verify_jwt=false`; controles públicos dentro del handler |
| `confirm-password-recovery` | 1 | `ACTIVE` | `verify_jwt=false`; controles públicos dentro del handler |

Inventario total PROD: cuatro Edge Functions `ACTIVE`; Recovery convive con `push-config` y `send-notification-push`. Solo las dos funciones Recovery fueron desplegadas en esta fase.

## Seguridad validada

- Origin canónico exacto: `https://afucoa-v2-prod.pages.dev`.
- `OPTIONS` canónico responde 204; origin ajeno se deniega y un método no admitido se rechaza.
- Documento inexistente y perfil activo producen la misma forma pública neutra; no se devuelve email, IDs, código ni estado interno.
- Código de ocho dígitos protegido por HMAC, TTL 10 minutos, invalidación de anteriores, uso único y máximo de cinco intentos.
- Rate limits por IP, identidad y global conservados.
- Contraseña de 12–72 caracteres con minúscula, mayúscula, número y símbolo.
- No se registran destinatario, código, contraseña ni claves.

## E2E sintético real

Se creó una única identidad `socio` sintética temporal. Passwords y código existieron solo en memoria/local runner.

| Paso | Resultado |
| --- | --- |
| Login inicial y logout local | PASS |
| Solicitud inexistente/activa y neutralidad | PASS |
| Provider aceptó el envío | PASS |
| `delivery_status=sent` | PASS |
| Email y subject reales | **DELIVERY CONFIRMED** |
| Código recibido y cambio de contraseña | PASS |
| Password anterior | FAIL esperado |
| Password nueva | PASS |
| Código reutilizado | FAIL esperado |
| Código incorrecto / cinco intentos | FAIL esperado / bloqueo PASS |
| Código expirado | FAIL esperado |
| Rate limits | PASS |

No se documenta la dirección, el código ni las contraseñas.

## Cleanup e invariantes

El runner cleanup-safe eliminó sesión, usuario Auth, profile, códigos y filas de rate limit sintéticas. Estado final comprobado:

- Auth users: 0;
- profiles: 0;
- password recovery codes: 0;
- password recovery rate limits: 0;
- Storage objects: 0;
- push devices, notifications y deliveries: 0;
- datos de negocio: 0.

Las credenciales candidatas que pudieron quedar visibles durante la configuración fueron desactivadas inmediatamente. La clave Brevo operativa fue validada en sandbox y almacenada solo server-side. Las legacy API keys PROD quedaron deshabilitadas y la firma legacy HS256 anterior fue revocada; las funciones usan las nuevas Secret API Keys.

## Operación y mejoras post go-live

El monitoring periódico realiza únicamente `OPTIONS` read-only sobre ambas funciones: no crea códigos, no consume límites ni envía correo. La tasa de errores, rebotes, complaints y abuso se revisa mediante métricas agregadas y el runbook `docs/runbooks/PASSWORD_RECOVERY_INCIDENT.md`.

Mejoras posteriores, no blockers actuales: dominio AFUCOA propio, DKIM/SPF/DMARC, remitente branded y eventual plan/proveedor institucional si el volumen crece.

