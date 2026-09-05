# AFUCOA V2 — Cloudflare Pages PROD hosting foundation

Fecha de validación: 5 de septiembre de 2026 (America/Montevideo)

Estado: **FOUNDATION / TEMPORARY HOSTNAME / NOT APPROVED FOR CUTOVER**

Esta fase provisiona y prueba una base real de hosting HTTPS para el frontend PROD. No aprueba el hostname `pages.dev` como dominio canónico, no habilita usuarios y no declara AFUCOA V2 lista para producción.

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
| Supabase PROD | `rywdochyzhgfaymrmxek`, `sa-east-1` |
| SHA del artefacto | `7f598be321b619f54d71c3b72692b003c221ca3e` |

No se contrató un plan pago ni un add-on en Cloudflare. No se conectó repositorio, custom domain ni DNS y no se creó un workflow PROD.

## Construcción y unidad desplegable

El artefacto se construyó una sola vez desde un working tree limpio en el SHA indicado, con:

- modo `supabase`;
- URL `https://rywdochyzhgfaymrmxek.supabase.co`;
- publishable key exclusiva de PROD, obtenida en memoria y no registrada;
- alias Auth `auth.afucoa.local`;
- base pública `/`;
- modo de headers `temporary-hostname`.

El pipeline `build:prod` valida primero la configuración, ejecuta Vite, genera `dist/_headers` desde `config/production-security-headers.json` y comprueba el resultado. El adaptador es exclusivo del build PROD: staging no recibe ese archivo.

El mismo `dist` aprobado fue enviado mediante Wrangler Direct Upload, sin recompilar entre validación y deploy. Cloudflare confirmó cinco assets públicos; `_headers` fue ingerido como configuración y no se sirve como asset.

## Release manifest y hashes

Release manifest generado: `afucoa-v2-prod-f3c-7f598be321b619f54d71c3b72692b003c221ca3e-release-manifest.json`

SHA-256 del release manifest: `3388f0938aa424487fda036e7f94774f7078e4e3d5c1740e945d680ddf740030`

| Archivo | Bytes | SHA-256 |
| --- | ---: | --- |
| `_headers` | 898 | `e6dc8a055d7929de08713db86fca0f3c02932ba8d0a888d15f92af467f606e9d` |
| `assets/index-BobTheQ4.js` | 284421 | `b2f6140c5bf0d47cb8397677ff8fcf0f38a9fd59c6d665730a1f3943ee07daeb` |
| `assets/index-RnxDyIO3.css` | 39889 | `d6606ae61a327c85c801b5140c24ac68aa330f55bb4b8fa564a518d69a189a77` |
| `index.html` | 570 | `a4e0274c965885ef4102c50702175a1284e38dcee6f86228248bb54c2ca86b6f` |
| `manifest.webmanifest` | 177 | `22715bf987790b4c92ebf6d1a6dbd5381a9b7272eebdcd250f64c88ee34f388a` |
| `push-sw.js` | 2587 | `e4424434a7eff73b9830599226afa86c48aecbdeca3010e3b16f5286afe6bc6e` |

Los cinco archivos servidos por la URL inmutable fueron descargados y sus hashes coincidieron con el `dist` aprobado. Los hashes de los inputs versionados quedaron incluidos en el manifest: migration manifest, política de headers, inventario de Edge Functions y fuentes permitidas. Este inventario de fuentes no significa que las funciones hayan sido desplegadas: PROD conserva 0 Edge Functions.

## Headers HTTPS materializados

La URL temporal responde con TLS válido y los siguientes controles:

- `Content-Security-Policy` estricta;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: no-referrer`;
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()`;
- `X-Frame-Options: DENY`;
- `X-Robots-Tag: noindex` para el hostname temporal.

La CSP efectiva es:

```text
default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self' https://rywdochyzhgfaymrmxek.supabase.co; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests
```

No contiene `*`, `unsafe-inline`, `unsafe-eval`, Supabase DEV ni el staging de GitHub Pages. No se demostró necesario ningún origen adicional.

## HSTS deliberadamente pendiente

El deployment temporal no materializa nuestra política HSTS y la respuesta verificada no contiene `Strict-Transport-Security`. Es deliberado: AFUCOA no controla el dominio padre `pages.dev` ni sus subdominios.

La política canónica continúa versionada, sin debilitarse:

```text
max-age=31536000; includeSubDomains
```

Solo se generará en modo `canonical-domain` después de conectar el dominio propio HTTPS y confirmar control de sus subdominios. Los tests del adaptador cubren tanto la omisión temporal como la materialización canónica exacta.

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
- Auth Site URL `http://localhost:3000`;
- allowlist de redirects vacía.

La URL `pages.dev` no fue agregada a Auth y permanece **TEMPORARY / NOT APPROVED**.

## Validación automatizada

| Comando | Resultado |
| --- | --- |
| `pnpm test:migrations` | 17/17 PASS |
| `pnpm test:prod-operations` | 6/6 PASS; contrato 18 documentos, 17 alertas y 7 smokes |
| `pnpm test:prod-hosting` | 18/18 PASS, incluidos 6 casos específicos del adaptador Cloudflare |
| `pnpm test:prod-artifact` | 16/16 PASS y build sintético PASS |
| `pnpm test:edge-config` | 12/12 PASS y check estático PASS |
| `pnpm test:recovery` | 13/13 PASS |
| `pnpm test:push` | 44/44 PASS |
| `pnpm test:session` | 11/11 PASS |
| `pnpm test:navigation` | 5/5 PASS |
| `pnpm test:staging` | PASS; 163 módulos, 5 archivos, 0 maps, 0 material privilegiado |

No se ejecutaron pruebas LIVE con identidades. Cloudflare Pages procesa `_headers` desde el directorio desplegable y no lo sirve como asset, comportamiento confirmado también contra este deployment. Referencia: [Cloudflare Pages — Headers](https://developers.cloudflare.com/pages/configuration/headers/) y [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/).

## Pendientes para cutover

Antes de considerar B06 cerrado se debe:

1. aprobar y conectar el dominio canónico propio;
2. configurar DNS y verificar TLS final;
3. reconstruir desde el SHA de promoción con modo `canonical-domain`, activar y verificar HSTS;
4. reemplazar Site URL y definir redirects Auth exactos, sin comodines;
5. validar CSP, caché, manifest, worker, navegación y actualización sobre el dominio final;
6. completar el pipeline protegido de B07 y todas las pruebas preproducción restantes.

Hasta entonces B06 permanece **PARTIAL**, Pilot 01 **PARKED** y AFUCOA V2 **no está aprobada para producción**.
