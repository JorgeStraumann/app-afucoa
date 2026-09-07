# AFUCOA V2 — MFA privilegiado PROD

Fecha de validación: 7 de septiembre de 2026 (America/Montevideo)

Estado: **VALIDADO** para `admin` y `superadmin`. Los socios continúan admitidos con AAL1. B03 permanece **PARTIAL** únicamente por recuperación PROD/B04 E2E.

## Alcance y destinos

- Rama exclusiva: `afucoa-v2`.
- Supabase DEV: `imiplnspvmsrsuikulwm`.
- Supabase PROD: `rywdochyzhgfaymrmxek`.
- Origin PROD: `https://afucoa-v2-prod.pages.dev`.
- Pilot 01: **PARKED**.
- No se desplegaron Edge Functions Recovery o Push en PROD.

## Enforcement server-side

La migración canónica #18, `20260906182340_privileged_aal2_enforcement.sql`, agrega:

- `public.is_privileged_aal2()`: devuelve `true` solo para un perfil `activo`, rol `admin`/`superadmin` y claim `auth.jwt()->>'aal' = 'aal2'`;
- `public.require_privileged_aal2()`: diferencia `not_authorized` de `mfa_required`;
- `public.is_admin()`: delega en el guard central anterior.

El cambio de `is_admin()` protege de forma uniforme los RPC `SECURITY DEFINER`, las policies RLS, los accesos directos y las policies de Storage que ya utilizaban ese guard. `get_my_profile()` y `current_user_role()` permanecen disponibles en AAL1 para identificar el rol y redirigir al gate, pero AAL1 no concede operaciones privilegiadas.

Postcheck PROD:

- 29 policies con nombre admin usan el guard central;
- 0 policies admin sin `is_admin()`;
- `anon` no tiene `EXECUTE` sobre los guards;
- `authenticated` sí puede invocarlos, pero el resultado depende de identidad, estado, rol y AAL;
- Security Advisor: 0 findings `ERROR`; los warnings `SECURITY DEFINER` continúan clasificados individualmente como intencionales y no se modificaron solo para silenciar el Advisor.

## Frontend

`src/services/mfa-service.js` usa las APIs oficiales TOTP de Supabase: AAL, listado de factores, enrollment, challenge, verify y baja controlada de factores no verificados. `src/pages/mfa/mfa.js` ofrece dos modos:

- enrollment: QR TOTP, clave manual transitoria y código de seis dígitos;
- challenge: código TOTP, verificar y cerrar sesión, sin volver a revelar el secreto.

El store distingue socio AAL1, privilegiado AAL1 pendiente de MFA, privilegiado AAL2, cuenta inactiva y perfil temporalmente no disponible. Las rutas `/admin/*` exigen rol privilegiado y AAL2. La UI es defensa adicional; la base sigue siendo la autoridad.

El secreto TOTP solo vive transitoriamente durante enrollment. No se persiste en `localStorage`, `sessionStorage`, IndexedDB, logs, documentación ni analytics.

## Validación LIVE

### DEV primero

La suite sintética LIVE creó dos identidades temporales sin datos reales y confirmó:

- admin: AAL1 denegado, enrollment/challenge correcto, AAL2 autorizado y re-login con challenge;
- superadmin: AAL1 denegado, enrollment/challenge correcto, AAL2 autorizado y re-login con challenge;
- lifecycle admin: `activo → inactivo → revocación → activo`, manteniendo MFA;
- Recovery y Push DEV siguieron operativos con la nueva Secret API Key server-side.

El cleanup DEV dejó 0 identidades, perfiles y factores sintéticos de Fase 3H.

### PROD sintético

Después de aplicar la migración #18 se crearon temporalmente una identidad admin y una superadmin con documentos/aliases inequívocamente sintéticos, email interno y passwords aleatorios solo en memoria. El runner fail-closed confirmó:

- login por password produce AAL1;
- RPC privilegiada queda denegada en AAL1;
- enrollment y verificación TOTP elevan a AAL2;
- la misma RPC queda autorizada en AAL2;
- después de logout/re-login el factor existente exige challenge;
- AAL1 vuelve a quedar denegado hasta verificar el challenge;
- admin y superadmin cumplen el mismo contrato esencial;
- desactivar el profile bloquea la operación privilegiada;
- revocar sesiones invalida la sesión anterior;
- reactivar exige nuevo login y conserva el requisito MFA.

No se imprimieron ni guardaron passwords, TOTP, QR o claves server-side. El cleanup `finally` eliminó perfiles y usuarios sintéticos.

## Estado final PROD comprobado

| Control | Resultado |
| --- | ---: |
| Migraciones DEV | 18/18 |
| Migraciones PROD | 18/18 |
| Dry-run posterior | 0 pendientes |
| Auth users PROD | 0 |
| Profiles PROD | 0 |
| Factores MFA PROD | 0 |
| Perfiles `phase3h_synthetic` | 0 |
| Datos de negocio, excluyendo configuración técnica | 0 |
| Objetos Storage | 0 |
| Edge Functions PROD | 0 |

## Claves API

Las operaciones administrativas LIVE utilizaron una Secret API Key distinta por entorno, únicamente en un proceso local seguro y sin imprimirla. DEV migró sus Edge Functions desde la legacy `service_role` a `SUPABASE_SECRET_KEYS` con selección server-side por nombre; las legacy API keys DEV quedaron desactivadas después de verificar Recovery, Push y MFA LIVE. Ninguna Secret API Key se incorporó al frontend, Vite, GitHub, artefactos o repositorio.

Referencias: [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa), [Supabase TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp) y [migración a nuevas API keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys).
