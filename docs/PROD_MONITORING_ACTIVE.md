# AFUCOA V2 — Monitoring PROD activo

Fecha de activación: 8 de septiembre de 2026 (America/Montevideo)

Estado: **CLOSED — B09**. La cobertura automática combina cinco monitores UptimeRobot FREE cada 5 minutos con un segundo probe externo en GitHub-hosted runners para los contratos avanzados cada 15 minutos. Esta decisión no habilita todavía AFUCOA V2 para usuarios reales: B04 y B10 continúan abiertos.

## Arquitectura operativa

- UptimeRobot FREE, USD 0/mes, intervalo mínimo 5 minutos y una región automática: monitor externo principal y email al único Owner operativo.
- GitHub Actions `AFUCOA V2 production monitoring`, cuatro veces por hora (`7,22,37,52`) y manual: segundo monitor externo, auditoría técnica, issues deduplicados y cierre automático al recuperarse. El schedule es best-effort y no tiene SLA de ejecución.
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

El intento con los API oficiales v2 y v3 confirmó que las operaciones de lectura están permitidas, pero UptimeRobot responde `403` cuando la definición usa ajustes no disponibles en el plan FREE. No se contrató plan, no se cargó tarjeta y no se degradó el contrato para simular cobertura. La API key temporal fue eliminada al terminar la configuración. Los tres contratos bloqueados en UptimeRobot permanecen activos desde GitHub-hosted runners, infraestructura independiente de Cloudflare Pages y Supabase.

## Auditoría GitHub

El workflow usa únicamente el origin canónico, la variable pública `AFUCOA_PROD_PUBLISHABLE_KEY` y el `GITHUB_TOKEN` efímero con `contents: read` e `issues: write`. No usa el environment `production` ni secretos privilegiados. Comprueba:

- frontend, HTTPS y headers CSP/HSTS/nosniff/framing;
- manifest y push worker;
- Auth health y el contrato JSON exacto de `production_health()`;
- ambos contratos Edge fail-closed `401`;
- Storage `NoSuchKey` estable;
- ausencia pública de referencias DEV, sourcemaps y material privilegiado.

La entrada `simulate_failure` afecta solo un resultado local y nunca cambia URLs, requests ni infraestructura. Los incidentes tienen título `[PROD MONITOR][<alert-id>] <componente>`, labels `production-monitoring` y `sev1|sev2|sev3`; una recurrencia actualiza/reabre el issue y una recuperación comenta `RECOVERED` con UTC y lo cierra.

El cron `7,22,37,52 * * * *` entrega una cadencia nominal de 15 minutos sin concentrar trabajos en el minuto cero. La ejecución programada de GitHub Actions es best-effort: puede comenzar algunos minutos después de la hora nominal y no se afirma SLA. Para la etapa previa al cutover, esta cadencia es proporcional a los contratos SEV2 Edge/Storage y complementa los cinco probes UptimeRobot de disponibilidad principal.

Primera ejecución automática validada después del cambio de cadencia:

- run `34328893538`, commit `80007b150efc3b5aa7f9f4d162adc1fbe9422196`;
- evento real `schedule`, rama `afucoa-v2`, estado final `success`;
- slot nominal `2026-09-09T08:22:00Z`, inicio real `2026-09-09T08:24:00Z`: retraso observado de 2 minutos;
- auditoría pública PROD `11/11 PASS` en 18 segundos;
- 0 Issues abiertos después del run y ningún incidente nuevo;
- prueba estrictamente de lectura: PROD no fue modificado.

Los slots anteriores no aparecieron como runs y GitHub documenta el schedule como best-effort; la primera ejecución automática efectiva confirma el circuito sin convertirlo en un SLA.

## Baseline y game days

Ventana observada hasta `2026-09-09T03:19:03Z`. Todos los monitores permanentes permanecieron `UP`, sin incidente ni falsa alarma. Cada uno superó los seis ciclos requeridos:

| Monitor | Muestras | Mínimo | Promedio | Máximo | Disponibilidad observada |
| --- | ---: | ---: | ---: | ---: | --- |
| Frontend HTTPS | 32 | 42 ms | 64 ms | 194 ms | 100% en la muestra |
| Auth Health | 23 | 171 ms | 527 ms | 733 ms | 100% en la muestra |
| Database Health | 23 | 176 ms | 547 ms | 746 ms | 100% en la muestra |
| Manifest | 33 | 33 ms | 104 ms | 1.289 ms | 100% en la muestra |
| Push Worker | 32 | 33 ms | 129 ms | 2.053 ms | 100% en la muestra |

La dispersión mayor en manifest/worker no generó fallos y una muestra corta no justifica tuning agresivo.

Game day externo ejecutado sin tumbar PROD:

- monitor temporal `AFUCOA PROD - GAME DAY TEST`, creado `2026-09-09T00:18:39Z` con una palabra deliberadamente inexistente;
- UptimeRobot abrió el incidente a `2026-09-09T00:19:51.589Z`: detección en 72,589 segundos, dentro del primer ciclo de 5 minutos;
- el Owner confirmó recepción del email DOWN;
- la condición se corrigió sin cambiar el frontend ni Supabase;
- el incidente quedó `Resolved`, duración informada por UptimeRobot: 534 segundos;
- recuperación técnica UP confirmada; el monitor temporal fue eliminado después de preservar esta evidencia.

Game day GitHub:

- run `34295615469`, `simulate_failure=true`: fallo sintético esperado, Issue `#1` creado con `production-monitoring` y `sev3`;
- run `34295674756`, `simulate_failure=false`: auditoría 11/11, comentario `RECOVERED` a `2026-09-09T00:35:49.518Z` y cierre automático como `completed`;
- el Issue no incluyó PII, response bodies, credenciales ni endpoints privados;
- staging run `34295461091` del commit de Fase 3J: SUCCESS en 55 segundos.

Los umbrales absolutos de caída quedan activos; thresholds estadísticos y de tráfico continúan provisionales hasta B10.

Cleanup final UptimeRobot: 5 monitores permanentes, 5 `UP`, 0 `DOWN`, 0 pausados, 100% de uptime observado y 0 incidentes permanentes. No quedó monitor game day ni Main API key temporal.

## Revisión Supabase

Durante la etapa previa al cutover: revisión diaria, además de inmediatamente después de un deploy o incidente. Tras estabilización: semanal.

- API 5xx, Auth 5xx y Postgres errors;
- presión de conexiones, tamaño DB y Storage usage;
- Edge requests, 5xx y timeouts;
- anomalías del ledger Push y claims `sending` mayores a 10 minutos;
- Security Advisor y Performance Advisor.

No se copian logs con PII al repositorio.

## Validación técnica

- migraciones DEV 19/19 y PROD 19/19; dry-run PROD sin pendientes;
- auditoría LIVE pública PROD 11/11;
- `test:monitoring` 7/7;
- `test:prod-operations` 12/12 y contrato 22 archivos/17 alertas/7 smoke checks;
- `test:prod-hosting` 18/18;
- `test:prod-artifact` 16/16 y build sintético PASS;
- `test:edge-config` 14/14; recovery 18/18; push 47/47; session 11/11; navigation 5/5; MFA 14/14;
- primera ejecución automática de monitoreo: run `34328893538`, evento `schedule`, rama `afucoa-v2`, 11/11 PASS, 0 Issues abiertos;
- `test:staging` PASS y workflow staging run `34295461091` SUCCESS para Fase 3J; el run final de Fase 3K se registra al publicar este cierre documental.

No cambió ningún archivo de `src/` ni `public/`, por lo que no correspondió ejecutar un deploy Cloudflare PROD.

## Riesgos residuales

- Recovery/email PROD está `ACTIVE`. Los probes periódicos request/confirm son `OPTIONS` read-only y no envían email ni crean/consumen códigos o rate limits.
- Señales basadas en tráfico real permanecen `BASELINE_PENDING_REAL_TRAFFIC` hasta B10.
- UptimeRobot FREE aporta una única región.
- GitHub Actions no ofrece SLA del scheduler y los contratos Edge/Storage se comprueban nominalmente cada 15 minutos, no cada 5 minutos.
- Uptime y status de entrega no garantizan experiencia del navegador, Web Push exactly-once ni ausencia total de incidentes.

Runbooks: `docs/INCIDENT_RESPONSE.md` y `docs/runbooks/`.
