# AFUCOA V2 — Borrador de retención de datos

Estado: borrador exclusivamente documental. **PENDING POLICY/LEGAL APPROVAL** para todas las decisiones institucionales.

No se afirma una obligación legal uruguaya concreta. AFUCOA debe obtener revisión legal/privacidad, definir finalidades, plazos, excepciones de litigio/auditoría y procedimiento de derechos antes de activar cualquier purga. Esta fase no contiene SQL ni automatiza eliminación.

| Categoría | Finalidad | Sensibilidad | Retención propuesta | Criterio de purga propuesto | Dueño | Aprobación requerida |
| --- | --- | --- | --- | --- | --- | --- |
| `profiles` | identidad, membresía, rol y trazabilidad | alta | vida de la relación + plazo institucional por definir; perfiles históricos inactivos se preservan si tienen actividad | vencimiento de obligación/propósito y ausencia de hold; anonimizar o eliminar según decisión legal | Data Owner / Membresía | **PENDING POLICY/LEGAL APPROVAL** |
| notificaciones y recipients | comunicación interna y estado de lectura | media/alta | 24 meses desde envío, propuesta | vencimiento sin hold ni disputa | Product Owner | **PENDING POLICY/LEGAL APPROVAL** |
| `notification_push_deliveries` | ledger técnico, retry y auditoría de dispatch | media; UUID/endpoints relacionados | 12 meses, propuesta | dispatch cerrado y plazo vencido; conservar evidencia agregada si se aprueba | Messaging Owner | **PENDING POLICY/LEGAL APPROVAL** |
| `push_devices` activos | entrega al dispositivo y reconciliación de cuenta | alta por endpoint/keys | mientras activo y consentido, con revisión periódica | baja explícita, 404/410 o inactividad aprobada; nunca por logout | Messaging Owner / Privacy Owner | **PENDING POLICY/LEGAL APPROVAL** |
| `push_devices` inactivos | auditoría, prevención de reintentos y diagnóstico | alta | 90 días tras inactivación, propuesta | plazo vencido, sin hold; preservar solo métricas agregadas | Messaging Owner / Privacy Owner | **PENDING POLICY/LEGAL APPROVAL** |
| `password_recovery_codes` | seguridad, uso único, expiración y evidencia de delivery | alta | 30 días desde creación, propuesta | consumido/invalidado/expirado y plazo de incidente vencido | Identity Owner | **PENDING POLICY/LEGAL APPROVAL** |
| `password_recovery_rate_limits` | prevención de abuso | media/alta | 30 días desde última ventana, propuesta | ventana y plazo de seguridad vencidos, sin incidente abierto | Security Owner | **PENDING POLICY/LEGAL APPROVAL** |
| requests/trámites y eventos/mensajes | prestación del servicio, historial y auditoría | alta | según tipo de trámite y obligación institucional aún no definidas | cierre + plazo aprobado, sin hold, reclamo o dependencia | Process Owner / Data Owner | **PENDING POLICY/LEGAL APPROVAL** |
| propuestas y apoyos/moderación | participación, estado y decisiones | media/alta | 5 años desde cierre, propuesta | plazo vencido y sin hold; evaluar anonimización de apoyos | Product Owner / Governance | **PENDING POLICY/LEGAL APPROVAL** |
| archivos privados | soporte documental de trámites/biblioteca privada | muy alta | alineada al registro de negocio asociado | registro asociado elegible, plazo vencido y checksum/evidencia preservados según política | Storage Owner / Data Owner | **PENDING POLICY/LEGAL APPROVAL** |
| logs técnicos/Auth/Edge/DB/Storage | seguridad, disponibilidad, diagnóstico | alta; puede contener IP/UUID | 90 días online + archivo restringido de hasta 12 meses, propuesta | vencimiento sin incidente/hold; redacción y minimización obligatorias | Security Owner / Operations | **PENDING POLICY/LEGAL APPROVAL** |
| release manifests y artifacts | reproducibilidad, rollback y auditoría de releases | baja/media | vida del sistema + 5 años, propuesta | fuera de soporte y sin auditoría/hold | Release Manager | **PENDING POLICY/LEGAL APPROVAL** |
| audit evidence e incidentes | cumplimiento, investigación y aprendizaje | alta | 5 años desde cierre, propuesta | vencimiento y autorización conjunta Legal/Security | Security Owner / Governance | **PENDING POLICY/LEGAL APPROVAL** |

## Reglas de implementación futura

- Documentar base/propósito, reloj de retención, dependencias y excepciones por cada categoría.
- Aplicar legal hold antes de cualquier proceso programado.
- Probar en copia aislada y modo report-only; obtener doble aprobación antes de activar.
- Preservar integridad referencial e historial cuando una identidad tenga actividad de negocio.
- Generar evidencia agregada de candidatos, excluidos, procesados y fallos sin PII.
- Coordinar DB y objetos Storage: eliminar metadata sin objeto, o viceversa, genera inconsistencias.
- Mantener backups y copias derivadas bajo la misma política, considerando sus ventanas de expiración.
- Revisar anualmente o ante cambio legal, funcional o de proveedor.

**NO AUTOMATIC PURGE ENABLED.** No existe tarea de purga, SQL de borrado ni autorización operativa en esta fase.
