# AFUCOA V2 — Backup, restore, RPO y RTO

Estado: diseño; **RESTORE REAL: NOT EXECUTED**.

**AFUCOA V2 NO ESTÁ HABILITADA PARA PRODUCCIÓN. B08 permanece OPEN.** Falta aprobar RPO/RTO, provisionar backups PROD, respaldar objetos de Storage y ejecutar un restore drill real aislado.

## Propuesta de objetivos

| Clase | RPO propuesto | RTO propuesto | Estado |
| --- | --- | --- | --- |
| Database/Auth metadata crítica | 24 horas con backup diario; evaluar PITR si el negocio exige menor pérdida | 8 horas desde declaración hasta servicio validado | **PENDING AFUCOA APPROVAL** |
| Objetos privados de Storage | 24 horas | 12 horas, condicionado por volumen y mecanismo de copia | **PENDING AFUCOA APPROVAL** |
| Edge config/secrets | último cambio aprobado, sin depender de backup de base | 4 horas | **PENDING AFUCOA APPROVAL** |
| Frontend/artifacts | cero pérdida del release aprobado porque artefacto/manifest son inmutables | 2 horas | **PENDING AFUCOA APPROVAL** |

Estos valores son objetivos iniciales, no capacidad demostrada. Deben compararse con costos, frecuencia de cambio y tiempos observados durante el drill.

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

- Supabase documenta backups diarios administrados para proyectos Pro, Team y Enterprise; la retención depende del plan. La contratación/retención real de PROD no está decidida.
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

El drill futuro se define en `docs/runbooks/RESTORE_DRILL.md`; su definición documental no equivale a haberlo ejecutado.
