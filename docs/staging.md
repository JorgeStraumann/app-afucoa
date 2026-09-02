# AFUCOA V2 — staging web

## Alcance

Este entorno despliega únicamente la rama `afucoa-v2` y conecta el frontend al proyecto Supabase DEV `imiplnspvmsrsuikulwm`. Se usa exclusivamente con usuarios DEV y datos Beta.

Pilot 01 real permanece suspendido. El workflow no ejecuta los importadores, no lee `SUPABASE_SERVICE_ROLE_KEY` y no crea usuarios.

## Configuración de GitHub

1. En `Settings > Secrets and variables > Actions > Variables`, crear la variable de repositorio `AFUCOA_DEV_PUBLISHABLE_KEY` con la publishable key del proyecto DEV. Es una clave pública del frontend; nunca colocar allí una `service_role` o una clave `sb_secret_*`.
2. En `Settings > Pages > Build and deployment`, seleccionar `GitHub Actions`.
3. Publicar cambios solamente en `afucoa-v2`. El workflow rechaza otra rama y valida el proyecto Supabase antes de construir.
4. GitHub Pages entrega el staging en `https://jorgestraumann.github.io/app-afucoa/` cuando finaliza el workflow `AFUCOA V2 staging`.

Si la variable todavía no existe cuando se publica el workflow, los jobs quedan omitidos de forma segura. Después de crearla y habilitar Pages, volver a ejecutar ese workflow desde GitHub Actions.

El job verifica que el bundle:

- usa `VITE_AFUCOA_MODE=supabase`;
- apunta exactamente a `imiplnspvmsrsuikulwm`;
- contiene solo una publishable key o anon legacy;
- no incluye `service_role`, claves `sb_secret_*` ni source maps;
- funciona bajo `/app-afucoa/` y conserva el enrutado por hash.

## Validación local

Copiar `.env.staging.example` como `.env.staging.local`, completar solamente `VITE_SUPABASE_PUBLISHABLE_KEY` y ejecutar:

```powershell
pnpm test:staging
pnpm preview:staging
```

La copia local queda ignorada por Git mediante la regla `.env.local`/`.env.*.local`.

## Operación segura

- No configurar variables `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SERVICE_ROLE_KEY` ni equivalentes en el hosting.
- No usar datos reales de Pilot 01.
- No cambiar el origen del workflow a `main`.
- Un fallo de validación detiene el despliegue antes de publicar el artefacto.
