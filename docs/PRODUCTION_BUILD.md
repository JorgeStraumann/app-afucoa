# AFUCOA V2 — build y artefacto de producción

Estado: ruta de build PROD fail-closed versionada y validada con configuración sintética; no existe infraestructura PROD y no se realizó ningún despliegue.

## Contratos separados

Staging conserva deliberadamente el proyecto DEV `imiplnspvmsrsuikulwm`, GitHub Pages y la base `/app-afucoa/`. Sus validadores siguen siendo `validate-staging-env.mjs` y `check-staging-dist.mjs`.

PROD usa exclusivamente `validate-production-env.mjs` y `check-production-dist.mjs`. No hereda defaults de staging ni conoce un project ref PROD concreto. La URL esperada se deriva de la configuración explícita recibida por el proceso.

## Variables obligatorias

| Variable | Contrato PROD |
| --- | --- |
| `VITE_AFUCOA_MODE` | Exactamente `supabase`. |
| `VITE_SUPABASE_URL` | Origin HTTPS `*.supabase.co`, sin credenciales, puerto, path, query o fragment; nunca el project ref DEV ni localhost. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Formato actual `sb_publishable_*`. Es pública y queda en el bundle, pero nunca se imprime completa durante la validación. |
| `VITE_AUTH_ALIAS_DOMAIN` | Dominio de alias interno válido; no necesita ser un sitio web ni cambia el login por cédula. |
| `AFUCOA_PUBLIC_BASE` | Path absoluto explícito que empieza y termina en `/`; `/` es válido y `/app-afucoa/` está prohibido. |

No existen valores PROD por defecto ni `.env.production` versionado. El comando exige estas variables directamente en el entorno del proceso, aun cuando haya un `.env.local` de desarrollo. Además inspecciona los nombres que Vite cargaría desde archivos de entorno y falla si alguno corresponde a material privilegiado.

## Qué es público y qué está prohibido

La URL Supabase PROD, publishable key, alias domain y base pública forman parte del cliente. La publishable key identifica la API pública y su acceso efectivo continúa protegido por Auth, grants y RLS.

Nunca deben llegar al build secretos `sb_secret_*`, service-role keys/JWT, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, VAPID privada, Resend, PEM ni variables `VITE_*` con nombres privilegiados. El validador rechaza además cualquier secreto server-side presente en el proceso, aunque el código no lo consuma.

Referencias: [Supabase API keys](https://supabase.com/docs/guides/api/api-keys) y [Vite env variables](https://vite.dev/guide/env-and-mode).

## Ejecución fail-closed

```text
pnpm build:prod
```

El comando:

1. valida las cinco variables obligatorias;
2. construye con Vite en modo `production` y source maps deshabilitados;
3. inspecciona recursivamente `dist`.

La inspección exige `index.html`, `manifest.webmanifest` y `push-sw.js`; comprueba base, assets, `start_url`, registro/scope del worker, una única URL Supabase coincidente y una única publishable key coincidente. Rechaza referencias DEV/staging/localhost y patrones secretos o privilegiados. Cualquier incumplimiento termina con error antes de que el artefacto pueda promoverse.

`@supabase/auth-js` incorpora en su distribución un fallback de constructor hacia localhost aunque AFUCOA siempre entrega la URL validada a `createClient`. Solo durante el build `production`, Vite sustituye esa cadena inalcanzable por el origin reservado no enrutable `https://invalid.invalid`. El validador conserva la prohibición absoluta de `localhost`; staging y desarrollo no reciben esta transformación.

## Validación sintética en CI

```text
pnpm test:prod-artifact
```

La prueba no usa red ni credenciales reales. Inyecta un project ref, publishable key, alias y base `/` exclusivamente sintéticos, ejecuta el build completo y valida el artefacto. También cubre las configuraciones negativas: URL DEV/localhost/insegura, base staging/ausente/mal formada, variables faltantes, claves secret/service-role y nombres `VITE_*` privilegiados.

En el workflow staging el orden es obligatorio:

1. generar y validar el artefacto PROD sintético, sin subirlo;
2. ejecutar `test:staging`, que reemplaza `dist` con un build nuevo bajo el contrato DEV;
3. subir exclusivamente ese último `dist` de staging a Pages.

## Procedimiento futuro con un SHA aprobado

1. partir de un SHA congelado que haya superado todas las suites;
2. obtener URL, publishable key, alias y base del entorno PROD autorizado, sin copiar ningún valor DEV;
3. exponer las cinco variables solo al proceso de build controlado;
4. ejecutar `pnpm build:prod`;
5. conservar evidencia del SHA y resultado del validador, sin registrar la key completa;
6. promover exactamente ese artefacto mediante un workflow PROD protegido que todavía no existe.

Este build no provisiona Supabase, dominio, DNS, secretos ni hosting; tampoco despliega `dist`. Un resultado exitoso demuestra higiene del artefacto, no constituye un go-live ni cierra los blockers de infraestructura, seguridad u operación.
