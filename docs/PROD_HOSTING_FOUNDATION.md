# AFUCOA V2 — Cloudflare Pages PROD hosting foundation

Fecha de validación: 5 de septiembre de 2026 (America/Montevideo)

Estado anterior: **FOUNDATION / TEMPORARY HOSTNAME**. Estado actual: **ORIGIN CANÓNICO PAGES.DEV / PROD FRONTEND ACTIVO**.

La foundation temporal fue promovida al deployment estable de producción de Pages. El origin canónico aprobado es `https://afucoa-v2-prod.pages.dev/`; no se comprará dominio propio. Esto habilita únicamente el frontend estático: no crea usuarios, no despliega Edge Functions y no declara AFUCOA V2 lista para producción.

## Identificación

| Campo | Valor |
| --- | --- |
| Proveedor | Cloudflare Pages, Direct Upload |
| Cuenta | Cuenta Cloudflare de Jorge; account ID `87a0bef2b52d332cb9d6c6a49fd981fb` |
| Pages project | `afucoa-v2-prod` |
| Environment / branch | Preview / `foundation` |
| Deployment ID | `348d68b4-32d3-4cd0-a109-49ef01fbc43b` |
| URL inmutable | `https://348d68b4.afucoa-v2-prod.pages.dev/` |
| Alias temporal | `https://foundation.afucoa-v2-prod.pages.dev/` |
| Production deployment ID | `f7645b3e-61e9-4fb8-b513-f1b741accbc7` |
| Origin canónico | `https://afucoa-v2-prod.pages.dev/` |
| Supabase PROD | `rywdochyzhgfaymrmxek`, `sa-east-1` |
| SHA del artefacto | `7f598be321b619f54d71c3b72692b003c221ca3e` |

No se contrató un plan pago ni un add-on en Cloudflare. No se conectó repositorio, custom domain ni DNS externo y no se creó un workflow PROD. El hostname estable `pages.dev` es el origin aprobado; los deployments hash y `foundation` quedan solo como evidencia histórica/preview.

## Construcción y unidad desplegable

El artefacto se construyó una sola vez desde un working tree limpio en el SHA indicado, con:

- modo `supabase`;
- URL `https://rywdochyzhgfaymrmxek.supabase.co`;
- publishable key exclusiva de PROD, obtenida en memoria y no registrada;
- alias Auth `auth.afucoa.local`;
- base pública `/`;
- modo de headers `temporary-hostname`.

El pipeline `build:prod` valida primero la configuración, ejecuta Vite, genera `dist/_headers` desde `config/production-security-headers.json` y comprueba el resultado. El adaptador es exclusivo del build PROD: staging no recibe ese archivo.

El mismo `dist` canónico aprobado fue enviado mediante Wrangler Direct Upload, sin reconstrucción posterior. Cloudflare confirmó cinco assets públicos; `_headers` fue ingerido como configuración y no se sirve como asset.

## Release manifest y hashes

Release manifest generado: `afucoa-v2-prod-3d-release-63140a0-release-manifest.json`

SHA-256 del release manifest: `8ecbc534f3a5ed969e01072641638dd2104a8a63b4af9f1c2e037e4728e7926b`

| Archivo | Bytes | SHA-256 |
| --- | ---: | --- |
| `_headers` | 939 | `3a95fd8025e0c02277603ec20e38adbdd2540d682ed36173edc758f251df771f` |
| `assets/index-BobTheQ4.js` | 284421 | `b2f6140c5bf0d47cb8397677ff8fcf0f38a9fd59c6d665730a1f3943ee07daeb` |
| `assets/index-RnxDyIO3.css` | 39889 | `d6606ae61a327c85c801b5140c24ac68aa330f55bb4b8fa564a518d69a189a77` |
| `index.html` | 570 | `a4e0274c965885ef4102c50702175a1284e38dcee6f86228248bb54c2ca86b6f` |
| `manifest.webmanifest` | 177 | `22715bf987790b4c92ebf6d1a6dbd5381a9b7272eebdcd250f64c88ee34f388a` |
| `push-sw.js` | 2587 | `e4424434a7eff73b9830599226afa86c48aecbdeca3010e3b16f5286afe6bc6e` |

Los cinco archivos servidos por la URL inmutable fueron descargados y sus hashes coincidieron con el `dist` aprobado. Los hashes de los inputs versionados quedaron incluidos en el manifest: migration manifest, política de headers, inventario de Edge Functions y fuentes permitidas. Este inventario de fuentes no significa que las funciones hayan sido desplegadas: PROD conserva 0 Edge Functions.

## Headers HTTPS materializados

El deployment canónico responde con TLS válido y los siguientes controles:

- `Content-Security-Policy` estricta;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: no-referrer`;
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()`;
- `X-Frame-Options: DENY`;
- `X-Robots-Tag`: ausente en el origin canónico; `noindex` solo permanece en el preview temporal histórico.

La CSP efectiva es:

```text
default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self' https://rywdochyzhgfaymrmxek.supabase.co; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests
```

No contiene `*`, `unsafe-inline`, `unsafe-eval`, Supabase DEV ni el staging de GitHub Pages. No se demostró necesario ningún origen adicional.

## HSTS canónico activo

El origin canónico responde sobre HTTPS válido y materializa nuestra política HSTS exacta:

La política canónica continúa versionada, sin debilitarse:

```text
max-age=31536000; includeSubDomains
```

No se usa `preload`. Los tests del adaptador cubren tanto la omisión de preview como la materialización canónica exacta.

## Caché, manifest y service worker

| Recurso | Resultado remoto |
| --- | --- |
| `/` y `/index.html` | `no-cache, no-store, must-revalidate` |
| `/manifest.webmanifest` | `public, max-age=0, must-revalidate` |
| `/push-sw.js` | `no-cache, no-store, must-revalidate`; `Service-Worker-Allowed: /` |
| `/assets/*` hashed | `public, max-age=31536000, immutable` |

El manifest carga por HTTPS, se llama `AFUCOA`, usa `start_url: "./"` y `display: "standalone"`; en este deployment raíz resuelve a `/`. El bundle registra `push-sw.js` con la base pública explícita y `updateViaCache: "none"`; el worker usa `self.registration.scope`, por lo que su scope efectivo es `/`.

## Verificación funcional sin identidades

- `GET /` y `GET /index.html`: HTTP 200 con el mismo shell aprobado.
- `GET /login`: HTTP 200 y cuerpo idéntico al shell, confirmando fallback SPA para refresh directo. La navegación productiva continúa siendo hash-based.
- Manifest, worker, JS y CSS: HTTP 200 y hash idéntico al artefacto.
- Assets: referencias absolutas desde `/`; no existe base `/app-afucoa/`.
- Backend embebido: una única URL de Supabase, correspondiente a PROD.
- Sourcemaps: 0 archivos y 0 referencias `sourceMappingURL`.
- Referencias DEV/staging: 0.
- Material privilegiado (`service_role`, `sb_secret`, variable server-side): 0.
- No se inició sesión, creó usuario ni ejecutó recuperación.

## Estado Supabase preservado

El control final read-only confirmó:

- 17/17 migraciones canónicas, sin divergencia;
- 0 Auth users;
- 0 profiles;
- 0 Edge Functions;
- Auth Site URL `https://afucoa-v2-prod.pages.dev`;
- allowlist de redirects vacía, porque el frontend no usa OAuth ni redirects de Auth.

La URL canónica `pages.dev` fue configurada en Auth. No se agregaron localhost, GitHub Pages, preview, deployment hash ni origins DEV.

## Validación automatizada

| Comando | Resultado |
| --- | --- |
| `pnpm test:migrations` | 17/17 PASS |
| `pnpm test:prod-operations` | 6/6 PASS; contrato 18 documentos, 17 alertas y 7 smokes |
| `pnpm test:prod-hosting` | 18/18 PASS, incluidos 6 casos específicos del adaptador Cloudflare |
| `pnpm test:prod-artifact` | 16/16 PASS y build sintético PASS |
| `pnpm test:edge-config` | 12/12 PASS y check estático PASS |
| `pnpm test:recovery` | 18/18 PASS actual; 13/13 en la fase histórica |
| `pnpm test:push` | 44/44 PASS |
| `pnpm test:session` | 11/11 PASS |
| `pnpm test:navigation` | 5/5 PASS |
| `pnpm test:staging` | PASS; 163 módulos, 5 archivos, 0 maps, 0 material privilegiado |

No se ejecutaron pruebas LIVE con identidades. Cloudflare Pages procesa `_headers` desde el directorio desplegable y no lo sirve como asset, comportamiento confirmado también contra este deployment. Referencia: [Cloudflare Pages — Headers](https://developers.cloudflare.com/pages/configuration/headers/) y [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/).

## Estado de cutover

B06 queda **CLOSED** para el origin Pages.dev aprobado: HTTPS, HSTS, headers, caché, manifest, worker, fallback SPA, Auth Site URL y ausencia de material DEV/privilegiado fueron validados. Estado actual: B03–B09 se cerraron en fases posteriores; B10 sigue abierto y AFUCOA V2 no está habilitada para usuarios reales.
