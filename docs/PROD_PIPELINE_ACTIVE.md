# AFUCOA V2 — pipeline PROD activo

Estado: Fase 3E implementada y validada mediante promoción, rollback y restauración reales. B07 **CLOSED**.

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

La retención configurada es 30 días para el artifact de release y 90 días para evidencia pública de deploy/rollback.

## Evidencia controlada — 5 de septiembre de 2026

| Operación | Evidencia |
| --- | --- |
| Promoción aprobada | Workflow `AFUCOA V2 production` run `34002807860`, con aprobación registrada de `JorgeStraumann` |
| Release SHA | `f9d8c15883341ee9a95581e88f24d67a90d821af` |
| Artifact | `afucoa-v2-prod-f9d8c15883341ee9a95581e88f24d67a90d821af`; digest GitHub `sha256:fb586a3bab9b1a9a820268343110959128ccb0f3df10b44a07c20293657f71fc` |
| Manifest SHA-256 | `2fa0172e9e974bf1803942d2ed4410f6bdc062c68bd098674686d5ed819e9cab` |
| Deployment aprobado | `cfeaedf7-21d1-4cbb-96bf-b9cb6065ef16` |
| Smoke post-deploy | PASS; bytes del manifest, origin canónico, headers, worker y backend PROD; login no intentado |
| Rollback real | Workflow run `34003066262` hacia `f7645b3e-61e9-4fb8-b513-f1b741accbc7`, release `63140a03654386f18b0e4d1198dc7ea3c20b5bb7` |
| Smoke tras rollback | PASS; target validado como production/success; rebuild no; artifact nuevo no |
| Restauración real | Workflow run `34003124433` hacia `cfeaedf7-21d1-4cbb-96bf-b9cb6065ef16` |
| Smoke tras restauración | PASS; release restaurado `f9d8c15883341ee9a95581e88f24d67a90d821af`; rebuild no; artifact nuevo no |

La primera ejecución operativa reveló que Cloudflare normaliza `/index.html` hacia `/`. El smoke se corrigió para verificar los bytes exactos de `index.html` mediante la respuesta canónica `/`, sin relajar la prohibición de redirects. También usa timeout y reintentos acotados por recurso con diagnóstico que no expone query strings ni credenciales.

La secuencia real demostró exact SHA, build único previo a approval, artifact inmutable, acceso al token únicamente después del Environment, deploy sin rebuild, smoke, rollback oficial y restauración. B07 queda **CLOSED**. Esto no habilita usuarios reales ni cierra B02–B05/B08–B10.
