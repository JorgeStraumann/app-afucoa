# AFUCOA V2 — rollback de producción

Estado Fase 3E: origin PROD existente y workflow de rollback real versionado; prueba controlada pendiente al momento de este commit.

## Frontend

El rollback operativo usa un deployment Production anterior ya almacenado por Cloudflare Pages. Nunca recompila el commit viejo ni produce un dist nuevo. El workflow `.github/workflows/afucoa-v2-production-rollback.yml` recibe su UUID, exige aprobación en `production`, consulta el deployment por la ruta específica del proyecto y rechaza Preview, fallo u otra branch.

El procedimiento es: declarar incidente, congelar nuevos deploys, seleccionar un deployment Production conocido, lanzar manualmente `AFUCOA V2 production rollback`, aprobar el Environment y dejar que el precheck llame al endpoint oficial de rollback. El workflow usa la misma concurrencia exclusiva del deploy y ejecuta smoke de HTTPS/headers/cache/Auth/rutas/worker. Si el Service Worker impide una recuperación rápida, se aplica el runbook de actualización; no se cambia el worker improvisadamente.

## Edge Functions

Cada release manifest registra las cuatro funciones esperadas y una versión portable por hash SHA-256 de sus fuentes, incluida la capa `_shared`. El contador de versión remoto de Supabase no sustituye ese hash. Promoción y rollback requieren bundles/versiones previamente aprobados; no se editan funciones manualmente desde Dashboard durante el incidente.

## Database

No existe rollback destructivo automático. Las migraciones aplicadas son inmutables y el manifest de migraciones forma parte de la evidencia del release. La estrategia normal es forward-fix compatible. Un restore completo se reserva para incidentes que cumplan el runbook aprobado, con responsables, RPO/RTO, backup verificado y ensayo previo en un entorno aislado.

## Auth y secretos

La rotación/revocación de claves, recuperación de cuentas privilegiadas y cambios de Auth tienen runbooks distintos del rollback frontend. Nunca se “restaura” un secreto copiando DEV ni se vuelve a una clave comprometida. Un rollback de UI no revierte usuarios, sesiones, correo, VAPID, Resend, Auth settings ni datos.

## Criterios mínimos

- artifact y release manifest anteriores disponibles e íntegros;
- aprobación humana y dueño del incidente;
- no existe una migración incompatible que vuelva inseguro el frontend anterior;
- smoke tests definidos y canal de comunicación preparado;
- registro de inicio, decisión, resultado y acciones posteriores.

Cloudflare admite como target cualquier build exitoso de Production y no admite Preview. Volver al release actual se hace ejecutando el mismo workflow contra el deployment Production aprobado; también exige approval y smoke. La evidencia de la prueba controlada se registra en `docs/PROD_PIPELINE_ACTIVE.md`.
