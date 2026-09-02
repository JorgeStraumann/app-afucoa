# Pilot 01 — incorporación controlada de socios V1

Estado: procedimiento preparado y validado con datos sintéticos. No se ejecutó una migración de socios reales.

Destino único permitido: `AFUCOA V2 DEV` (`imiplnspvmsrsuikulwm`). V1 es solo fuente de exportación y no se escribe; producción queda fuera de alcance.

## Garantías

- Lote limitado a 5–10 socios cuando se usa `--apply`.
- El modo predeterminado es `dry-run`; escribir requiere `--apply` y confirmar explícitamente el project ref DEV.
- La cédula se normaliza a ocho dígitos y valida con el dígito verificador uruguayo.
- Se rechazan cédulas, fichas y `migration_external_id` duplicados dentro del archivo.
- También se rechazan conflictos contra las restricciones únicas de `profiles`: cédula, ficha, `auth_user_id` y `(migration_source, migration_external_id)`.
- Cada perfil conserva `migration_source=v1` y un `migration_external_id` estable de V1.
- No se importa ninguna contraseña, hash ni pregunta de seguridad de V1.
- `supabase.auth.admin.createUser()` se ejecuta exclusivamente en el script Node server-side. La clave privilegiada se lee de `SUPABASE_SERVICE_ROLE_KEY`, nunca de una variable `VITE_*` ni del frontend.
- Auth usa el alias `<cedula>@auth.afucoa.local`, contraseña temporal aleatoria, `email_confirm: true` y `app_metadata` del lote.
- El informe general no contiene contraseñas. Las credenciales temporales nuevas se separan en un archivo privado ignorado por Git.
- Cada lote genera un journal suficiente para revertir perfiles y usuarios Auth creados por ese lote sin borrar historia de negocio.
- Una identidad histórica `inactivo`/`baja` sin Auth nunca se vuelve a vincular automáticamente: requiere revisión humana para impedir apropiaciones por cédula o ficha coincidente.

## Archivos

- `scripts/prepare-v1-members.mjs`: normaliza y rechaza filas antes de acceder a Supabase.
- `scripts/pilot-import-members.mjs`: preflight e importación idempotente server-side.
- `scripts/pilot-rollback.mjs`: plan y ejecución del rollback.
- `scripts/lib/pilot-members.mjs`: reglas puras de preparación, importación, idempotencia y rollback.
- `scripts/lib/pilot-cli.mjs`: guardas de destino DEV, secretos server-side y escritura atómica de reportes.
- `scripts/lib/pilot-supabase-adapter.mjs`: único adaptador que usa Auth Admin y consulta dependencias de `profiles`.
- `tests/pilot-import.test.mjs`: validación sintética de preparación, idempotencia, conflicto Auth y rollback.
- `tests/fixtures/pilot-v1-sample.csv`: fixture sin datos reales.

Todos los artefactos operativos se escriben en `pilot-output/`, que está ignorado por Git.

## Procedimiento

### 1. Exportar una muestra de V1

Seleccionar entre 5 y 10 socios con autorización para el piloto. Exportar solamente:

`cedula;ficha;nombre;apellido;email;telefono;sector;estado`

No exportar contraseñas, hashes, códigos de recuperación ni otros secretos de V1.

### 2. Preparar y revisar

```powershell
node scripts/prepare-v1-members.mjs .\entrada-v1.csv .\pilot-output\pilot01-normalizado.csv
```

Revisar:

- `pilot-output/pilot01-normalizado.csv`
- `pilot-output/pilot01-normalizado.csv.report.json`

No continuar si hay una cédula dudosa, una ficha duplicada o una identidad que no pueda confirmarse con V1.

### 3. Cargar secretos solo en el proceso servidor

```powershell
$env:SUPABASE_URL = 'https://imiplnspvmsrsuikulwm.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY = Read-Host 'Service role DEV' -MaskInput
```

No guardar la clave en `.env.local`, archivos `VITE_*`, capturas, tickets ni repositorio.

### 4. Ejecutar preflight idempotente

```powershell
node scripts/pilot-import-members.mjs `
  --input .\pilot-output\pilot01-normalizado.csv `
  --output-dir .\pilot-output `
  --confirm-project imiplnspvmsrsuikulwm
```

El reporte debe indicar `mode: dry-run`, cero cambios y cada fila como `ready`, `unchanged` o `rejected`.

### 5. Aplicar solamente después de aprobación

```powershell
node scripts/pilot-import-members.mjs `
  --input .\pilot-output\pilot01-normalizado.csv `
  --output-dir .\pilot-output `
  --confirm-project imiplnspvmsrsuikulwm `
  --apply
```

Se generan:

- `<batch>-report.json`: importados, sin cambios, rechazados, motivo, Auth creado y profile vinculado.
- `<batch>-rollback.json`: journal del lote, sin contraseñas.
- `<batch>-credentials.json`: solo nuevas contraseñas temporales; permisos de archivo restringidos cuando el sistema operativo lo admite.

Un segundo `--apply` sobre el mismo archivo usa el mismo `batch_id` derivado del contenido y debe devolver los perfiles ya vinculados como `unchanged`, sin crear duplicados.

### 6. Verificación del piloto

1. Confirmar que el reporte tiene entre 5 y 10 identidades aceptadas y ninguna contradicción.
2. Verificar en Supabase Auth el usuario y en `profiles` el mismo `auth_user_id`.
3. Confirmar `role=socio`, `migration_source=v1` y `migration_external_id` esperado.
4. Probar login, cambio inicial de contraseña/recuperación, Mi Cuenta, carné, biblioteca y un trámite con dos cuentas de muestra.
5. Ejecutar `tests/rls-live-check.mjs` y `tests/supabase-integration-live.mjs`.

### 7. Rollback

Primero generar el plan:

```powershell
node scripts/pilot-rollback.mjs --journal .\pilot-output\<batch>-rollback.json
```

Después de revisar IDs y acciones:

```powershell
node scripts/pilot-rollback.mjs `
  --journal .\pilot-output\<batch>-rollback.json `
  --confirm-project imiplnspvmsrsuikulwm `
  --apply
```

El rollback procesa el lote en orden inverso, valida que Auth conserve `pilot_batch_id` y consulta todas las FK actuales que apuntan a `profiles`:

- Si el profile fue creado por el lote y no tiene actividad, elimina el profile y el Auth creado por el lote. El reporte indica `deleted`.
- Si tiene trámites, propuestas, mensajes, archivos, eventos, auditoría, favoritos, notificaciones, dispositivos u otra dependencia, primero establece `auth_user_id=null` y `status=inactivo`; después elimina el Auth del lote. El profile y toda su trazabilidad permanecen. El reporte indica `deactivated_preserved_history` y enumera las dependencias encontradas.
- Si el lote vinculó un profile preexistente, restaura su vínculo anterior en vez de eliminarlo.

El orden de desactivación corta inmediatamente la asociación entre el JWT y `profiles`; esto protege la aplicación incluso durante el tiempo restante de un JWT ya emitido. El comando puede repetirse de forma idempotente: conserva el mismo resultado `deleted` o `deactivated_preserved_history` con `idempotent_replay=true` cuando corresponde.

Si Supabase no permite eliminar un Auth (por ejemplo, por propiedad de objetos de Storage), el perfil ya queda borrado o desvinculado/inactivo y por eso no conserva acceso funcional. El reporte incrementa `auth_delete_failed` y conserva el detalle para completar la limpieza server-side; no oculta el fallo.

Una reimportación posterior puede recrear limpiamente una identidad eliminada sin actividad. En cambio, un profile histórico preservado queda inactivo y sin Auth, y el importador lo rechaza con `perfil_historico_inactivo_requiere_revision`; tampoco acepta otra `migration_external_id` que coincida por cédula o ficha.

### 8. Cierre seguro

```powershell
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
Remove-Item Env:SUPABASE_URL
```

Entregar credenciales temporales por un canal separado y borrar el archivo local cuando ya no sea necesario. Conservar el reporte y journal según la política de auditoría de AFUCOA.

## Validación sintética realizada

- Fixture: 8 filas sin datos reales.
- Aceptadas: 5.
- Rechazadas: 3 (`cedula_invalida` y las dos filas implicadas en una `cedula_duplicada_en_archivo`).
- Pruebas: creación simulada, segundo intento idempotente, rechazo de email Auth ajeno, rollback repetible sin actividad, reimportación limpia y rollback preservando un socio con trámite y propuesta.
- Se verifica que el profile con historia se desactive antes de borrar Auth, que el segundo rollback sea idempotente y que ninguna reimportación pueda apropiarse de esa identidad histórica.
- Resultado actual de la suite sintética: 6/6 tests aprobados.
- No se creó ningún usuario Auth real ni perfil real durante esta validación.

## Recuperación ante interrupciones

El journal se actualiza de forma atómica después de cada identidad. Si el proceso se interrumpe, conservar los tres archivos del lote y ejecutar nuevamente el mismo comando: el `app_metadata` de Auth y las claves únicas permiten reanudar sin duplicar. Si la interrupción ocurre en la ventana entre crear Auth y escribir el profile, el siguiente intento reutiliza únicamente ese Auth cuando `migration_source`, `migration_external_id` y `pilot_batch_id` coinciden; cualquier otro usuario con el mismo alias se rechaza.
