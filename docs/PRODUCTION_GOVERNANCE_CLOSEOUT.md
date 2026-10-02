# AFUCOA V2 — Paquete de cierre de gobernanza

Fecha de corte: 2026-10-01 (America/Montevideo)

Estado: **PREPARADO PARA DECISIÓN INSTITUCIONAL; NO APROBADO COMO POLÍTICA GENERAL**

Este documento reúne lo que aún debe decidirse para convertir la operación limitada actual en una operación ampliada. Es un instrumento administrativo, no asesoramiento legal ni aprobación por sí mismo. No introduce cambios en producción, contratos, contactos, datos ni automatizaciones.

## Alcance y hechos vigentes

- B01–B09 tienen cierres técnicos documentados; B10 autorizó condicionalmente solo el lote exacto `prod-cohort-3a15c4d1272f`, ya aplicado.
- El lote contiene cinco cuentas/profiles vinculados y su smoke técnico de login/perfil fue 5/5.
- El responsable cerró el seguimiento de confirmaciones directas adicionales. La evidencia informada permanece 1/5 primeros accesos personales y 0/5 recuperaciones por email confirmadas; el cierre no equivale a 5/5 activaciones.
- No está autorizada otra alta, ampliación ni Pilot 01 masivo. No migrar contraseñas de V1.
- No hay política de retención aprobada ni purga automática. Las duraciones en `docs/DATA_RETENTION.md` son propuestas.
- Jorge fue designado temporalmente soporte, responsable técnico e Incident Commander solo para la ventana/lote inicial; no se presume suplente, horario o canal general.

## Decisiones que faltan antes de ampliar

| ID | Decisión institucional | Evidencia mínima para cerrar | Responsable por función | Estado |
| --- | --- | --- | --- | --- |
| G01 | Inventario de datos, minimización y finalidad por módulo; campos excluidos | Matriz versión/fecha, finalidad y aprobación de negocio/datos | Data Owner + Product Owner | PENDIENTE |
| G02 | Base institucional/legal, aviso al socio y consentimiento cuando corresponda | Texto aprobado y referencia restringida a aprobación competente | Dirección/Negocio + Privacidad/Legal | PENDIENTE |
| G03 | Verificación de email de contacto y tratamiento de cuentas sin email válido | Procedimiento aprobado que no permita redirigir códigos ni sustituir destinos | Identity Owner + Data Owner | PENDIENTE |
| G04 | Retención, reloj por categoría, excepciones y legal hold | Tabla de plazos aprobados y dueño; criterios DB/Storage/logs/backups | Data Owner + Privacidad/Legal + Security | PENDIENTE |
| G05 | Derechos/solicitudes de titulares | Canal, verificación, responsable, plazos internos, evidencia y escalamiento | Privacidad/Legal + Support Owner | PENDIENTE |
| G06 | Proveedores, encargados y ubicaciones/transferencias | Inventario revisado de Supabase, Cloudflare, Brevo, GitHub y demás proveedores usados | Data Owner + Privacidad/Legal | PENDIENTE |
| G07 | Soporte general y continuidad | Canal primario/alternativo, horario/zona, titular/suplente, severidades, comunicación masiva y repositorio restringido | Support Owner + Incident Commander | PENDIENTE |
| G08 | Incidente de privacidad/seguridad | Contacto responsable, canal restringido, escalamiento y criterio de comunicación | Security Owner + Privacidad/Legal | PENDIENTE |
| G09 | Borrado/anonimización | Procedimiento probado en copia aislada con dependencias, Storage, backups y rollback; doble aprobación antes de automatizar | Data Owner + DBA/Storage Owner + Legal/Security | PENDIENTE |
| G10 | Autorización de una futura cohorte | Tamaño, propósito, entorno, SHA, ventana, soporte y rollback en autorización explícita separada | Dirección/Negocio + responsable técnico | NO AUTORIZADA |

## Secuencia de cierre

1. Revisar y aprobar las decisiones G01–G09 mediante los responsables institucionales competentes; no inferir aprobación por el uso actual de la cohorte exacta.
2. Versionar solo políticas ya aprobadas, con fecha, versión y roles aprobadores; guardar nombres/contactos o evidencia identificable en el repositorio restringido, no en Git.
3. Revisar `docs/DATA_RETENTION.md` y `docs/PRODUCTION_SUPPORT_MODEL.md` contra esas decisiones y cambiar sus estados únicamente cuando exista evidencia.
4. Diseñar y probar por separado cualquier mecanismo técnico que resulte necesario. Hasta entonces, mantener desactivadas las purgas y no alterar cuentas, contactos ni historial del lote existente.
5. Para otra cohorte, completar G10 y requerir una autorización nueva y específica antes de dry-run o `--apply`; este documento no concede ese permiso.

## Registro de aprobación

Completar por decisión institucional, no por el equipo técnico:

| Campo | Registro |
| --- | --- |
| Versión aprobada | PENDIENTE |
| Fecha de decisión y vigencia | PENDIENTE |
| Roles aprobadores | PENDIENTE |
| Decisiones G01–G09 aceptadas/excluidas | PENDIENTE |
| Referencia restringida de evidencia | PENDIENTE |
| Excepciones y próxima revisión | PENDIENTE |

Mientras exista cualquier pendiente material de G01–G09, la operación permanece limitada al lote exacto ya autorizado. La decisión de cerrar las confirmaciones individuales no cambia este límite ni la evidencia agregada registrada en `docs/PROD_COHORT_ACTIVATION_TRACKER.md`.
