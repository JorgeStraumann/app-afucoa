# AFUCOA V2 — Respuesta a incidentes

Estado: circuito técnico activo; modelo temporal de un único operador.

## Detección y declaración

Un incidente puede originarse en alertas, soporte, proveedor, security scan o evidencia humana. Quien recibe la señal crea un registro con hora UTC, síntoma, entorno, SHA y fuente redacted. El **Incident Commander** designado declara severidad; si no está disponible, la primera persona técnica responsable asume temporalmente y escala.

| Severidad | Criterio | Cadencia propuesta |
| --- | --- | --- |
| SEV1 | servicio totalmente inaccesible, Auth general caído, compromiso/filtración o corrupción/pérdida probable | atención inmediata y actualización cada 30 min, provisional |
| SEV2 | degradación importante, deploy defectuoso o recuperación/email/push/Edge ampliamente fallando | atención prioritaria y actualización cada 60 min, provisional |
| SEV3 | fallo limitado, anomalía, dispositivo/usuario individual o capacidad aproximándose a límite | horario operativo y seguimiento diario, provisional |

Las cadencias son provisionales y requieren aprobación de AFUCOA.

## Roles y canal

- **Incident Commander:** decide severidad, prioridades y cierre; no investiga todo personalmente.
- **Technical Lead:** coordina diagnóstico, mitigación y rollback.
- **Communications Lead:** comunica estado sin PII ni hipótesis no verificadas.
- **Scribe:** mantiene timeline, decisiones, evidencia y responsables.
- **Security/Privacy Owner:** obligatorio ante credenciales, acceso indebido o datos.

UptimeRobot envía email al Owner operativo y GitHub Issues conserva el incidente técnico redacted. El repositorio nunca contiene el email, teléfonos, secretos o datos de afectados. Mientras rige el **SINGLE-OPERATOR TEMPORARY MODEL**, Jorge ocupa todos los roles; AFUCOA debe separar responsabilidades antes de escalar la operación.

## Flujo

1. **Detectar y validar:** confirmar entorno, alcance y señal independiente.
2. **Declarar:** asignar ID, severidad, roles y canal.
3. **Preservar evidencia:** capturar timestamps UTC, request/correlation IDs opacos, SHA, versiones y métricas; no copiar secrets ni PII.
4. **Contener:** reducir daño con el cambio mínimo reversible; no debilitar Auth/RLS.
5. **Mitigar:** seguir el runbook específico y registrar cada acción/resultado.
6. **Rollback:** frontend usa artefacto aprobado previo; DB usa forward-fix o proceso de restore aprobado, nunca improvisado. Consultar `docs/PRODUCTION_ROLLBACK.md` y `docs/BACKUP_RESTORE.md`.
7. **Comunicar:** hechos, impacto, mitigación y próxima actualización. Evitar culpas, credenciales y detalles explotables.
8. **Recuperar:** verificar smoke checks, datos, permisos y métricas antes de declarar estable.
9. **Cerrar:** Incident Commander confirma criterios, tareas residuales y dueño.
10. **Postmortem:** dentro del plazo aprobado, documentar timeline, causa, factores, detección, impacto y acciones con fechas; separar aprendizaje de culpabilidad.

## Evidencia mínima

- ID y severidad; inicio/detección/mitigación/cierre en UTC;
- entorno, release SHA, artifact digest, funciones/migraciones relevantes;
- señales agregadas antes/después;
- decisiones, aprobador y resultado;
- comunicaciones emitidas;
- lista de acciones preventivas con dueño/fecha.

## Runbooks

- `docs/runbooks/FRONTEND_OUTAGE.md`
- `docs/runbooks/AUTH_OUTAGE.md`
- `docs/runbooks/DATABASE_INCIDENT.md`
- `docs/runbooks/PASSWORD_RECOVERY_INCIDENT.md`
- `docs/runbooks/WEB_PUSH_INCIDENT.md`
- `docs/runbooks/EDGE_FUNCTION_INCIDENT.md`
- `docs/runbooks/SECRET_EXPOSURE.md`
- `docs/runbooks/DNS_TLS_INCIDENT.md`

Los runbooks son guías de decisión, no autorización para cambios destructivos. Un restore, rotación de credenciales o cambio de DNS exige la autoridad y doble revisión definidas para PROD.

Una credencial que aparezca en pantalla, terminal o salida de herramienta se considera expuesta aunque no haya llegado a Git. Se debe detener su uso, crear un reemplazo por un canal seguro, validar el reemplazo, rotar/revocar la anterior y comprobar consumidores. En el cierre B04, las claves Brevo candidatas visibles se desactivaron, las API keys legacy PROD se deshabilitaron y la firma HS256 anterior se revocó; Recovery y Push ya usan las nuevas Secret API Keys. No se documentan valores.

Para Web Push PROD, consultar además `docs/PROD_WEB_PUSH.md`: observar `found`, `sent`, `failed`, `skipped`, `deactivated`, `limited`, status de incidentes y claims `sending` estancados. Nunca copiar endpoints completos. Un 404/410 debe terminar con dispositivo desactivado y ledger `inactive`; 5xx/timeout conserva el dispositivo y respeta la ventana/máximo de reintentos.

El workflow `AFUCOA V2 production monitoring` deduplica por `alert-id`. Fallos repetidos actualizan el mismo issue; recovery comenta `RECOVERED` con timestamp UTC y lo cierra. UptimeRobot cubre el canal externo compatible con FREE. El inventario y la limitación de los tres probes avanzados están en `docs/PROD_MONITORING_ACTIVE.md`.
