# AFUCOA V2 — gobernanza GitHub para producción

Estado observado/documentado: `main` y `afucoa-v2` no tienen protección activa. Esta fase no modifica Repository Settings, rulesets, Environments ni permisos.

`main` continúa representando V1 y avanzó independientemente durante el trabajo de V2. No debe revertirse, mezclarse ni usarse automáticamente como canal de producción de AFUCOA V2. La identidad de cada release V2 será un SHA completo aprobado, acompañado por tag/release inmutable o control equivalente.

## Estado requerido antes de PROD

- pull request obligatorio para todo código candidato;
- al menos una revisión humana responsable;
- status checks obligatorios: hosting policy, artefacto PROD, Edge config, migraciones, recovery, push, sesiones, navegación y las suites preproducción autorizadas;
- impedir force push y branch deletion;
- conversaciones resueltas y commit aprobado sin cambios posteriores;
- staging y production en jobs/environments separados;
- Environment PROD con approval gate si el plan lo permite;
- concurrencia PROD serializada y sin cancelación automática de un deploy en curso;
- permisos mínimos: lectura del repo para build y credencial acotada del proveedor solo en el job deploy;
- artifacts, manifests, tags/releases y audit logs con retención aprobada;
- dueños nominados para aprobar, desplegar, rollbackear y responder incidentes.

## Flujo de gobierno

1. PR incorpora un candidato y supera CI sin credenciales reales.
2. Revisión humana aprueba un SHA exacto.
3. Se crea tag/release protegido o registro inmutable equivalente.
4. El workflow PROD futuro hace checkout de ese SHA, construye una sola vez y genera manifest.
5. Un approval gate independiente autoriza el artifact, no una branch móvil.
6. Deploy y smoke quedan registrados; fallos remiten al manifest de rollback declarado.

La plantilla no ejecutable vive en `ops/templates/afucoa-v2-production-workflow.yml`. Mover/adaptar ese diseño a `.github/workflows/` requerirá otra fase, proveedor decidido y autorización explícita.
