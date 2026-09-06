# AFUCOA V2 — Restore drill PROD 2026-09-06

Estado: **RESTORE FÍSICO REAL EJECUTADO Y VALIDADO EN DESTINO AISLADO; CLEANUP COMPLETO.**

AFUCOA V2 no queda habilitada para producción por este ejercicio. El drill cerró la validación del backup administrado, la restauración física y el mecanismo de bytes de Storage, pero el control adicional de dump lógico quedó pendiente porque el runner disponible no tenía Docker ni `pg_dump`. Por ese pendiente explícito, B08 queda **PARTIAL**.

## Alcance y fuente

- Origen: Supabase PROD `rywdochyzhgfaymrmxek`, organización `AFUCOA PROD`, región `sa-east-1`, plan Pro.
- Backup usado: ID operativo `1590155357`, físico, `COMPLETED`, timestamp `2026-09-06T03:15:00.292Z`.
- Otro backup visible: `2026-09-05T20:36:09.972Z`, físico, `COMPLETED`.
- Estado del servicio: backups diarios administrados, WAL-G activo, PITR deshabilitado. No se contrató PITR ni add-on alguno.
- Retención de referencia del plan Pro: siete días de backups diarios según la documentación oficial. Debe verificarse en cada drill porque plan y política del proveedor pueden cambiar.
- Método real: **Restore to new project**, soportado por Supabase, a un proyecto temporal independiente en la misma organización y región.
- Los backups de base incluyen metadata de Storage, no los bytes de los objetos. Los bytes se probaron por un mecanismo separado.

## Destino temporal y costo

| Campo | Evidencia |
| --- | --- |
| Proyecto temporal | `AFUCOA V2 PROD RESTORE DRILL 20260906` (`pgpgyjafphfevhvjdgwt`) |
| Organización / región | `AFUCOA PROD` / `sa-east-1` |
| Compute / disco mostrados | USD 9,68/mes / USD 0 |
| Facturación aceptada | por hora; mínimo estimado informado para menos de una hora: USD 0,01344 |
| PITR / add-ons | no activados |
| Creación del recurso | `2026-09-06T16:57:34.460655Z` |
| Inicio de restore registrado | `2026-09-06T16:57:47Z` |
| Proyecto `ACTIVE_HEALTHY` observado | `2026-09-06T17:02:19.666Z` |
| Fin de validación | `2026-09-06T17:10:21.589Z` |
| Eliminación confirmada | `2026-09-06T17:10:41.866Z` |

El cargo final depende de la factura del proveedor; la evidencia disponible permite reportar el mínimo horario estimado aceptado, no inventar un importe liquidado. Después de la eliminación, la organización volvió a mostrar un único proyecto —PROD— y **cero proyectos temporales facturables**.

## RPO y RTO observados

| Métrica | Objetivo aprobado | Observado | Resultado |
| --- | ---: | ---: | --- |
| RPO Database/Auth | 24 h | 13 h 42 min 46,708 s entre el backup y el inicio del restore | PASS |
| Restore físico | incluido en RTO | 4 min 32,666 s hasta observar `ACTIVE_HEALTHY` | PASS |
| RTO Database/Auth | 8 h | 12 min 34,589 s hasta finalizar validación | PASS |
| RTO Storage | 12 h | 12 min 34,589 s, incluido export/delete/restore/checksum sintético | PASS |

El RPO se mide contra el timestamp del backup realmente restaurado. El RTO termina cuando los controles estructurales y de Storage quedan aprobados, no cuando el proyecto apenas inicia.

## Integridad restaurada

Las consultas fueron de catálogo/conteo. No se leyeron ni registraron secretos, passwords, endpoints push ni PII.

| Control | PROD | Restore | Resultado |
| --- | ---: | ---: | --- |
| Migraciones | 17 | 17, mismas versiones y orden | PASS |
| Tablas `public` | 28 | 28 | PASS |
| Tablas `public` con RLS | 28 | 28 | PASS |
| Policies `public` / Storage | 46 / 11 | 46 / 11 | PASS |
| Funciones `public` / `SECURITY DEFINER` | 26 / 17 | 26 / 17 | PASS |
| Triggers / índices / grants | 23 / 83 / 721 | 23 / 83 / 721 | PASS |
| Enum types / extensiones | 6 / 5 | 6 / 5 | PASS |
| Buckets / objetos | 3 / 0 | 3 / 0 antes del drill sintético | PASS |
| Auth users / profiles | 0 / 0 | 0 / 0 | PASS |
| `app_settings` técnica | 1 fila | 1 fila | PASS |
| Edge Functions de plataforma | 0 | 0 | PASS |

También coincidieron SHA-256 de columnas, constraints, índices, policies, funciones, triggers, grants, enums, extensiones, migraciones, configuración de buckets y la fila técnica de `app_settings`. Los 28 conteos exactos de tablas coincidieron; todas estaban vacías salvo la única fila técnica de `app_settings`. No apareció ningún dato real inesperado.

## Manifest Storage PROD

Estado read-only confirmado en PROD:

| Bucket | Público | Límite | MIME permitidos | Objetos |
| --- | --- | ---: | --- | ---: |
| `documents-private` | no | 20 MiB | `application/pdf` | 0 |
| `public-media` | sí | 10 MiB | `image/jpeg`, `image/png`, `image/webp` | 0 |
| `request-files` | no | 10 MiB | `application/pdf`, `image/jpeg`, `image/png` | 0 |

- SHA-256 del inventario vacío de objetos: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- SHA-256 de la configuración canónica de los tres buckets: `5d5aeff57afd0c23457103ba83ecf0a6b7f03da4b62eba893d3a855f3d02d21e`.
- No se insertó ningún archivo en PROD.

Cuando existan bytes reales, el job de backup debe enumerar los objetos con credencial server-side de alcance mínimo, descargar a almacenamiento temporal cifrado, calcular SHA-256, registrar un manifest privado versionado, copiar a destino off-site con retención aprobada y borrar el staging temporal. La evidencia pública solo debe contener conteos y hashes agregados; paths, nombres, signed URLs y metadatos personales permanecen restringidos. El restore se hace primero en un destino aislado y compara cada byte contra el manifest.

## Drill sintético de bytes Storage

Se usaron solo objetos sintéticos pequeños dentro del proyecto temporal:

| Tipo | Bytes | SHA-256 antes y después |
| --- | ---: | --- |
| PDF | 137 | `9423ab3f4eaa76bd96db5b7db6cb7081311d6bda98c1463d4d752a6caf10df80` |
| PNG | 68 | `431ced6916a2a21a156e38701afe55bbd7f88969fbbfc56d7fe099d47f265460` |
| JPEG | 22 | `d20f6ffd523b78a86cd2f916fa34af5d1918d75f7b142237c752ad6b254213ab` |

Secuencia validada: upload con MIME permitido → export → SHA-256 → eliminación remota → restore desde export → descarga → comparación byte a byte. Un `text/plain` en `documents-private` fue rechazado con `415 invalid_mime_type`; el objeto público respondió `200` y el objeto privado rechazó acceso anónimo (`400`). Al terminar, los tres objetos fueron eliminados y `storage.objects = 0`.

## Dump lógico adicional

`supabase db dump --linked` se intentó contra PROD sin imprimir el contenido del comando ni sus credenciales temporales. La CLI oficial no pudo ejecutar `pg_dump` porque este runner no tiene Docker ni cliente PostgreSQL y la fase prohíbe instalar infraestructura pesada para el ejercicio.

- Resultado: **NO GENERADO**.
- SHA-256: **N/A**.
- Archivo residual: ninguno.
- Pendiente exacto para B08: ejecutar `supabase db dump` desde un runner controlado que ya disponga de Docker/PostgreSQL, cubrir `public`, metadata relevante de `auth` y `storage`, validar el artefacto, calcular SHA-256 y destruirlo o moverlo a un destino cifrado aprobado.

La restauración física administrada sí fue real y exitosa; el faltante lógico no se presenta como éxito ni se reemplaza con un inventario de catálogo.

## Seguridad, no impacto y cleanup

- PROD terminó intacto: 17 migraciones, 0 Auth users, 0 profiles, 0 objetos Storage y 0 Edge Functions.
- No se crearon usuarios, perfiles ni datos de negocio; Pilot 01 continúa `PARKED`.
- No se tocaron DEV, V1, `main`, DNS, Auth settings, secrets, Edge Functions ni hosting.
- No hubo signed URLs persistentes, payloads push, claves privadas ni contraseñas en documentación/artifacts/Git.
- Los archivos sintéticos y cualquier path de dump temporal se eliminaron del equipo.
- El proyecto temporal fue eliminado y la organización confirmó 0 recursos temporales facturables activos.

Excepción de auditoría: un precheck previo con `supabase db dump --dry-run` mostró una password efímera del rol administrado `cli_login_postgres` en la salida privada de la tarea. No fue copiada a archivos, Git, artifacts ni logs públicos; no era una DB password permanente, `service_role` ni otra clave de aplicación. Las siguientes inicializaciones oficiales de la CLI rotaron esa credencial, por lo que el valor mostrado dejó de ser válido. No se repitió el modo que la exponía y ninguna credencial activa quedó publicada. La excepción permanece documentada sin su valor.

## Dictamen

Los objetivos RPO/RTO y el restore físico/Storage cumplen. B08 permanece **PARTIAL** por el dump lógico adicional no generado; no debe reclasificarse a `CLOSED` hasta completar ese control en un runner aprobado y revisar nuevamente el criterio de logs. AFUCOA V2 continúa no habilitada para producción.

Referencias: [Supabase — Database Backups](https://supabase.com/docs/guides/platform/backups), [Supabase — Restore to a New Project](https://supabase.com/docs/guides/platform/clone-project) y [Supabase — Compute costs](https://supabase.com/docs/guides/platform/manage-your-usage/compute).
