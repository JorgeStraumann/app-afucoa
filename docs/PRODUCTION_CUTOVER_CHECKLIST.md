# AFUCOA V2 — Checklist previo a cutover y piloto

Estado: **GO CON CONDICIONES — APPLY AUTORIZADO PARA `prod-cohort-3a15c4d1272f`.** Pilot 01 masivo permanece `PARKED`; no autoriza otro lote ni ampliación.

## Estado de gates antes de solicitar go/no-go

- [x] **B01 cerrado:** fresh-db aislado desde las migraciones canónicas, comparación estructural, RLS/RPC/Storage y evidencia aprobada.
- [x] **Supabase PROD aislado:** proyecto, región, plan, accesos, billing y datos separados; cero reutilización de secretos/usuarios DEV.
- [x] **Auth endurecido:** signup, redirects, sesiones, política, Leaked Password Protection y control privilegiado aprobados/probados.
- [x] **Email PROD:** provider/remitente PROD, secret exclusivo, rate limits y recovery E2E sintético; dominio branded queda como mejora post go-live según la política vigente.
- [x] **Web Push PROD:** VAPID exclusiva, worker/scope final, ledger, limpieza 404/410, monitoreo y E2E sintético multidispositivo.
- [x] **Hosting/dominio:** URL HTTPS canónica, TLS, headers, cache, PWA, assets, refresh y release manifest verificados.
- [x] **Workflow/protecciones:** artefacto inmutable, Environment/aprobación, branch rules, secret scanning y rollback probado.
- [x] **Backup/restore:** RPO/RTO técnicos documentados, backups DB/Storage, responsables y restore drill aislado con tiempos observados.
- [x] **Monitoring:** cobertura combinada, alertas, responsables y game days; SLO estadístico continúa provisional hasta existir tráfico aprobado.
- [x] **Runbooks técnicos:** incidentes, secret rotation, restore y rollback versionados y ensayados.
- [x] **Soporte para alta inicial:** Jorge fue designado temporalmente como soporte, Incident Commander y responsable técnico para el lote exacto.
- [x] **Datos reales para alta inicial:** tratamiento mínimo de las cinco identidades autorizado para el batch exacto; la política general continúa pendiente antes de ampliar.
- [x] **Mecanismo de piloto:** dry-run, reporte, rollback, idempotencia y criterios técnicos validados sintéticamente.
- [x] **RLS/integración PROD:** 112 controles sintéticos cleanup-safe aprobados; Auth y datos volvieron a cero.
- [x] **Carga/abuso acotado:** 30/30 health, 20/20 hosting y rate limit concurrente 3 permitidos/5 bloqueados; sin inferir SLA.
- [x] **Activación de cohorte inicial:** `--apply` completado con `5 Auth / 5 profiles`, smoke `5/5` y cero rechazos/conflictos; ampliación no autorizada.
- [x] **Decisión B10:** `GO CON CONDICIONES` y autorización separada registrados para el batch exacto.

## Paquete de evidencia go/no-go

- SHA, artifact digest, release manifest y resultado de workflows;
- inventario de migraciones/functions/config sin valores secretos;
- pruebas RLS/integración/Auth/recovery/push/Storage sobre PROD vacío con usuarios sintéticos propios;
- reporte de security/advisors y riesgos aceptados con dueño/fecha;
- resultado de restore drill, RPO/RTO observado y backups vigentes;
- health checks, dashboards, alertas y game day;
- [x] aprobación/evidencia técnica B01–B09 y Fase 4C;
- [x] aprobación acotada de seguridad/privacidad y datos para el lote inicial;
- [x] aprobación de negocio y alcance para el batch exacto;
- [x] aprobación temporal de operación/soporte para el lote inicial;
- [x] registro final `GO CON CONDICIONES` para el batch exacto.

## Decisión

**GO** requiere todos los gates, cero blocker abierto, rollback viable y aprobaciones registradas. **NO-GO** aplica ante cualquier blocker, evidencia incompleta, drift, secreto DEV, backup/restore no probado, alerta no operativa o falta de soporte.

El GO condicionado no reactiva Pilot 01 masivo. La autorización posterior, explícita y acotada fue recibida solo para `prod-cohort-3a15c4d1272f`; cualquier otro lote o ampliación sigue prohibido.

Paquete de decisión: `docs/PROD_GO_NO_GO_PACKET.md`. Las políticas generales de soporte y datos continúan condicionadas antes de ampliar la cohorte.
