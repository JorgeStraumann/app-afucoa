# AFUCOA V2 — gobernanza GitHub para producción

Estado Fase 3E: el Environment `production` está activo con reviewer requerido `JorgeStraumann`, self-review permitido y deployment branch policy limitada a `afucoa-v2`. Los workflows manuales de promoción y rollback están versionados. `main` no fue modificado ni configurado como canal V2.

`main` continúa representando V1 y avanzó independientemente durante el trabajo de V2. No debe revertirse, mezclarse ni usarse automáticamente como canal de producción de AFUCOA V2. La identidad de cada release V2 será un SHA completo aprobado, acompañado por tag/release inmutable o control equivalente.

## Estado actual y mejoras futuras

- el SHA se selecciona de forma inmutable y debe pertenecer a `origin/afucoa-v2`;
- la aprobación humana es obligatoria en `production` y ocurre después de construir/verificar el artifact;
- la operación unipersonal permite self-review; una segunda persona deberá habilitar separación real de funciones;
- los status checks se ejecutan dentro de `prepare`; hacerlos obligatorios para merges y exigir PR permanece como mejora futura;
- la regla clásica mínima para impedir force push y branch deletion requiere completar el `Confirm access` de GitHub; hasta entonces queda como control pendiente documentado;
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
4. El workflow PROD hace checkout de ese SHA, construye una sola vez y genera manifest.
5. Un approval gate independiente autoriza el artifact, no una branch móvil.
6. Deploy y smoke quedan registrados; fallos remiten al manifest de rollback declarado.

La plantilla histórica no ejecutable permanece en `ops/templates/afucoa-v2-production-workflow.yml`. La implementación activa está en `.github/workflows/afucoa-v2-production.yml` y `.github/workflows/afucoa-v2-production-rollback.yml`; sus detalles operativos están en `docs/PROD_PIPELINE_ACTIVE.md`.
