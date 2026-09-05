# AFUCOA V2 — rollback de producción

Estado: estrategia documental; no existe infraestructura ni release PROD.

## Frontend

El rollback consiste en redeployar exactamente un artefacto anterior ya aprobado. Nunca se recompila el commit viejo: se descarga el artifact inmutable, se valida su release manifest y se comparan todos sus SHA-256 antes de promoverlo. Se conservan manifest, deployment ID, SHA, fecha, smoke result y motivo del rollback.

El procedimiento futuro será: declarar incidente, congelar nuevos deploys, seleccionar el último manifest aprobado, verificar hashes, redeployar con concurrencia exclusiva, ejecutar smoke de HTTPS/headers/cache/Auth/rutas/worker y registrar cierre. Si el Service Worker impide una recuperación rápida, se aplica la purga CDN prevista por el proveedor y el runbook de actualización; no se cambia el worker improvisadamente.

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
