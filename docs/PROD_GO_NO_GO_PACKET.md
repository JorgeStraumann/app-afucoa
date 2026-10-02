# AFUCOA V2 — Paquete de decisión GO/NO-GO (B10)

Estado: **GO CON CONDICIONES — APPLY AUTORIZADO PARA LOTE EXACTO**

Fecha de actualización: 30 de septiembre de 2026 (America/Montevideo)

Rama de control: `afucoa-v2`

SHA funcional desplegado en PROD: `e91327e17fa0b813f354f4d00345ef26cd55d38f`

Origin PROD: `https://afucoa-v2-prod.pages.dev/`

La decisión institucional fue registrada el 30 de septiembre de 2026. El dry-run posterior aprobó `5 ready / 0 rejected / 0 conflicts` y el responsable autorizó separadamente el `--apply` del lote `prod-cohort-3a15c4d1272f` en PROD. No autoriza otro lote, ampliación, Pilot 01 masivo, cambios de infraestructura ni un nuevo deploy frontend.

El borrador prellenado para resolver I01–I03 está en `docs/B10_INSTITUTIONAL_DECISION_DRAFT.md`.

## Resumen ejecutivo

AFUCOA V2 alcanzó **GO técnico**: B01–B09 están `CLOSED`, la validación pública de Fase 4C cerró el defecto de Administración → Propuestas y PROD volvió a cero identidades/datos sintéticos. No quedan blockers técnicos abiertos conocidos.

B10 queda resuelto como **GO CON CONDICIONES** para el alcance de dry-run. Antes de cualquier alta continúan pendientes estas condiciones:

1. soporte y responsables operativos;
2. privacidad, finalidades, retención, consentimiento y atención de derechos;
3. alcance nominal, ventana y autorización separada de cualquier alta o piloto real.

Las brechas técnicas E01 y E02 fueron cerradas el 30 de septiembre: la matriz sintética RLS/integración PROD aprobó 112 controles y una carga acotada aprobó 30/30 health, 20/20 hosting y el límite concurrente 3/5. La evidencia no sustituye aprobaciones institucionales ni constituye una promesa de capacidad/SLA.

La autorización separada se limita a **GO TÉCNICO / APPLY DEL LOTE EXACTO / AMPLIACIÓN NO AUTORIZADA**.

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
| E01 RLS/integración PROD | CLOSED | `docs/PROD_SYNTHETIC_READINESS.md` |
| E02 carga/abuso acotado | CLOSED | `docs/PROD_SYNTHETIC_READINESS.md` |

Baseline aprobado:

- workflow PROD `35800017711`: `SUCCESS`;
- deployment Cloudflare `81c04089-9f91-4712-97a9-7f8b73c07c65`;
- staging del cierre documental `36060698629`: `SUCCESS`;
- cleanup Fase 4C: Auth, MFA, profiles, propuestas, apoyos, moderación y auditoría sintéticos en `0`;
- `main`, V1 y Pilot 01 sin cambios ni ejecución.

## Gates institucionales pendientes

La hoja consolidada para resolver los puntos generales antes de una ampliación es `docs/PRODUCTION_GOVERNANCE_CLOSEOUT.md`. Mantiene separadas las decisiones pendientes de la autorización ya ejecutada para el único lote de cinco.

| ID | Decisión requerida | Evidencia/plantilla | Estado |
| --- | --- | --- | --- |
| I01 | Aprobar canal, horario, responsables, severidades, escalamiento y verificación de identidad para soporte | `docs/PRODUCTION_SUPPORT_MODEL.md` | **CONDITIONED — Jorge designado temporalmente para este lote** |
| I02 | Aprobar inventario, finalidad, base institucional/legal, información/consentimiento, retención, derechos y responsables de datos | `docs/PRODUCTION_DATA_APPROVAL.md`, `docs/DATA_RETENTION.md` | **CONDITIONED — autorizado para estas 5 identidades; ampliación pendiente** |
| I03 | Aprobar alcance nominal, ventana, canal de alta y criterios de suspensión para cualquier cohorte real | `docs/PRODUCTION_CUTOVER_CHECKLIST.md`, `docs/PROD_COHORT_DRY_RUN.md` | **APPROVED — batch exacto; Pilot 01 masivo PARKED** |
| E01 | Matriz general RLS/integración PROD cleanup-safe | `docs/PROD_SYNTHETIC_READINESS.md` | **CLOSED — 112/112, cleanup 0** |
| E02 | Baseline acotado de carga y controles de abuso | `docs/PROD_SYNTHETIC_READINESS.md`, `docs/PRODUCTION_SLO.md` | **CLOSED — sin SLA inferido** |

No se debe marcar un gate como aprobado con una conversación informal. La evidencia mínima es fecha, responsable, alcance exacto, condiciones y referencia a la decisión conservada fuera del repositorio cuando contenga datos personales o contactos.

La decisión adoptada es un `GO CON CONDICIONES` limitado a un máximo de 5 socios, con dry-run previo, autorización separada de `--apply`, soporte durante la ventana y aborto fail-closed.

El dry-run autorizado se ejecutó el 30 de septiembre de 2026 y produjo `5 ready`, `0 rejected`, `0 conflicts`, sin cambios. La verificación posterior confirmó Auth y profiles en cero. Evidencia sin PII: `docs/PROD_COHORT_DRY_RUN.md`.

Después de la autorización separada, el mismo batch fue aplicado: `5` Auth creados, `5` profiles socio/activo vinculados, `0` rechazados y trazabilidad `5/5`. El smoke autenticado aprobó login y `get_my_profile` para las cinco identidades usando únicamente logout local. Credenciales y rollback permanecen fuera de Git.

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
3. resolver I01–I03 sin decisiones implícitas y revisar la evidencia cerrada E01/E02;
4. confirmar backup, rollback y responsables disponibles;
5. definir ventana, alcance, criterio de suspensión y comunicación;
6. registrar una única decisión: `GO`, `GO CON CONDICIONES` o `NO-GO`.

## Registro de decisión

| Campo | Valor |
| --- | --- |
| Fecha/hora y zona | **2026-09-30 21:06, America/Montevideo** |
| SHA funcional PROD autorizado | **`e91327e17fa0b813f354f4d00345ef26cd55d38f`** |
| Alcance autorizado | **cohorte inicial máxima de 5, solo hasta dry-run** |
| Ventana | **dry-run autorizado; ventana de alta PENDING** |
| Decisión | **GO CON CONDICIONES** |
| Condiciones y vencimiento | **apply solo batch exacto; detener/rollback ante inconsistencia; nueva autorización para ampliación** |
| Aprobador/solicitante | **Jorge, registrado en la tarea del proyecto** |
| Responsable operación/soporte | **Jorge, temporal** |
| Aprobador privacidad/datos | **autorización acotada registrada en la tarea; política general pendiente antes de ampliar** |
| Responsable técnico | **Jorge, temporal** |
| Incident Commander | **Jorge, temporal** |
| Evidencia externa restringida | **PII fuera de Git; hash y autorización exacta registrados sin identidades** |

## Reglas de decisión

- `GO`: I01–I03 aprobados, cero blocker abierto, responsables disponibles, rollback viable y SHA exacto congelado.
- `GO CON CONDICIONES`: solo si cada condición tiene dueño, plazo, criterio verificable y no afecta Auth/RLS, privacidad, soporte, backup o rollback.
- `NO-GO`: cualquier gate pendiente, evidencia contradictoria, drift, incidente abierto material, falta de soporte, falta de aprobación de datos o ausencia de rollback.

Este `GO CON CONDICIONES` autoriza el preflight/dry-run documentado, pero no crea usuarios. La incorporación de personas reales exige una autorización posterior, explícita y acotada que identifique procedimiento, entorno, cohorte, fecha y rollback. Pilot 01 masivo permanece `PARKED`.

## Próxima secuencia después de una decisión GO

1. congelar y volver a verificar el SHA autorizado;
2. confirmar responsables y canal de soporte de la ventana;
3. [completado] ejecutar un preflight/dry-run con el conjunto real expresamente autorizado, sin aplicar cambios;
4. [completado] revisar el reporte: `5 ready`, `0 rejected`, `0 conflicts`;
5. solicitar una autorización separada para el `--apply` exacto;
6. observar, ejecutar smoke/RLS relevante y conservar el rollback listo;
7. suspender y revertir/desactivar según el journal ante cualquier criterio de abortar.

Ninguno de esos pasos está autorizado por este documento.

## Adenda de ejecución posterior — 2026-10-01

Las frases de la decisión original que limitaban el alcance al dry-run y describían el apply como futuro reflejan el estado al momento de aprobar el paquete; fueron supersedidas por autorizaciones posteriores registradas en la tarea del proyecto.

- El responsable autorizó por separado el `--apply` del batch exacto `prod-cohort-3a15c4d1272f` en el proyecto PROD indicado arriba.
- Resultado documentado: 5 usuarios Auth creados, 5 perfiles de socio activos vinculados, cero rechazos/conflictos; postcheck idempotente `5 unchanged`; smoke técnico de login y perfil `5/5`. No se documentan identidades ni credenciales.
- La recuperación de acceso y el primer acceso bajo control de cada titular no quedan demostrados por ese smoke. La entrega de correo permanece sin verificar para cada cuenta; los códigos de prueba expiraron y no se modificaron contraseñas ni contactos.
- El 2026-10-01 el responsable cerró el seguimiento de confirmaciones directas adicionales para este lote. La decisión no cambia esos resultados ni acredita que las cinco cuentas hayan completado primer acceso o recuperación; tampoco amplía la autorización del batch.
- No se autorizó otra cohorte, cambios a esos contactos/credenciales, Pilot 01 masivo ni una promoción frontend adicional. B10 sigue condicionado al alcance exacto; no es un GO general para lanzamiento amplio.

El estado operativo de la cohorte se mantiene en `docs/PROD_COHORT_DRY_RUN.md`.
