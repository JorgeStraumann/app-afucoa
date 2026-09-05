# AFUCOA V2 — cadena canónica de migraciones

Fecha de reconstrucción: 5 de septiembre de 2026

Rama: `afucoa-v2`

Proyecto usado como evidencia: `AFUCOA V2 DEV` (`imiplnspvmsrsuikulwm`)

Acceso a DEV: exclusivamente consultas `READ ONLY`

## Estado

La cadena local contiene las **17/17 versiones y nombres** registrados en `supabase_migrations.schema_migrations` de DEV. El SQL normalizado de cada archivo coincide con el `statements[1]` histórico y está fijado por SHA-256 en `supabase/migrations/MANIFEST.json`.

La reconstrucción de una base Supabase vacía permanece pendiente: en este equipo no están disponibles Supabase CLI, Docker ni Podman. No se creó ni improvisó un proyecto remoto para sustituir esa prueba. En consecuencia, B01 está **PARCIAL**, no cerrado.

## Fuente y método

Se consultaron `version`, `name`, `statements`, `idempotency_key` y `rollback` dentro de transacciones `BEGIN TRANSACTION READ ONLY`. Las 17 filas registran un solo elemento en `statements[]`, sin `idempotency_key` ni `rollback`.

Los archivos se reconstruyeron desde ese elemento, sin modernizar, reordenar ni mejorar el SQL. La única normalización aplicada fue:

1. convertir CRLF y CR a LF;
2. retirar exclusivamente saltos de línea terminales;
3. añadir exactamente un LF final;
4. codificar como UTF-8 y calcular SHA-256.

Por esa normalización se demuestra igualdad del SQL preservando todo carácter no terminal, pero no se afirma igualdad byte-a-byte con la representación interna de Supabase.

## Cadena verificada

| # | Versión | Nombre | SQL local vs DEV |
| ---: | --- | --- | --- |
| 1 | `20260901012911` | `afucoa_v2_schema` | SHA-256 normalizado coincide |
| 2 | `20260901013024` | `afucoa_v2_security_core_fixed` | SHA-256 normalizado coincide |
| 3 | `20260901013043` | `afucoa_v2_security_rls_part1` | SHA-256 normalizado coincide |
| 4 | `20260901013059` | `afucoa_v2_security_rls_part2` | SHA-256 normalizado coincide |
| 5 | `20260901013115` | `afucoa_v2_storage` | SHA-256 normalizado coincide |
| 6 | `20260901013137` | `afucoa_v2_admin_backend` | SHA-256 normalizado coincide |
| 7 | `20260901013205` | `afucoa_v2_security_hardening_01` | SHA-256 normalizado coincide |
| 8 | `20260901013226` | `afucoa_v2_performance_hardening_01` | SHA-256 normalizado coincide |
| 9 | `20260901020856` | `list_visible_proposals` | SHA-256 normalizado coincide |
| 10 | `20260901021400` | `fix_membership_token_ambiguity` | SHA-256 normalizado coincide |
| 11 | `20260902013551` | `profiles_id_default_uuid` | SHA-256 normalizado coincide |
| 12 | `20260903200438` | `secure_password_recovery` | SHA-256 normalizado coincide |
| 13 | `20260904001121` | `recovery_concurrency_hardening` | SHA-256 normalizado coincide |
| 14 | `20260904002017` | `recovery_lock_clock` | SHA-256 normalizado coincide |
| 15 | `20260904023548` | `web_push_dev` | SHA-256 normalizado coincide |
| 16 | `20260904024725` | `web_push_active_device_limit` | SHA-256 normalizado coincide |
| 17 | `20260905002735` | `reconcile_existing_push_subscription` | SHA-256 normalizado coincide |

Los hashes completos están en `supabase/migrations/MANIFEST.json`. `pnpm test:migrations` comprueba cantidad, orden ascendente, unicidad, versión/nombre/archivo, ausencia de versiones obsoletas y los 17 hashes.

## Diferencias corregidas

- Faltaban las ocho migraciones iniciales `20260901012911` a `20260901013226`; se recuperaron desde sus `statements[]`.
- `202608310001_list_visible_proposals.sql` tenía el mismo hash SQL que el statement canónico, pero una versión histórica incorrecta. Se reemplazó por `20260901020856_list_visible_proposals.sql`.
- `202608310002_fix_membership_token_ambiguity.sql` tenía el mismo hash SQL que el statement canónico, pero una versión histórica incorrecta. Se reemplazó por `20260901021400_fix_membership_token_ambiguity.sql`.
- `20260902013551_profiles_id_default_uuid.sql` era semánticamente igual, pero el statement local estaba partido en dos líneas. Se restauró la representación histórica de una línea.
- `20260904024725_web_push_active_device_limit.sql` incluía dos comentarios locales que no estaban en el statement registrado. Se restauró el statement histórico sin esos comentarios.
- Las otras cinco migraciones que ya estaban versionadas coincidían con DEV bajo la normalización documentada.

No quedaron diferencias de SQL normalizado entre los 17 archivos locales y DEV. La comparación de **estructuras resultantes** local vs DEV todavía no se pudo ejecutar porque falta el entorno local.

## Storage

La migración canónica `20260901013115_afucoa_v2_storage.sql` crea/configura:

- `request-files`: privado, 10 MB, PDF/JPEG/PNG;
- `documents-private`: privado, 20 MB, PDF;
- `public-media`: público, 10 MB, JPEG/PNG/WebP;
- las políticas de acceso correspondientes sobre `storage.objects`.

El check estático exige los tres buckets y falla si la migración intenta insertar o copiar objetos en `storage.objects`. La cadena no contiene objetos ni fixtures DEV.

## Fresh-db pendiente

Cuando Supabase CLI y Docker estén disponibles, ejecutar en un entorno local no enlazado a proyecto remoto:

1. verificar las opciones vigentes con `supabase --help`, `supabase start --help` y `supabase db reset --help`;
2. iniciar el stack local y aplicar las 17 migraciones desde cero;
3. confirmar que no se omite ni reordena ninguna versión;
4. comparar local vs DEV, sin datos, para tablas/columnas/defaults, enums, PK/FK/unique/check, índices, RLS, policies, funciones/RPC, `SECURITY DEFINER`, grants, buckets y policies de Storage;
5. detener/eliminar solamente el entorno local desechable;
6. registrar versión de CLI/Postgres, comandos, resultado y diferencias.

Solo después de una ejecución limpia y una comparación estructural aceptada puede B01 pasar de `PARCIAL` a `CLOSED`.

## Reglas para migraciones futuras

- Crear el archivo con `supabase migration new <nombre>` usando la CLI vigente; no inventar versiones manualmente.
- Una migración aplicada es inmutable. Las correcciones se agregan en una migración posterior.
- No ejecutar cambios manuales remotos fuera de la cadena. Si ocurre una emergencia, reconciliarla inmediatamente mediante una migración revisada.
- Actualizar `MANIFEST.json` solo después de revisar el SQL definitivo y calcular su hash normalizado.
- Ejecutar `pnpm test:migrations` en cada PR y antes de staging; la suite está incorporada a `pnpm test:staging`.
- Añadir a CI una prueba fresh-db cuando el runner disponga de Docker; el control de checksums no sustituye aplicar el SQL.
- No incluir usuarios, contraseñas, objetos Storage, fixtures DEV/Beta, secretos ni datos reales.
- Nunca usar `db reset`, `repair` o `push` contra DEV/PROD como parte del check local.
