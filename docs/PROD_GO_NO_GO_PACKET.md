# AFUCOA V2 — Paquete de decisión GO/NO-GO (B10)

Estado: **NO DECISION — B10 OPEN**

Fecha de preparación: 24 de septiembre de 2026 (America/Montevideo)

Rama de control: `afucoa-v2`

SHA funcional desplegado en PROD: `e91327e17fa0b813f354f4d00345ef26cd55d38f`

Origin PROD: `https://afucoa-v2-prod.pages.dev/`

Este documento prepara la decisión institucional. No autoriza altas reales, importaciones, Pilot 01, cambios de infraestructura ni un nuevo deploy.

## Resumen ejecutivo

AFUCOA V2 alcanzó **GO técnico**: B01–B09 están `CLOSED`, la validación pública de Fase 4C cerró el defecto de Administración → Propuestas y PROD volvió a cero identidades/datos sintéticos. No quedan blockers técnicos abiertos conocidos.

B10 continúa abierto porque todavía faltan aprobaciones institucionales sobre:

1. soporte y responsables operativos;
2. privacidad, finalidades, retención, consentimiento y atención de derechos;
3. alcance nominal, ventana y autorización separada de cualquier alta o piloto real.

La decisión también debe aceptar o convertir en condición dos brechas de evidencia conocidas: la matriz general RLS/integración PROD todavía no tiene un harness sintético cleanup-safe propio, y no existe una prueba de carga representativa con tráfico real. No son defectos reproducibles, pero no deben ocultarse.

Hasta registrar esas decisiones, el resultado obligatorio es **NO-GO OPERATIVO / GO TÉCNICO**.

## Evidencia técnica precargada

| Gate | Estado | Evidencia principal |
| --- | --- | --- |
| B01 Bootstrap/migraciones | CLOSED | `docs/PROD_BOOTSTRAP.md` |
| B02 Aislamiento/gobernanza | CLOSED | `docs/PROD_GOVERNANCE.md` |
| B03 Auth/MFA | CLOSED | `docs/PROD_AUTH_HARDENING.md`, `docs/PROD_PRIVILEGED_MFA.md` |
| B04 Recovery/email | CLOSED | `docs/PROD_PASSWORD_RECOVERY.md` |
| B05 Web Push | CLOSED | `docs/PROD_WEB_PUSH.md` |
| B06 Hosting/origin | CLOSED | `docs/PROD_CANONICAL_ORIGIN.md` |
| B07 Pipeline/rollback | CLOSED | `docs/PROD_PIPELINE_ACTIVE.md`, `docs/PRODUCTION_ROLLBACK.md` |
| B08 Backup/restore | CLOSED | `docs/PROD_BACKUP_RESTORE_DRILL.md` |
| B09 Monitoring | CLOSED | `docs/PROD_MONITORING_ACTIVE.md` |
| Validación pública final | GO TÉCNICO | `docs/PROD_PHASE4C_VALIDATION.md` |

Baseline aprobado:

- workflow PROD `35800017711`: `SUCCESS`;
- deployment Cloudflare `81c04089-9f91-4712-97a9-7f8b73c07c65`;
- staging del cierre documental `36060698629`: `SUCCESS`;
- cleanup Fase 4C: Auth, MFA, profiles, propuestas, apoyos, moderación y auditoría sintéticos en `0`;
- `main`, V1 y Pilot 01 sin cambios ni ejecución.

## Gates institucionales pendientes

| ID | Decisión requerida | Evidencia/plantilla | Estado |
| --- | --- | --- | --- |
| I01 | Aprobar canal, horario, responsables, severidades, escalamiento y verificación de identidad para soporte | `docs/PRODUCTION_SUPPORT_MODEL.md` | **PENDING APPROVAL** |
| I02 | Aprobar inventario, finalidad, base institucional/legal, información/consentimiento, retención, derechos y responsables de datos | `docs/PRODUCTION_DATA_APPROVAL.md`, `docs/DATA_RETENTION.md` | **PENDING POLICY/LEGAL/BUSINESS APPROVAL** |
| I03 | Aprobar alcance nominal, ventana, canal de alta y criterios de suspensión para cualquier cohorte real | `docs/PRODUCTION_CUTOVER_CHECKLIST.md`, `docs/pilot-01.md` | **PENDING — PILOT 01 PARKED** |
| E01 | Aceptar como condición o exigir antes del GO una matriz general RLS/integración PROD cleanup-safe | `docs/PROD_PRE_GO_LIVE_VALIDATION.md` | **PENDING RISK DECISION** |
| E02 | Aprobar límites iniciales y plan de observación ante ausencia de carga representativa | `docs/PRODUCTION_SLO.md`, `docs/PROD_MONITORING_ACTIVE.md` | **PENDING RISK DECISION** |

No se debe marcar un gate como aprobado con una conversación informal. La evidencia mínima es fecha, responsable, alcance exacto, condiciones y referencia a la decisión conservada fuera del repositorio cuando contenga datos personales o contactos.

## Reunión GO/NO-GO

Participantes mínimos:

- responsable institucional/negocio;
- responsable de operación y soporte;
- responsable de privacidad/datos;
- responsable técnico/release;
- Incident Commander designado para la ventana.

Agenda obligatoria:

1. confirmar el SHA funcional y que no existe drift;
2. revisar B01–B09 y cualquier incidente abierto;
3. resolver I01–I03 y E01–E02 sin decisiones implícitas;
4. confirmar backup, rollback y responsables disponibles;
5. definir ventana, alcance, criterio de suspensión y comunicación;
6. registrar una única decisión: `GO`, `GO CON CONDICIONES` o `NO-GO`.

## Registro de decisión

| Campo | Valor |
| --- | --- |
| Fecha/hora y zona | **PENDING** |
| SHA autorizado | **PENDING — debe ser SHA completo** |
| Alcance autorizado | **PENDING — no inferir “todos los socios”** |
| Ventana | **PENDING** |
| Decisión | **PENDING: GO / GO CON CONDICIONES / NO-GO** |
| Condiciones y vencimiento | **PENDING** |
| Aprobador negocio | **PENDING** |
| Aprobador operación/soporte | **PENDING** |
| Aprobador privacidad/datos | **PENDING** |
| Aprobador técnico | **PENDING** |
| Incident Commander | **PENDING** |
| Evidencia externa restringida | **PENDING — referencia sin PII** |

## Reglas de decisión

- `GO`: I01–I03 aprobados, cero blocker abierto, responsables disponibles, rollback viable y SHA exacto congelado.
- `GO CON CONDICIONES`: solo si cada condición tiene dueño, plazo, criterio verificable y no afecta Auth/RLS, privacidad, soporte, backup o rollback.
- `NO-GO`: cualquier gate pendiente, evidencia contradictoria, drift, incidente abierto material, falta de soporte, falta de aprobación de datos o ausencia de rollback.

Un `GO` de B10 no ejecuta scripts ni crea usuarios. La incorporación de personas reales exige una autorización posterior, explícita y acotada que identifique el procedimiento, entorno, cohorte, fecha y rollback. Pilot 01 permanece `PARKED` hasta entonces.

## Próxima secuencia después de una decisión GO

1. congelar y volver a verificar el SHA autorizado;
2. confirmar responsables y canal de soporte de la ventana;
3. ejecutar un preflight/dry-run con el conjunto real expresamente autorizado, sin aplicar cambios;
4. revisar el reporte y detenerse ante cualquier rechazo o conflicto;
5. solicitar una autorización separada para el `--apply` exacto;
6. observar, ejecutar smoke/RLS relevante y conservar el rollback listo;
7. suspender y revertir/desactivar según el journal ante cualquier criterio de abortar.

Ninguno de esos pasos está autorizado por este documento.
