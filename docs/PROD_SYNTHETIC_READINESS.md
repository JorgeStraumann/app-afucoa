# AFUCOA V2 — Evidencia sintética PROD E01/E02

Estado: **APROBADO — E01/E02 CLOSED**

Fecha: 30 de septiembre de 2026 (America/Montevideo)

Proyecto: AFUCOA V2 PROD `rywdochyzhgfaymrmxek`

Esta validación usó exclusivamente identidades y datos inequívocamente sintéticos. No importó personas reales, no reactivó Pilot 01 y no modificó esquema, migraciones, RLS, Edge Functions, secretos ni configuración de infraestructura.

## Barreras de seguridad

- project ref y URL PROD fijados y confirmados antes de ejecutar;
- preflight obligatorio con `0` usuarios Auth y `0` filas de negocio;
- cuatro identidades efímeras (`socio` A/B, `admin`, `superadmin`) creadas server-side y marcadas `prod_readiness_synthetic`;
- clave privilegiada obtenida por la sesión autenticada de Supabase CLI y conservada solo en memoria del proceso;
- clientes RLS autenticados con la publishable key, sin usar la clave privilegiada como identidad de usuario;
- admin/superadmin validados primero en AAL1 denegado y luego en AAL2;
- logout de clientes con `scope: 'local'`;
- cleanup en `finally`, limitado a UUID/paths creados por la propia corrida;
- verificación final independiente en Supabase: Auth, profiles, requests, proposals, notifications, recovery y Storage nuevamente en `0`.

La creación de un trámite ejercitó el generador normal de número de solicitud. El cleanup elimina la fila y todos sus hijos, pero las secuencias PostgreSQL no retroceden; esto evita reutilizar identificadores y no deja datos personales ni de negocio.

## E01 — RLS e integración PROD

Resultado final: **112 checks aprobados, 0 fallos** (incluye preflight, controles funcionales y verificación de cleanup).

Cobertura real:

- login y perfil de socio A/B, admin y superadmin;
- aislamiento de perfiles y denegación administrativa en AAL1;
- privilegios admin/superadmin únicamente con MFA AAL2;
- edición limitada de Mi Cuenta y rechazo de escalación de rol;
- convenios y favoritos propios;
- borrador, creación, lectura y administración de trámites;
- mensajes y archivos privados, URL firmada y rechazo cruzado;
- propuestas, moderación, visibilidad y apoyo idempotente;
- notificaciones por destinatario y marcado leído;
- QR vigente y revocación del anterior;
- documentos privados publicados y rechazo anónimo;
- auditoría solo para privilegiados;
- tablas Recovery privadas y payload push hostil rechazado.

## E02 — carga acotada y abuso

La prueba fue deliberadamente pequeña y no destructiva; establece un baseline técnico, no una promesa de SLA ni una prueba de capacidad máxima.

| Superficie | Solicitudes | Concurrencia | Éxito | p50 | p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `production_health` | 30 | 5 | 30/30 | 79 ms | 137 ms |
| Cloudflare Pages / login | 20 | 5 | 20/20 | 30 ms | 92 ms |

El control concurrente de Recovery recibió 8 intentos sobre un sujeto sintético con límite 3: permitió exactamente 3 y bloqueó 5. No invocó el envío de email ni Web Push. Los sondeos anónimos de profiles, requests, proposals, notifications y audit log no expusieron filas.

## Repetición

Validación estática:

```powershell
pnpm test:prod-readiness
```

Corrida LIVE, solo desde una sesión local autenticada en Supabase CLI:

```powershell
.\scripts\run-prod-synthetic-readiness.ps1
```

El runner nunca imprime ni persiste las API keys. Debe abortar si PROD deja de estar vacío; una nueva fase para entornos con datos reales requerirá otro diseño y autorización.

## Alcance de la aprobación

E01 y E02 se cerraron como evidencia técnica de B10 en el corte previo a la cohorte. En ese momento B10 seguía **OPEN** y el resultado no autorizaba altas reales ni `--apply`. Una autorización posterior resolvió B10 como **GO CON CONDICIONES** solo para el batch exacto de cinco, ya aplicado; no autoriza ampliar ni reactivar Pilot 01 masivo. El seguimiento de acceso individual del lote se cerró posteriormente por decisión del responsable; véase `docs/PROD_COHORT_DRY_RUN.md` para el alcance exacto y los conteos que permanecen sin verificar. Los ceros de cleanup aquí descritos son el baseline posterior a la prueba sintética y anterior al batch real, no el estado actual de Auth/profiles.
