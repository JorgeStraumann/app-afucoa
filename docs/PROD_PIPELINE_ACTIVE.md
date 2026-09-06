# AFUCOA V2 — pipeline PROD activo

Estado: Fase 3E implementada; validación controlada pendiente al momento de este commit.

## Alcance fijo

| Componente | Valor público |
| --- | --- |
| Rama fuente | `afucoa-v2` |
| Supabase PROD | `rywdochyzhgfaymrmxek` |
| Cloudflare Pages | `afucoa-v2-prod` |
| Origin canónico | `https://afucoa-v2-prod.pages.dev` |
| GitHub Environment | `production` |
| Revisor requerido | `JorgeStraumann` |
| Self-review | Permitido temporalmente por operación unipersonal |
| Concurrencia | `afucoa-v2-production`, sin cancelación automática |

`main` no es fuente ni destino de este pipeline. El frontend no despliega Edge Functions, migraciones, Auth, secrets Supabase ni datos.

## Arquitectura prepare → aprobación → deploy

El workflow `.github/workflows/afucoa-v2-production.yml` solo admite `workflow_dispatch` y exige un `release_sha` hexadecimal completo de 40 caracteres. `prepare` comprueba que el SHA exacto es ancestro de `origin/afucoa-v2`, que el checkout está limpio, que no se usa una referencia móvil y que la configuración corresponde exclusivamente a PROD.

`prepare` no referencia el Environment `production` ni `CLOUDFLARE_API_TOKEN`. Ejecuta los gates de migraciones, operaciones, hosting, artefacto, Edge config, recovery, push, sesión y navegación; después construye una sola vez el dist PROD real. El release manifest enumera cada archivo y SHA-256. El árbol `dist`, el manifest y su hash se suben como un artifact inmutable del run.

El job `deploy` depende de `prepare` y declara `environment: production`; GitHub lo detiene antes de entregar el secret. Tras la aprobación descarga exactamente el artifact preparado, vuelve a verificar árbol, tamaños, hashes, SHA y project ref, y no ejecuta ningún build. Wrangler está fijado en `4.34.0` y despliega esos bytes como Production, rama Cloudflare `afucoa-v2`, asociados al SHA aprobado.

El post-deploy smoke confirma bytes públicos contra el manifest, HTTPS, HTTP 200, HSTS, CSP, headers, caché, manifest, `push-sw.js`, `Service-Worker-Allowed`, ausencia de `noindex`, refs DEV/staging, sourcemaps y material privilegiado. También comprueba de forma anónima/read-only que Auth settings de Supabase PROD responde; no inicia sesión.

## Configuración GitHub

Secret del Environment, cuyo valor nunca se documenta:

- `CLOUDFLARE_API_TOKEN`: API Token acotado a Cloudflare Pages Write/Edit; no Global API Key.

Variables del Environment:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT`
- `AFUCOA_PROD_ORIGIN`
- `AFUCOA_PROD_SUPABASE_URL`

Variable pública de repositorio, necesaria antes del approval:

- `AFUCOA_PROD_PUBLISHABLE_KEY`

No existe ningún secret `VITE_*`; la publishable key no es privilegiada. Los jobs usan `permissions: contents: read` y todas las acciones se fijan a commit SHA completo.

## Rollback

`.github/workflows/afucoa-v2-production-rollback.yml` solo admite `workflow_dispatch` con un `deployment_id` UUID. Usa el mismo Environment y mutex. Antes del POST consulta el deployment dentro de `afucoa-v2-prod` y exige `environment=production`, `latest_stage.status=success` y branch `afucoa-v2`; un Preview o un deployment fallido queda rechazado.

El rollback llama al endpoint oficial `POST /accounts/{account_id}/pages/projects/{project_name}/deployments/{deployment_id}/rollback`. No recompila ni crea un artefacto de aplicación. Luego ejecuta el smoke público read-only y conserva evidencia JSON sin secretos.

## Operación y segregación de funciones

El único operador actual también es el revisor requerido, por lo que `prevent_self_review=false`. Esto añade una pausa explícita y auditada, pero no constituye separación real de funciones. Cuando exista una segunda persona autorizada se debe agregarla como reviewer, activar `Prevent self-review`, probar una promoción y un rollback con aprobación cruzada y actualizar este documento.

La retención configurada es 30 días para el artifact de release y 90 días para evidencia pública de deploy/rollback. Los identificadores de ejecución, deployment, release y manifest se registrarán aquí después de la prueba controlada.

## Evidencia controlada

Pendiente: primera promoción mediante el workflow, aprobación humana observada, smoke, rollback a un Production anterior y restauración al release aprobado. Hasta completar esa secuencia B07 permanece **PARTIAL**.
