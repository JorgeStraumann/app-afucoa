# AFUCOA V2 — Preflight de cohorte productiva inicial

Estado: **APPLY COMPLETADO — 5 SOCIOS INICIALES ACTIVOS**

Proyecto permitido: Supabase PROD `rywdochyzhgfaymrmxek`

La decisión B10 del 30 de septiembre de 2026 autoriza preparar una cohorte inicial de hasta cinco socios y consultar conflictos de identidad contra PROD. No autoriza crear usuarios Auth, perfiles, contraseñas, datos de negocio ni ejecutar Pilot 01 masivo.

## Garantías del procedimiento

- `scripts/prod-cohort-dry-run.mjs` no implementa `--apply`;
- el destino y la confirmación deben coincidir exactamente con PROD;
- el lote se rechaza si supera cinco filas;
- solo admite una Supabase Secret API Key moderna, server-side y temporal;
- no acepta ni publica una legacy `service_role`;
- no usa variables `VITE_*` privilegiadas;
- la salida de consola contiene solo conteos, hash y ruta local;
- el reporte detallado permanece en un directorio local privado y no se versiona;
- cualquier rechazo o conflicto detiene el proceso sin corrección automática.

## Ejecución autorizada

El wrapper obtiene la clave mediante la sesión autenticada de Supabase CLI y la conserva únicamente en memoria durante el proceso:

```powershell
.\scripts\run-prod-cohort-dry-run.ps1 -InputPath <archivo-local-autorizado.csv>
```

El resultado válido para solicitar una autorización posterior es `5 ready`, `0 rejected` y `0 conflicts`. Incluso con ese resultado, `--apply` permanece prohibido hasta una nueva autorización explícita que identifique el lote, SHA, ventana y rollback.

## Resultado ejecutado

Fecha/hora: **2026-09-30 21:10, America/Montevideo**

| Campo | Resultado |
| --- | --- |
| Project ref | `rywdochyzhgfaymrmxek` |
| Batch | `prod-cohort-3a15c4d1272f` |
| Hash SHA-256 del archivo local | `3a15c4d1272f995bd9a1b5de4828fe9d0d9f35b98f2404ce67daa5a601d4fff7` |
| Filas | `5` |
| Ready | `5` |
| Unchanged | `0` |
| Rejected | `0` |
| Conflictos profile/Auth | `0 / 0` |
| Cambios aplicados | **NO** |

El reporte detallado quedó fuera de Git en `%LOCALAPPDATA%\AFUCOA\prod-cohort\prod-cohort-3a15c4d1272f-dry-run-report.json`. Se verificó que no contiene credenciales, rollback, Secret API Key ni contraseña temporal. Una consulta independiente posterior confirmó `auth.users=0` y `public.profiles=0` en PROD.

Resultado: **DRY-RUN APROBADO; DETENERSE ANTES DE `--apply`**.

## Autorización posterior de alta

El responsable autorizó explícitamente en la tarea del proyecto ejecutar `--apply` del lote `prod-cohort-3a15c4d1272f` sobre PROD, limitado a los cinco socios del dry-run aprobado. El ejecutor versionado exige nuevamente project ref, batch, hash, cinco filas válidas, preflight inmediato sin conflictos y working tree limpio. Genera reporte, journal y credenciales en el directorio privado local; si detecta un resultado parcial intenta rollback automático y se detiene.

## Resultado de `--apply`

Fecha/hora: **2026-09-30 21:27, America/Montevideo**

| Control | Resultado |
| --- | --- |
| Auth creados | `5` |
| Profiles creados y vinculados | `5` |
| Rol/estado | `5 socio / 5 activo` |
| Rechazados | `0` |
| Conflictos | `0` |
| Trazabilidad Auth/profile | `5/5` consistente |
| Postcheck idempotente | `5 unchanged`, `0 rejected`, `0 conflicts` |
| Smoke de login | `5/5` |
| `get_my_profile` | `5/5` |
| Cleanup de sesiones de prueba | `5` logout local, `0` logout global |
| Rollback automático requerido | **NO** |

Los archivos de credenciales, reporte y rollback quedaron fuera de Git en `%LOCALAPPDATA%\AFUCOA\prod-cohort\`. El archivo de credenciales contiene exactamente cinco contraseñas temporales seguras; sus valores no se imprimieron, documentaron ni enviaron a GitHub. El journal conserva cinco entradas de rollback.

Resultado: **COHORTE INICIAL CREADA Y VERIFICADA**. No se autoriza incorporar otra persona ni ejecutar Pilot 01 masivo.
