# AFUCOA V2 — Checklist previo a cutover y piloto

Estado: gate documental. **Pilot 01 permanece PARKED.** No autoriza usuarios, importaciones ni datos reales.

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
- [ ] **Soporte:** canales, horarios, clasificación, escalamiento, comunicaciones y procedimiento de identidad aprobados.
- [ ] **Datos reales:** inventario/finalidad/retención/consentimiento y revisión legal/business aprobados.
- [x] **Mecanismo de piloto:** dry-run, reporte, rollback, idempotencia y criterios técnicos validados sintéticamente.
- [ ] **Activación de cohorte real:** lista nominal, consentimiento, canal de alta, soporte y ventana todavía no autorizados; Pilot 01 permanece `PARKED`.
- [ ] **Decisión B10:** completar y aprobar `docs/PROD_GO_NO_GO_PACKET.md`.

## Paquete de evidencia go/no-go

- SHA, artifact digest, release manifest y resultado de workflows;
- inventario de migraciones/functions/config sin valores secretos;
- pruebas RLS/integración/Auth/recovery/push/Storage sobre PROD vacío con usuarios sintéticos propios;
- reporte de security/advisors y riesgos aceptados con dueño/fecha;
- resultado de restore drill, RPO/RTO observado y backups vigentes;
- health checks, dashboards, alertas y game day;
- [x] aprobación/evidencia técnica B01–B09 y Fase 4C;
- [ ] aprobación de seguridad/privacidad y datos;
- [ ] aprobación de negocio y alcance;
- [ ] aprobación de operación/soporte;
- [ ] registro final GO/GO CON CONDICIONES/NO-GO.

## Decisión

**GO** requiere todos los gates, cero blocker abierto, rollback viable y aprobaciones registradas. **NO-GO** aplica ante cualquier blocker, evidencia incompleta, drift, secreto DEV, backup/restore no probado, alerta no operativa o falta de soporte.

Un GO de infraestructura no reactiva automáticamente Pilot 01. Reactivarlo y aplicar un lote de personas reales requiere una autorización posterior, explícita y acotada. Hasta entonces: **PILOT 01 PARKED; cero importaciones y cero usuarios reales.**

Paquete de decisión: `docs/PROD_GO_NO_GO_PACKET.md`. Plantillas pendientes: `docs/PRODUCTION_SUPPORT_MODEL.md` y `docs/PRODUCTION_DATA_APPROVAL.md`.
