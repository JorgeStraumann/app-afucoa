# AFUCOA V2 — Backup, restore, RPO y RTO

Estado: baseline aprobado; **RESTORE REAL: EXECUTED AND VALIDATED** el 6 de septiembre de 2026.

**AFUCOA V2 NO ESTÁ HABILITADA COMPLETAMENTE PARA PRODUCCIÓN. B08 está CLOSED.** Backups PROD, restore físico aislado y mecanismo Storage sintético quedaron validados. Un dump lógico adicional es defensa en profundidad futura y no bloquea B08.

## Baseline operativo aprobado

| Clase | RPO | RTO | Estado |
| --- | --- | --- | --- |
| Database/Auth metadata crítica | 24 horas con backup diario | 8 horas desde declaración hasta servicio validado | **APPROVED BASELINE** |
| Objetos privados de Storage | 24 horas | 12 horas, condicionado por volumen y mecanismo de copia | **APPROVED BASELINE** |
| Edge config/secrets | último cambio aprobado, sin depender de backup de base | 4 horas | **APPROVED BASELINE** |
| Frontend/artifacts | cero pérdida del release aprobado porque artefacto/manifest son inmutables | 2 horas | **APPROVED BASELINE** |

El drill del 6 de septiembre de 2026 observó RPO DB/Auth de 13 h 42 min 46,708 s, restore físico de 4 min 32,666 s y RTO completo de 12 min 34,589 s. Cumplió los objetivos DB/Auth y Storage. PITR no se contrató; solo se reevaluará si AFUCOA exige posteriormente un RPO menor a 24 horas.

## Inventario y estrategia

| Componente | Qué respaldar | Mecanismo esperado | Frecuencia propuesta | Responsable | Evidencia | Procedimiento de restore | Riesgo residual |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Database | esquema, tablas, funciones, grants, RLS, metadatos de Storage, migraciones y datos autorizados | backups administrados del plan; export lógico cifrado/off-site cuando corresponda; PITR solo si se contrata | diario; PITR según RPO aprobado | Database Owner | fecha, tipo, tamaño, estado, retención y prueba de lectura | restaurar primero en destino aislado, aplicar/verificar migraciones y ejecutar checks de integridad/RLS/RPC antes de decidir cutover | backup corrupto, ventana entre copias, credenciales de roles no incluidas y downtime |
| Storage objects | bytes reales por bucket, inventario de objetos, checksums y metadatos mínimos | replicación/export cifrado independiente de la DB | diario o según RPO aprobado | Storage Owner | manifest de objetos y checksums sin paths/PII públicos | restaurar a buckets aislados, comparar checksums/conteos, validar MIME/policies y recién luego planificar recuperación | el backup de Postgres solo conserva metadata y no recupera objetos borrados |
| Auth | usuarios/identidades, configuración y evidencia de settings; nunca exportar contraseñas para migrarlas | capacidades soportadas por proveedor + inventario/config declarativa; reconstrucción controlada de settings | diario para datos; en cada cambio para config | Identity Owner | conteos agregados, config review y audit trail | restaurar DB en aislado cuando aplique, revalidar sesiones, identities, redirects y política; rotar credenciales si el incidente lo exige | sesiones/tokens y secretos pueden requerir revocación separada; custom-role passwords no están en backups diarios |
| Edge config | código/versiones, allowlist, variables no secretas y nombres de secrets requeridos | Git/release manifest y export de configuración sin valores | cada release/cambio | Backend Owner | SHA, function versions y checklist de config | desplegar desde SHA aprobado, cargar secretos desde vault y ejecutar smoke E2E | drift manual o proveedor externo no disponible |
| Secrets | inventario, dueño, fecha/versión y procedimiento; no el valor en repositorio | gestor de secretos con backup/continuidad y acceso mínimo | cada alta/rotación; revisión trimestral propuesta | Security Owner | attest de existencia/rotación sin valor | generar credencial nueva, actualizar consumidores en orden, verificar y revocar anterior según runbook | pérdida simultánea del vault o dependencia de terceros |
| Frontend artifacts | bundle, manifest, SHA, digests, headers policy y SBOM si se adopta | artefactos inmutables y release manifest en almacenamiento controlado | cada release | Release Manager | digest, firma/attestation y workflow | redeploy exacto del artefacto aprobado anterior sin recompilar | proveedor/credenciales de hosting indisponibles |

## Supabase: límites y opciones

- PROD está efectivamente en Pro. El 6 de septiembre de 2026 se observaron dos backups físicos `COMPLETED`, incluido el restaurado de `2026-09-06T03:15:00.292Z`; la retención documentada para Pro es de siete días de backups diarios.
- PITR permite puntos más granulares, pero es un add-on de planes pagos con requisitos de compute. **No se asume contratado.**
- Un restore administrado puede dejar el proyecto inaccesible durante el proceso. El tiempo depende del tamaño; por eso el RTO solo puede confirmarse midiendo.
- Los backups de Database no incluyen los objetos almacenados mediante Storage API; solo incluyen metadata. Storage necesita estrategia propia.
- Backups diarios no incluyen passwords de roles Postgres personalizados; deben restablecerse cuando corresponda.

Referencia vigente: [Supabase — Database Backups](https://supabase.com/docs/guides/platform/backups).

## Verificación posterior obligatoria

1. manifest y cadena de migraciones;
2. esquema, grants, RLS, funciones y triggers;
3. conteos agregados y checksums sin PII;
4. Auth sintético, sesión y rol;
5. RPC socio/admin con controles negativos;
6. buckets, objetos, MIME, límites y URLs firmadas;
7. Edge Functions/config/secrets por inventario;
8. smoke público/autenticado/admin no destructivo;
9. tiempos y RPO real observados;
10. aprobación go/no-go antes de cualquier tráfico.

## Evidencia y revisión

Guardar reportes de backup/restore con acceso restringido, fecha UTC, responsables, origen/destino, checksums, errores, tiempos y aprobación. No incluir datos de socios, secrets, signed URLs ni endpoints push. Revisar trimestralmente la capacidad propuesta y después de cada cambio material o incidente.

La evidencia real está en `docs/PROD_BACKUP_RESTORE_DRILL.md`; el procedimiento repetible queda en `docs/runbooks/RESTORE_DRILL.md`. El restore físico y Storage sintético cumplen el criterio aprobado de B08. Un export lógico cifrado/off-site puede agregarse como **DEFENSE IN DEPTH / FUTURE IMPROVEMENT / NON-BLOCKING**, sin introducir credenciales solo para ese control.
