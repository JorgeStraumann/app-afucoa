# AFUCOA V2 — arquitectura de hosting de producción

Estado: arquitectura y políticas versionadas; no existe proveedor, dominio, DNS, workflow PROD ni despliegue configurado.

## Arquitectura objetivo

Staging permanece en GitHub Pages desde `afucoa-v2`, con base `/app-afucoa/` y Supabase DEV. PROD será un frontend estático HTTPS separado, con origin canónico, Supabase PROD y base pública explícitos. El service worker debe servirse desde el mismo origin y con scope limitado exactamente a la base del frontend.

`AFUCOA_PROD_ORIGIN` es una variable conceptual del pipeline, smoke tests y runbooks. No se agrega a Vite ni al bundle porque el frontend puede derivar su propio origin. `connect-src` recibe por separado el origin Supabase PROD durante la materialización de la política.

La unidad de promoción es un artefacto inmutable asociado a un SHA de 40 caracteres y a su release manifest. Una branch móvil nunca identifica un release. El generador rechaza un working tree sucio. El job que despliega descarga el artefacto aprobado; no recompila.

## Requisitos del proveedor

- custom domain y HTTPS automático;
- headers de seguridad y caché configurables por path;
- SPA/hash routing, PWA, manifest y Service Worker compatibles;
- deploy de artefacto inmutable, historial y rollback rápido;
- integración GitHub protegible y aprobación separada de staging;
- concurrencia de producción serializada;
- ningún secreto backend requerido en el frontend;
- disponibilidad razonable y logs suficientes para incidentes.

## Matriz de alternativas

| Proveedor | Encaje AFUCOA | Observación |
| --- | --- | --- |
| GitHub Pages | Parcial | Custom domain y HTTPS son adecuados para staging, pero no ofrece el control versionable por path de headers/caché requerido para la política PROD. No se recomienda como destino final. |
| Cloudflare Pages | Alto — recomendado | Permite headers estáticos versionados, custom domains, CDN y rollback de deployments. Buen ajuste para una PWA estática con poco componente operativo. Confirmar plan, retención de logs y proceso de aprobación al provisionar. |
| Vercel | Alto | Headers configurables, deployments inmutables y rollback. Cumple técnicamente; comparar límites, logs y gobierno del plan elegido. |
| Netlify | Alto | Headers por archivo, deploys atómicos e historial/restore. Cumple técnicamente; comparar límites, logs y control de aprobaciones. |

Recomendación técnica: **Cloudflare Pages**, por la combinación de headers/caché versionables, rollback, CDN y simplicidad para contenido estático. Es una recomendación de arquitectura, no una contratación ni una selección comercial definitiva.

Documentación consultada: [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/), [Cloudflare rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/), [Vercel headers](https://vercel.com/docs/project-configuration/vercel-json#headers), [Vercel instant rollback](https://vercel.com/docs/deployments/instant-rollback), [Netlify headers](https://docs.netlify.com/manage/routing/headers/), [Netlify deploys](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/) y [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages).

## Security headers y CSP

La política canónica está en `config/production-security-headers.json`. Es una plantilla PROD-only; HSTS no se aplica en staging.

La auditoría no encontró estilos inline ni mutaciones `element.style`. Vite genera CSS externo y el QR se dibuja en canvas, por lo que `style-src 'self'` e `img-src 'self'` son compatibles y no existe excepción `unsafe-inline`. Tampoco se necesita `unsafe-eval`, `data:` o `blob:` actualmente.

CSP objetivo:

```text
default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self' {{SUPABASE_PROD_ORIGIN}}; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests
```

Se agrega HSTS por un año con subdominios, `nosniff`, `no-referrer`, Permissions Policy restrictiva y `X-Frame-Options: DENY`. `frame-ancestors 'none'` es la protección primaria contra framing. HSTS debe activarse solo después de verificar HTTPS real y control de subdominios; no se solicita preload en esta fase.

## Política de caché

| Recurso | Política |
| --- | --- |
| shell e `index.html` | `no-cache, no-store, must-revalidate` |
| `push-sw.js` | `no-cache, no-store, must-revalidate`; scope explícito mediante `Service-Worker-Allowed` |
| `manifest.webmanifest` | `public, max-age=0, must-revalidate` |
| assets con hash | `public, max-age=31536000, immutable` |

Solo archivos realmente content-hashed pueden recibir `immutable`. El HTML y el worker deben revalidarse para que deploy y rollback lleguen rápido y no quede retenido un worker anterior.

## Promoción futura

`commit aprobado → CI completo → SHA congelado → build PROD → validación de artefacto/hosting → release manifest → aprobación humana → deploy del artefacto sin recompilar → smoke tests → release exitoso`.

El diseño no ejecutable está en `ops/templates/afucoa-v2-production-workflow.yml`. El workflow PROD real se creará únicamente después de seleccionar proveedor, dominio, environments y protecciones.

## Threat check

| Riesgo | Control preventivo | Detección | Respuesta |
| --- | --- | --- | --- |
| Subir el `dist` equivocado | Artefacto nombrado por SHA y manifest; job deploy sin build | Comparar hashes antes/depués | Detener deploy y restaurar último manifest aprobado |
| Contaminación DEV→PROD | Validadores fail-closed de URL/base/origin/secrets | `test:prod-artifact` y búsqueda de marcadores DEV | Rechazar candidato, corregir configuración y reconstruir |
| Service Worker viejo | Worker sin caché y scope/base explícitos | Smoke de versión/registro en navegador limpio y existente | Rollback/redeploy, invalidar CDN y guiar actualización del worker |
| CSP permisiva | Policy canónica sin wildcards/unsafe | `test:prod-hosting` y verificación de headers HTTPS | Bloquear promoción; aplicar forward-fix de policy |
| Source maps expuestos | Vite `sourcemap:false` y scanner recursivo | Conteo de `.map` en artefacto publicado | Retirar deployment y rotar cualquier dato expuesto |
| Secretos en bundle | Solo publishable key; scanner de patrones privilegiados | CI y revisión del artefacto | Retirar, revocar/rotar secreto y hacer análisis de incidente |
| Takeover o DNS incorrecto | Dueño DNS, registros mínimos y dominio verificado | Monitoreo DNS/TLS y prueba periódica | Retirar registro vulnerable, recuperar dominio y rotar validaciones |
| Deploy sin aprobación | Environment protegido y gate humano | Audit log de deployment | Rollback y revisión de permisos/proceso |
| Rollback no verificado | Solo artifacts previos con manifest/hash | Verificación de hash y smoke del rollback | Cancelar restauración y usar último release conocido |
| Deploys concurrentes | Concurrency PROD sin cancelación automática | Alertar operaciones simultáneas | Serializar, cancelar candidato más nuevo y verificar estado |
| Pérdida de trazabilidad SHA | SHA completo, manifest, tag/release inmutable | Comparar HEAD, manifest y deployment ID | Marcar deployment inválido y restaurar release trazable |

La aplicación sigue sin estar lista para producción: faltan proveedor/dominio reales, aplicación de headers sobre HTTPS, workflow activo protegido y validación E2E PROD.
