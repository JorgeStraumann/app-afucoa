# AFUCOA V2 — Checklist previo a cutover y piloto

Estado: gate documental. **Pilot 01 permanece PARKED.** No autoriza usuarios, importaciones ni datos reales.

## Gates obligatorios antes de solicitar go/no-go

- [ ] **B01 cerrado:** fresh-db aislado desde las migraciones canónicas, comparación estructural, RLS/RPC/Storage y evidencia aprobada.
- [ ] **Supabase PROD aislado:** proyecto, región, plan, accesos, billing y datos separados; cero reutilización de secretos/usuarios DEV.
- [ ] **Auth endurecido:** signup, redirects, sesiones, política, Leaked Password Protection y control privilegiado aprobados/probados.
- [ ] **Email PROD:** dominio/remitente, SPF/DKIM/DMARC según política, secret exclusivo, rate limits y recovery E2E sintético.
- [ ] **Web Push PROD:** VAPID exclusiva, worker/scope final, ledger, limpieza 404/410, monitoreo y E2E sintético multidispositivo.
- [ ] **Hosting/dominio:** URL HTTPS canónica, DNS/TLS, headers, cache, PWA, assets, refresh y release manifest verificados.
- [ ] **Workflow/protecciones:** artefacto inmutable, Environment/aprobación, branch rules, secret scanning y rollback probado.
- [ ] **Backup/restore:** RPO/RTO aprobados, backups DB/Storage reales, responsables y restore drill aislado con tiempos observados.
- [ ] **Monitoring/SLO:** proveedor integrado, dashboards sin PII, alertas activas/calibradas, guardia y escalamiento ensayados.
- [ ] **Runbooks:** incidentes, secret rotation, restore y rollback revisados; dueños/contactos accesibles fuera del repo.
- [ ] **Soporte:** canales, horarios, clasificación, escalamiento, comunicaciones y procedimiento de identidad aprobados.
- [ ] **Datos reales:** inventario/finalidad/retención/consentimiento y revisión legal/business aprobados.
- [ ] **Piloto:** cohorte exacta, dry-run, reporte, rollback, criterios de suspensión y soporte de alta definidos.

## Paquete de evidencia go/no-go

- SHA, artifact digest, release manifest y resultado de workflows;
- inventario de migraciones/functions/config sin valores secretos;
- pruebas RLS/integración/Auth/recovery/push/Storage sobre PROD vacío con usuarios sintéticos propios;
- reporte de security/advisors y riesgos aceptados con dueño/fecha;
- resultado de restore drill, RPO/RTO observado y backups vigentes;
- health checks, dashboards, alertas y game day;
- aprobaciones técnica, seguridad/privacidad, negocio y operación.

## Decisión

**GO** requiere todos los gates, cero blocker abierto, rollback viable y aprobaciones registradas. **NO-GO** aplica ante cualquier blocker, evidencia incompleta, drift, secreto DEV, backup/restore no probado, alerta no operativa o falta de soporte.

Un GO de infraestructura no reactiva automáticamente Pilot 01. Reactivarlo y aplicar un lote de personas reales requiere una autorización posterior, explícita y acotada. Hasta entonces: **PILOT 01 PARKED; cero importaciones y cero usuarios reales.**
