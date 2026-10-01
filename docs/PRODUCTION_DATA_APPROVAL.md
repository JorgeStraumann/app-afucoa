# AFUCOA V2 — Gate de datos, privacidad y consentimiento

Estado: **LOTE INICIAL EXACTO DE 5 APLICADO BAJO AUTORIZACIÓN B10; POLÍTICA GENERAL Y AMPLIACIÓN PENDIENTES**

Este documento organiza las decisiones institucionales generales. No constituye asesoramiento legal ni reemplaza aprobaciones del responsable competente. Una autorización B10 posterior permitió únicamente el tratamiento mínimo de las cinco identidades del batch `prod-cohort-3a15c4d1272f`, ya aplicado; no autoriza otros lotes, ampliación, purgas ni automatizaciones. Los campos `PENDING` de esta matriz se refieren al marco general pendiente.

## Decisiones requeridas

| Área | Decisión/evidencia requerida | Estado |
| --- | --- | --- |
| Inventario y minimización | campos necesarios por módulo y campos excluidos | **PENDING** |
| Finalidad | propósito aprobado para cada categoría de `docs/DATA_RETENTION.md` | **PENDING** |
| Base institucional/legal | fundamento documentado por el responsable competente | **PENDING** |
| Información/consentimiento | texto, momento, versión y evidencia cuando corresponda | **PENDING** |
| Titularidad de email | procedimiento antes de habilitar recuperación | **PENDING** |
| Retención | plazos, reloj, excepciones y legal hold por categoría | **PENDING** |
| Derechos/solicitudes | recepción, verificación, responsable, plazo y evidencia | **PENDING** |
| Encargados/proveedores | Supabase, Cloudflare, Brevo, GitHub y otros revisados según política | **PENDING** |
| Transferencias/ubicación | evaluación y decisión institucional | **PENDING** |
| Incidentes | responsable y canal restringido para privacidad/seguridad | **PENDING** |
| Borrado/anonimización | procedimiento aprobado y probado en copia antes de automatizar | **PENDING** |

## Reglas ya fijadas técnicamente

- no migrar contraseñas, hashes, OTP, códigos de recuperación ni secretos de V1;
- no reutilizar secretos DEV en PROD;
- no incluir PII en payloads Web Push ni evidencia pública;
- no exponer existencia de una cédula en recuperación;
- preservar historial cuando un perfil tenga actividad y cortar acceso Auth de forma consistente;
- mantener buckets privados y signed URLs para documentos privados;
- no activar purgas automáticas sin política aprobada, modo report-only y rollback.

Estas garantías técnicas no sustituyen la aprobación institucional del tratamiento.

## Evidencia mínima de aprobación

- versión y fecha de los textos aprobados;
- responsable de negocio/datos y responsable de privacidad/legal;
- categorías alcanzadas y exclusiones;
- plazos de retención y excepciones;
- procedimiento de derechos e incidentes;
- referencia restringida a la aprobación, sin copiar PII al repositorio.

La decisión B10 y la autorización posterior permiten el `--apply` exclusivamente para las cinco identidades del batch `prod-cohort-3a15c4d1272f`. Los campos `PENDING` continúan bloqueando cualquier ampliación, automatización de retención o lote diferente.
