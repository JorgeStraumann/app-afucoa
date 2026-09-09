# AFUCOA V2 — Monitoring PROD activo

Fecha de activación: 8 de septiembre de 2026 (America/Montevideo)

Estado: **PARTIAL — B09 no puede cerrarse todavía**. La capa gratuita opera para cinco controles externos y GitHub cubre técnicamente los ocho contratos, pero UptimeRobot FREE bloquea los tres probes que requieren método, headers o status de éxito personalizados. AFUCOA V2 no queda declarada lista para producción.

## Arquitectura operativa

- UptimeRobot FREE, USD 0/mes, intervalo mínimo 5 minutos y una región automática: monitor externo principal y email al único Owner operativo.
- GitHub Actions `AFUCOA V2 production monitoring`, cada 6 horas y manual: auditoría técnica complementaria, issues deduplicados y cierre automático al recuperarse.
- Supabase Dashboard/Logs/Usage: diagnóstico interno manual, sin exportar PII.
- Modelo actual: **SINGLE-OPERATOR TEMPORARY MODEL**. Jorge es Incident Commander y responsable de Web, Database, Identity, Backend, Messaging y Security hasta que AFUCOA designe otra persona.

No se guardan en el repositorio el email del Owner, publishable key ni valores privados. Los probes no usan Secret API Key, `service_role`, JWT de usuario, TOTP, password, VAPID privado, endpoint push, URL firmada ni datos personales.

## Inventario externo

| Monitor | UptimeRobot FREE | Intervalo | Contrato |
| --- | --- | --- | --- |
| `AFUCOA PROD - Frontend HTTPS` | ACTIVE | 5 min | HTTPS 200 y shell AFUCOA |
| `AFUCOA PROD - Auth Health` | ACTIVE | 5 min | Auth health 200 y servicio GoTrue |
| `AFUCOA PROD - Database Health` | ACTIVE | 5 min | Data API 200 y respuesta de `production_health()` |
| `AFUCOA PROD - Manifest` | ACTIVE | 5 min | manifest 200; GitHub valida JSON y `display=standalone` |
| `AFUCOA PROD - Push Worker` | ACTIVE | 5 min | worker 200 y contenido `notification_id` |
| `AFUCOA PROD - Push Config Security` | BLOCKED BY FREE PLAN | — | GitHub valida `POST`, Origin canónico, sin JWT, 401 exacto |
| `AFUCOA PROD - Push Send Security` | BLOCKED BY FREE PLAN | — | GitHub valida `POST`, Origin canónico, sin JWT, 401 exacto |
| `AFUCOA PROD - Storage API` | BLOCKED BY FREE PLAN | — | GitHub valida 400, `NoSuchKey` y `Object not found` sin crear objeto |

El intento con los API oficiales v2 y v3 confirmó que las operaciones de lectura están permitidas, pero UptimeRobot responde `403` cuando la definición usa ajustes no disponibles en el plan FREE. No se contrató plan, no se cargó tarjeta y no se degradó el contrato para simular cobertura. La API key temporal se elimina al terminar la configuración.

## Auditoría GitHub

El workflow usa únicamente el origin canónico, la variable pública `AFUCOA_PROD_PUBLISHABLE_KEY` y el `GITHUB_TOKEN` efímero con `contents: read` e `issues: write`. No usa el environment `production` ni secretos privilegiados. Comprueba:

- frontend, HTTPS y headers CSP/HSTS/nosniff/framing;
- manifest y push worker;
- Auth health y el contrato JSON exacto de `production_health()`;
- ambos contratos Edge fail-closed `401`;
- Storage `NoSuchKey` estable;
- ausencia pública de referencias DEV, sourcemaps y material privilegiado.

La entrada `simulate_failure` afecta solo un resultado local y nunca cambia URLs, requests ni infraestructura. Los incidentes tienen título `[PROD MONITOR][<alert-id>] <componente>`, labels `production-monitoring` y `sev1|sev2|sev3`; una recurrencia actualiza/reabre el issue y una recuperación comenta `RECOVERED` con UTC y lo cierra.

## Baseline y game days

Game day externo ejecutado sin tumbar PROD:

- monitor temporal `AFUCOA PROD - GAME DAY TEST`, creado `2026-09-09T00:18:39Z` con una palabra deliberadamente inexistente;
- UptimeRobot abrió el incidente a `2026-09-09T00:19:51.589Z`: detección en 72,589 segundos, dentro del primer ciclo de 5 minutos;
- el Owner confirmó recepción del email DOWN;
- la condición se corrigió sin cambiar el frontend ni Supabase;
- el incidente quedó `Resolved`, duración informada por UptimeRobot: 534 segundos;
- recuperación técnica UP confirmada; el monitor temporal se elimina después de preservar esta evidencia.

El baseline de disponibilidad y response time exige seis ciclos completos de cada monitor permanente. Los umbrales absolutos de caída quedan activos; thresholds estadísticos y de tráfico continúan provisionales hasta B10.

## Revisión Supabase

Durante la etapa previa al cutover: revisión diaria, además de inmediatamente después de un deploy o incidente. Tras estabilización: semanal.

- API 5xx, Auth 5xx y Postgres errors;
- presión de conexiones, tamaño DB y Storage usage;
- Edge requests, 5xx y timeouts;
- anomalías del ledger Push y claims `sending` mayores a 10 minutos;
- Security Advisor y Performance Advisor.

No se copian logs con PII al repositorio.

## Riesgos residuales

- B04 Recovery/email PROD permanece `INACTIVE_UNTIL_B04` y no se interpreta como fallo de monitoring.
- Señales basadas en tráfico real permanecen `BASELINE_PENDING_REAL_TRAFFIC` hasta B10.
- UptimeRobot FREE aporta una única región y no permite los tres contratos avanzados externos; GitHub los cubre cada 6 horas, no cada 5 minutos.
- Uptime y status de entrega no garantizan experiencia del navegador, Web Push exactly-once ni ausencia total de incidentes.

Runbooks: `docs/INCIDENT_RESPONSE.md` y `docs/runbooks/`.
