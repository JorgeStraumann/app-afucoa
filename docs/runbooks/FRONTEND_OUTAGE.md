# Runbook — Frontend outage o deploy defectuoso

**Objetivo:** recuperar el acceso web sin cambiar datos ni recompilar un release histórico.

1. Confirmar URL canónica desde dos redes/probes y registrar hora UTC, status, TLS y SHA visible.
2. Distinguir DNS/TLS, hosting/CDN, HTML, assets, CSP y service worker. Si es DNS/TLS, usar `DNS_TLS_INCIDENT.md`.
3. Declarar SEV1 si está totalmente inaccesible; SEV2 si el shell carga pero una parte amplia falla.
4. Congelar promociones y preservar workflow, artifact digest, release manifest y headers observados.
5. Comparar el artefacto servido con el manifest aprobado. No borrar caches de usuarios ni desregistrar workers en masa.
6. Si el release causó el incidente, redeployar el **artefacto inmutable anterior aprobado** conforme a `PRODUCTION_ROLLBACK.md`; no recompilar desde una rama móvil.
7. Validar HTTPS, headers, manifest, worker, login sintético y navegación mínima.
8. Comunicar alcance, mitigación y próxima actualización; cerrar solo cuando probes y métricas se estabilicen.

Escalar al proveedor si el hosting no sirve el artefacto correcto. Nunca colocar keys privadas en el workflow o bundle para resolver una caída.
