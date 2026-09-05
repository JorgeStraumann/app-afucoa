# Runbook — Database, RPC, RLS o Storage incident

1. Identificar si afecta disponibilidad, integridad, latencia, conexiones, RPC, RLS o Storage; registrar UTC y release/migration manifest.
2. Declarar SEV1 ante probable corrupción/pérdida o indisponibilidad amplia; SEV2 ante degradación sostenida.
3. Preservar logs y métricas redacted. No copiar filas, archivos privados, signed URLs ni credenciales al canal.
4. Detener promociones. Limitar escrituras solo mediante un mecanismo previamente aprobado; no improvisar cambios destructivos.
5. Comparar versiones de migración, grants, RLS, funciones, índices, capacidad y provider status.
6. No deshabilitar RLS ni convertir funciones para recuperar servicio. Corregir la causa o usar forward-fix revisado.
7. Ante pérdida, seguir `BACKUP_RESTORE.md` y `RESTORE_DRILL.md`; el restore requiere destino/autoridad aprobados.
8. Validar integridad, conteos agregados, RLS positivos/negativos, RPC, Auth sintético y objetos Storage.
9. Documentar RPO/RTO observado, riesgo residual y tareas antes del cierre.

Toda intervención de datos requiere dos revisores y evidencia; este runbook no autoriza comandos automáticos de eliminación.
