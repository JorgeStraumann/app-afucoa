# AFUCOA V2 — Production Readiness, fase 1

Fecha de corte: 5 de septiembre de 2026 (America/Montevideo)

Rama auditada: `afucoa-v2`

Baseline al iniciar la auditoría: `1044fcd91eb35abcfa9346d295e16cfb4be7141e`

Entornos documentados: Supabase `AFUCOA V2 DEV` (`imiplnspvmsrsuikulwm`), staging público y PROD aislado (`rywdochyzhgfaymrmxek`)

Tipo de documento: auditoría viva de readiness; Fase 3I cierra B05 con Web Push PROD real

## Dictamen ejecutivo

**AFUCOA V2 todavía no está habilitada completamente para producción.** B01, B02, B05, B06, B07, B08 y B09 están **CLOSED**; B03 permanece **PARTIAL** únicamente por Recovery PROD/B04 E2E; B04 y B10 siguen **OPEN**. Fase 3J agregó la migración canónica #19, health técnico sin PII, cinco monitores UptimeRobot FREE y una auditoría GitHub completa. Fase 3K cerró B09 con arquitectura combinada: UptimeRobot cada 5 minutos y GitHub-hosted runners cada 15 minutos para contratos avanzados, sin plan pago. Fase 3H agregó MFA TOTP obligatorio para admin/superadmin y Fase 3I validó Web Push PROD E2E.

Los riesgos técnicos más inmediatos son:

1. El bootstrap, la gobernanza base, el hardening Auth, el hosting canónico, el pipeline protegido, restore, Web Push PROD y monitoring B09 quedaron demostrados; Recovery PROD/B04 continúa abierto.
2. El runtime Push ya usa configuración PROD fail-closed, VAPID exclusivo y solo el origin canónico. Recovery permanece sin funciones, proveedor ni secrets PROD y no fue desplegado durante Fase 3I.

La protección contra contraseñas filtradas continúa deshabilitada en DEV, riesgo aceptado únicamente porque DEV está en Free. En PROD Pro quedó habilitada en Fase 3B; no se intentó silenciar el warning DEV mediante SQL ni cambios de frontend.

## Alcance y evidencia

La auditoría incluyó:

- código, configuración versionada, migraciones, pruebas y documentación de `afucoa-v2`;
- consultas read-only al catálogo de Supabase DEV, Auth settings públicos, Storage, Edge Functions y Advisors;
- comparación entre las migraciones versionadas y el historial de migraciones registrado en DEV;
- ejecución local de las cuatro suites requeridas;
- revisión de documentación oficial de Supabase, GitHub, Resend y navegadores.

La auditoría inicial de Fase 1 no ejecutó migraciones, SQL de escritura, despliegues, cambios de settings, rotaciones, llamadas de recuperación real ni pruebas LIVE con datos. Este documento incorpora la validación DEV posterior de Fase 2C, el bootstrap PROD de Fase 3A, el hardening Auth PROD de Fase 3B, la foundation HTTPS de Fase 3C, la adopción canónica de Fase 3D, el restore drill de Fase 3F y la auditoría read-only de gobernanza de Fase 3G. La evidencia de Auth está en `docs/PROD_AUTH_HARDENING.md`; la de hosting en `docs/PROD_HOSTING_FOUNDATION.md` y `docs/PROD_CANONICAL_ORIGIN.md`; la de gobernanza en `docs/PROD_GOVERNANCE.md`.

## Blockers de producción

| ID | Blocker | Dependencia/costo | Criterio de cierre |
| --- | --- | --- | --- |
| B01 — **CLOSED** | Bootstrap canónico reproducible | Completado con Supabase CLI 2.116.0, sin Docker | Bootstrap 17/17 desde base vacía y migración #18 aplicada canónicamente después de DEV PASS; DEV/PROD 18/18, dry-run posterior vacío y sin migration repair. Evidencia: `docs/PROD_BOOTSTRAP.md` y `docs/PROD_PRIVILEGED_MFA.md`. |
| B02 — **CLOSED** | Proyecto PROD separado y gobernanza operativa verificada | Organización `AFUCOA PROD` en Pro; región `sa-east-1`; modelo de una sola persona | Un miembro humano Owner, acceso mínimo, MFA individual habilitado, responsables formales, billing operativo, Spend Cap habilitado, compute micro y add-ons inesperados ausentes. El enforcement MFA organizacional queda como mejora futura por riesgo de lockout del único Owner. Evidencia: `docs/PROD_GOVERNANCE.md`. |
| B03 — **PARTIAL** | Hardening base Auth, URL, MFA privilegiado y ciclo operativo aplicados | Leaked Password Protection ya está habilitada con el plan Pro | Mínimo 12, cuatro clases, signup cerrado, HIBP, Site URL y MFA TOTP AAL2 para admin/superadmin están evidenciados. Alta/baja/revocación/reset MFA fueron documentados y validados sintéticamente. Único pendiente: Recovery PROD/B04 E2E. Evidencia: `docs/PROD_AUTH_HARDENING.md`, `docs/PROD_PRIVILEGED_MFA.md` y `docs/PROD_ACCOUNT_LIFECYCLE.md`. |
| B04 — **ABIERTO** | Recuperación parametrizada y validada E2E en DEV, pero PROD no está lista | Dominio y proveedor de correo; costo según proveedor/volumen | Configurar/desplegar runtime PROD, usar email/dominio/secrets PROD, verificar titularidad de emails y aprobar E2E real PROD: solicitud neutra, recepción, cambio, login, expirado, reuso y límites. |
| B05 — **CLOSED** | Web Push PROD con VAPID exclusivo y E2E físico | Completado sobre hosting HTTPS existente; alertas externas siguen en B09 | `push-config`/`send-notification-push` v1 ACTIVE, CORS fail-closed, JWT real + AAL2, Chrome/Windows real, payload sin PII, ledger, retry deduplicado, logout, reconciliación, baja y contrato 404/410. Evidencia: `docs/PROD_WEB_PUSH.md`. |
| B06 — **CLOSED** | Origin canónico Cloudflare Pages.dev adoptado y validado | Sin dominio propio ni costo nuevo aprobado | Production deployment estable, HTTPS/TLS, HSTS canónico, CSP, headers, caché, manifest, worker, fallback SPA, Auth Site URL y ausencia de material DEV/privilegiado están probados. Evidencia: `docs/PROD_CANONICAL_ORIGIN.md` y `docs/PROD_HOSTING_FOUNDATION.md`. |
| B07 — **CLOSED** | Pipeline protegido y rollback operativo | Completado sin costo nuevo | Environment `production`, approval, branch allowlist, exact SHA, artifact/manifest, mutex, token Cloudflare acotado y regla anti-force-push/deletion confirmados. Promoción run `34002807860`, rollback run `34003066262` y restauración run `34003124433` terminaron con smoke PASS. Evidencia: `docs/PROD_PIPELINE_ACTIVE.md`. |
| B08 — **CLOSED** | Backup físico PROD, restore aislado, RPO/RTO y mecanismo Storage sintético validados | Backups diarios Pro activos; proyecto temporal facturado por hora y eliminado; PITR no contratado | Backup `COMPLETED`, restore real, equivalencia 17/17, RLS/policies/functions/triggers/grants, Storage metadata y bytes sintéticos, objetivos RPO/RTO y cleanup completo. El dump lógico adicional es defensa en profundidad futura no bloqueante. Evidencia: `docs/PROD_BACKUP_RESTORE_DRILL.md`. |
| B09 — **CLOSED** | Health #19, matriz, cinco monitores UptimeRobot FREE cada 5 min y auditor GitHub externo cada 15 min | USD 0; schedule GitHub best-effort y una región UptimeRobot | Cobertura combinada real, email, baseline, game days, issues deduplicados, recovery, ownership y runbooks. Edge `POST→401` y Storage `400 NoSuchKey` conservan su contrato completo en GitHub-hosted runners. Evidencia: `docs/PROD_MONITORING_ACTIVE.md`. |

La primera ejecución automática posterior al cambio de cadencia fue el run `34328893538` (`schedule`, `afucoa-v2`): `11/11 PASS`, inicio 2 minutos después del slot nominal, 0 Issues abiertos y PROD sin cambios. Esta evidencia cierra el circuito automático sin atribuir SLA al scheduler de GitHub.
| B10 — **OPEN** | Cutover gate documentado; alta/cutover de personas reales no aprobados | Operación y soporte; Pilot 01 permanece PARKED | Cerrar todos los blockers, aprobar datos/consentimiento/soporte y celebrar go/no-go. Reactivar Pilot solo mediante autorización posterior explícita; no migrar contraseñas V1. |

La cantidad de blockers es de lanzamiento, no la cantidad de avisos del Advisor. Un solo blocker abierto impide promover a producción.

## 1. Auth y seguridad

### Estado actual

- El login normaliza la cédula y usa el alias Auth `<cedula>@auth.afucoa.local`; el correo de contacto no es el identificador de Auth.
- La recuperación exige entre 12 y 72 caracteres, con mayúscula, minúscula, número y símbolo, tanto en frontend como en Edge Function.
- La documentación DEV registra mínimo 12, las cuatro clases y altas públicas deshabilitadas en Auth. Estos settings del Dashboard no son parte de las migraciones y deben verificarse nuevamente en PROD.
- En PROD, Fase 3B configuró mínimo 12, las cuatro clases, Leaked Password Protection, signup público cerrado y email/password reservado para login y altas administrativas server-side. Teléfono, anónimo, OAuth/social y SAML permanecen deshabilitados.
- La prueba pública con una identidad sintética `example.invalid` fue rechazada con HTTP 422; no creó usuario, perfil ni email. PROD terminó con 0 usuarios Auth y 0 profiles.
- `mailer_autoconfirm=false` y el rechazo de emails no verificados se conservaron. Las futuras altas administrativas deberán confirmar explícitamente la identidad Auth; la titularidad del correo de contacto se valida por separado antes de recuperación.
- `Site URL=https://afucoa-v2-prod.pages.dev` está aprobado para el origin canónico; la allowlist de redirects permanece vacía porque no hay OAuth/callback de Auth. No se reutilizó staging, DEV ni `/app-afucoa/`.
- `request-password-recovery` mantiene una respuesta pública neutra. El código es de ocho dígitos, HMAC-SHA-256, vence en 10 minutos, se invalida al emitir uno nuevo, tiene cinco intentos y uso único.
- Los rate limits actuales cubren IP, identidad, operación global y código. Los límites DEV son una base, no una capacidad de producción aprobada.
- DEV mantiene desplegada `dev-seed-test-users`, una función auxiliar que no está versionada en esta rama. Es exclusivamente DEV y debe quedar expresamente excluida del inventario/despliegue PROD.
- `session.js` serializa la reconstrucción de sesión; un error transitorio de perfil no invalida tokens. Un perfil confirmado ausente/inactivo sí cierra la sesión.
- El logout real de la aplicación conserva deliberadamente el logout global de Supabase. Los tests LIVE con cuentas DEV compartidas inyectan/usan `signOut({ scope: 'local' })`, y `tests/live-auth-isolation.test.mjs` impide reintroducir un logout global en esos archivos.
- Los roles `socio`, `admin` y `superadmin` se resuelven desde `profiles`/RPC, no desde metadata editable. La navegación oculta Administración al socio, pero la autorización efectiva sigue siendo RLS/RPC y `adminOnly`.
- Las 28 tablas del esquema `public` observado tienen RLS habilitado. Se observaron 46 políticas públicas y 11 políticas de Storage. No hay vistas públicas.
- Todas las foreign keys públicas observadas tienen un índice utilizable.

### Requisitos de salida

- [x] Habilitar **Leaked Password Protection** en Auth PROD Pro y aplicar mínimo 12/cuatro clases/signup cerrado. DEV Free conserva el warning de forma consciente; no se elimina con SQL ni con código de aplicación.
- [x] Reemplazar el Site URL temporal por `https://afucoa-v2-prod.pages.dev`; mantener allowlist de redirects vacía y verificar configuración Auth final del frontend.
- [x] MFA TOTP obligatorio para admin/superadmin, con AAL2 server-side, gate frontend, re-login challenge y lifecycle sintético PROD. Los socios permanecen en AAL1.
- Definir alta, baja, reemplazo de correo, pérdida de acceso, baja de funcionarios y revocación de sesiones. Un `profiles.status = inactivo` protege las RPC contextuales, pero el runbook debe cubrir también sesiones Auth activas.
- Ejecutar RLS e integración contra un proyecto PROD vacío/preproducción con identidades sintéticas, nunca con socios reales ni con sesiones compartidas.
- Revisar cada `SECURITY DEFINER` de nuevo después de construir PROD: propietario, `search_path`, grants, uso de `auth.uid()`, outputs y comportamiento sin perfil activo. No convertirlas a invoker solo para silenciar Advisor.

Referencia: [Supabase — Password security](https://supabase.com/docs/guides/auth/password-security) y [Supabase — Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## 2. Separación DEV / PROD

PROD debe ser un proyecto Supabase independiente, no un esquema, branch ni conjunto de filas dentro de DEV.

| Recurso | Requisito PROD |
| --- | --- |
| Base de datos | Instancia/proyecto separados, creados solo mediante la cadena canónica de migraciones. Sin fixtures Beta/DEV. |
| Auth users | Directorio vacío al inicio; altas por flujo server-side aprobado. No copiar hashes ni contraseñas antiguas. |
| Publishable key | Clave pública exclusiva de PROD; es la única clave Supabase que puede llegar al bundle. |
| Secret/server keys | Claves exclusivas de PROD, restringidas a Edge/operación server-side. Nunca `VITE_*`, Pages, bundle, logs o repositorio. |
| Edge Function Secrets | Valores PROD por función/proyecto, con inventario, dueño, rotación y procedimiento de revocación. |
| VAPID | Par nuevo y exclusivo de PROD. La clave privada vive solo server-side; la pública puede entregarse al browser. |
| Email | API key/SMTP y remitente PROD separados; dominio verificado; límites y alertas propios. |
| Redirect URLs | `Site URL` y allowlist exacta del dominio final; evitar comodines en producción. |
| Dominio | URL canónica HTTPS aprobada; inventario de DNS, renovación, dueño y rollback. |
| Storage | Buckets recreados por migración/configuración, con políticas, MIME y tamaño equivalentes; objetos DEV no se copian. |
| Migrations | Mismos archivos inmutables promovidos desde el commit aprobado; sin cambios manuales no versionados. |
| Observabilidad | Logs/alertas/retención separados; ningún dashboard debe mezclar eventos DEV y PROD. |

**Regla absoluta:** no reutilizar en PROD project ref, publishable key, secret/service-role key, JWT secret, VAPID, Resend key, remitente de pruebas, tokens, usuarios, archivos ni datos de DEV.

El manifiesto de despliegue PROD debe incluir únicamente `request-password-recovery`, `confirm-password-recovery`, `push-config` y `send-notification-push` después de su parametrización/revisión. `dev-seed-test-users` no se despliega ni se recrea en PROD.

## 3. Web Push

### Estado validado en DEV

- Las funciones parametrizadas `push-config` v9 y `send-notification-push` v12 quedaron `ACTIVE` en DEV con `AFUCOA_ENV=dev` y origins explícitos.
- VAPID DEV está configurado server-side y el E2E real fue confirmado.
- Logout conserva la suscripción; no ejecuta `unregister_my_push_subscription`.
- Al cambiar de cuenta, la suscripción se reconcilia usando RPC que deriva la identidad del JWT; el frontend no elige `profile_id`.
- La baja explícita sigue siendo la única acción que desactiva.
- El payload cifrado contiene solo `target_path`, `profile_id` y `notification_id`, todos datos técnicos/UUID opacos. Título y body son genéricos; no hay PII.
- Distintas notificaciones usan tags distintos; un retry de la misma conserva el tag y no se usa `renotify`.
- Los endpoints 404/410 se desactivan, 5xx conservan el dispositivo y el ledger limita reintentos. Web Push no garantiza exactly-once.
- Después del despliegue parametrizado, `10000001` cerró sesión sin perder push y recibió toast en Windows/Chrome al enviar una notificación administrativa. La evidencia server-side registró dos deliveries enviados, cero fallidos y cero inactivos porque existen dos endpoints web activos distintos para ese perfil. No fue una doble entrega al mismo endpoint: son dos suscripciones válidas y no deben limpiarse en este cierre.

### Estado PROD — Fase 3I

- [x] Frontend, manifest y worker servidos por HTTPS en raíz, con scope `/` y `/push-sw.js`.
- [x] VAPID PROD nuevo/exclusivo configurado server-side; subject canónico. Rotarlo exigirá volver a suscribir dispositivos y requiere ventana/comunicación.
- [x] Runtime `prod`, Supabase PROD, Secret API Key PROD y allowlist canónica fail-closed; staging, localhost y origins ajenos denegados.
- [x] `push-config` y `send-notification-push` v1 ACTIVE; Recovery no fue desplegado.
- [x] JWT real obligatorio, socio AAL1 limitado a config y admin AAL2 obligatorio para envío.
- [x] Chrome/Windows real, permiso por gesto, suscripción, toast, logout, re-login/reconciliación, retry y baja explícita validados.
- [x] Payload cifrado sin PII y ledger privado. Respuestas 404/410/5xx cubiertas por contrato automático; el proveedor no permitió forzar 404/410 LIVE de forma determinística y no se inventó evidencia.
- [ ] Completar matriz física adicional Edge/Firefox/iOS y activar alertas externas/retención operativa dentro de B09; no reabre B05 técnico.

Los límites vigentes son 20 dispositivos activos por perfil, 40 por invocación, hasta cinco lotes desde frontend, concurrencia 4, timeout 8 s y TTL 300 s. Su seguimiento/capacidad permanece dentro de B09.

## 4. Email y recuperación

### Estado validado en DEV

- `request-password-recovery` v23 y `confirm-password-recovery` v23 quedaron `ACTIVE` con el runtime parametrizado.
- `AFUCOA_ENV=dev` y `AFUCOA_ALLOWED_ORIGINS` explícita fueron configuradas; URL/clave server-side y Resend existentes fueron preservados sin exponer valores.
- El usuario sintético DEV `10000001` completó solicitud desde staging, recepción del correo y del código de ocho dígitos, aceptación, cambio de contraseña y login posterior.
- La evidencia DB registró `delivery_status=sent`, `consumed=true` e `invalidated=false`. No se documentan código ni contraseña.

### Requisitos PROD

1. Elegir Resend o SMTP PROD; crear una credencial exclusiva y almacenarla únicamente como Edge Function Secret.
2. Verificar un dominio/subdominio de envío. Resend requiere SPF y DKIM para verificarlo; publicar DMARC, comenzar con monitoreo y endurecer la política después de confirmar todos los emisores.
3. Definir `RECOVERY_EMAIL_FROM` con el remitente aprobado y enlaces/orígenes del dominio final. Nunca reutilizar `RESEND_API_KEY` ni remitente DEV.
4. Confirmar operacionalmente la titularidad del correo de cada socio antes de habilitar recuperación. Editar `profiles.email` por sí solo no verifica el buzón.
5. Probar neutralidad y tiempos razonables para cédula existente/inexistente/inactiva/sin email/limitada; no registrar cédula, IP en claro, código, contraseña ni dirección completa.
6. Calibrar rate limits con volumen esperado y protección perimetral. Preparar alerta por abuso, rebotes, complaints, bloqueos globales y degradación del proveedor.
7. Aprobar E2E real con un usuario sintético de preproducción: recepción, código correcto, nueva contraseña, login, incorrecto, expirado, reutilizado, código anterior invalidado y exceso de intentos.

Las funciones `request-password-recovery` y `confirm-password-recovery` usan `verify_jwt=false` porque implementan un flujo público con controles propios. Eso exige que CORS, validación, tamaño de body, rate limit y respuesta neutra sigan siendo parte explícita de cada revisión.

Referencias: [Resend — verificación de dominio, SPF y DKIM](https://resend.com/docs/dashboard/domains/introduction) y [Resend — DMARC](https://resend.com/docs/dashboard/domains/dmarc).

## 5. GitHub y despliegue

### Estado actual

- `.github/workflows/afucoa-v2-staging.yml` despliega solamente `afucoa-v2` a Pages.
- El build staging está fijado a `imiplnspvmsrsuikulwm`, `/app-afucoa/` y la variable pública `AFUCOA_DEV_PUBLISHABLE_KEY`.
- El validador rechaza `sb_secret_*`, `service_role`, nombres `VITE_*` privilegiados y cualquier server key recibida por el build.
- Vite genera `sourcemap: false`; el escaneo actual del artefacto informó cero source maps y cero claves privilegiadas.
- Se usa hash routing, adecuado para refresh bajo GitHub Pages sin reglas SPA del servidor.
- Existen workflows manuales separados para promoción y rollback. El Environment `production` entrega el token Cloudflare solo después de la aprobación. La regla clásica de `afucoa-v2` prohíbe force push y branch deletion; la rama predeterminada es `afucoa-v2` para habilitar `workflow_dispatch`, sin modificar commits de `main`.

### Pipeline PROD implementado en Fase 3E

- No clonar el workflow cambiando solo una URL. Crear un workflow distinto con validador PROD, environment separado y sin defaults DEV.
- Promover un commit/artefacto inmutable que ya pasó staging, mediante `workflow_dispatch` o tag/release aprobado; no reconstruir desde una referencia móvil sin evidencia.
- Proteger `afucoa-v2` y la futura referencia de release con PR review/status checks. Mientras `main` sea V1, no usar un merge automático a `main` como mecanismo de producción de V2.
- GitHub Environment `production` con aprobación requerida, allowlist exclusiva `afucoa-v2`, self-review temporal por operador único y concurrencia global sin cancelación.
- Guardar como variables públicas únicamente URL/publishable key/base. Las claves privilegiadas no pertenecen al frontend ni al workflow de Pages.
- Fijar actions de terceros a versiones revisadas y, para mayor control de cadena de suministro, considerar SHAs inmutables.
- Escanear el artefacto por secretos y source maps, generar SBOM/inventario de dependencias, conservar evidencia de tests y registrar SHA desplegado.
- Tener rollback a un artefacto anterior sin revertir datos de forma destructiva. Las migraciones de DB necesitan una estrategia forward-fix separada.

GitHub documenta que los environments pueden restringir ramas, requerir aprobaciones y proteger secretos; Pages con Actions requiere permisos `pages: write` e `id-token: write`. Referencias: [GitHub Actions — deployments/environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments) y [GitHub Pages — custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## 6. Base de datos y Storage

### Hallazgos

- DEV tiene 28 tablas públicas con RLS habilitado, 46 políticas públicas y 11 políticas de Storage.
- Los buckets observados son:

| Bucket | Público | Límite | MIME |
| --- | ---: | ---: | --- |
| `documents-private` | No | 20 MB | PDF |
| `request-files` | No | 10 MB | PDF, JPEG, PNG |
| `public-media` | Sí | 10 MB | JPEG, PNG, WebP |

- No se encontraron foreign keys públicas sin índice utilizable.
- El Advisor de rendimiento marca índices sin uso y políticas permisivas múltiples; se detallan más abajo. No se deben eliminar índices usando métricas de un entorno DEV pequeño.
- La cadena local contiene ahora 18 versiones/nombres canónicos. `MANIFEST.json` conserva los SHA-256 normalizados y `pnpm test:migrations` informa 18/18. Las dos versiones obsoletas `20260831*` permanecen retiradas.
- La igualdad comprobada es de SQL normalizado: CRLF/CR a LF y exactamente un LF terminal; no se afirma igualdad byte-a-byte con la representación interna de Supabase.
- Fase 3A aplicó las primeras 17 migraciones con Supabase CLI 2.116.0 sobre PROD vacío, sin Docker. Fase 3H aplicó exclusivamente `20260906182340_privileged_aal2_enforcement.sql` después de un dry-run sin divergencias. DEV y PROD quedaron 18/18 y el dry-run posterior no tiene pendientes. Ver `docs/PROD_BOOTSTRAP.md` y `docs/PROD_PRIVILEGED_MFA.md`.

### Requisitos PROD

- Reconstruir y verificar migraciones en un proyecto vacío; comparar esquema, funciones, grants, policies, triggers, índices y buckets contra la especificación, no contra datos DEV.
- Ejecutar migraciones con un rol de despliegue controlado y guardar evidencia. Prohibir cambios manuales no versionados; si ocurre una emergencia, reconciliarla inmediatamente.
- Mantener privados `documents-private` y `request-files`; probar rechazo anónimo/ajeno y URLs firmadas. Auditar que `public-media` solo contenga material apto para exposición pública.
- Confirmar límites de archivo también server-side, MIME real/magic bytes, nombres/paths opacos, antivirus o proceso de cuarentena según evaluación de riesgo.
- Definir retención, borrado legal, exportación y restauración de objetos junto con la DB; un backup de Postgres no restaura por sí solo los objetos de Storage.
- Mantener el baseline aprobado: DB/Auth RPO 24 h y RTO 8 h; Storage RPO 24 h y RTO 12 h; Edge config último cambio aprobado/RTO 4 h; frontend RPO 0/RTO 2 h. El drill físico real cumplió los objetivos y B08 está cerrado. PITR no se contrató y solo se reevaluará si AFUCOA exige un RPO menor a 24 h. Un dump lógico adicional queda como defensa en profundidad futura no bloqueante.

Referencias: [Supabase — Database Backups](https://supabase.com/docs/guides/platform/backups) y [Supabase — Pricing](https://supabase.com/pricing).

## 7. Dominio y frontend

Checklist para pasar de `https://jorgestraumann.github.io/app-afucoa/` al dominio final:

- [ ] Elegir la URL canónica y decidir raíz (`/`) o subruta estable antes de emitir manifest/worker.
- [ ] Configurar DNS, HTTPS y renovación; forzar HTTPS. GitHub Pages soporta HTTPS en dominios personalizados correctamente configurados.
- [ ] Construir con `VITE_AFUCOA_MODE=supabase`, URL PROD, publishable key PROD, dominio de alias aprobado y `AFUCOA_PUBLIC_BASE` final.
- [ ] Verificar que HTML, assets, manifest, iconos y worker no contienen `/app-afucoa/` ni project refs DEV.
- [ ] Probar navegación hash, deep link compartido, refresh, back/forward, apertura desde push y actualización del service worker.
- [x] Configurar en Supabase PROD `Site URL=https://afucoa-v2-prod.pages.dev` y mantener redirects vacíos por diseño actual. Configurar CORS de Edge Functions queda pendiente hasta su despliegue, usando ese origin exacto.
- [ ] Definir CSP al menos para `default-src`, `script-src`, `style-src`, `img-src`, `font-src`, `connect-src`, `worker-src` y `manifest-src`, incluyendo exclusivamente Supabase PROD y proveedores necesarios.
- [x] Añadir/verificar HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y protección de framing (`frame-ancestors`) en el deployment canónico de Pages.
- [ ] Mantener source maps fuera del artefacto público o protegerlos en un servicio privado de observabilidad.
- [ ] Ejecutar el escaneo de secretos sobre el artefacto final y una inspección del tráfico del navegador: solo publishable key, sin server keys, VAPID privada ni datos sensibles en URLs/logs.

Referencia: [GitHub Pages — HTTPS](https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).

## 8. Advisors — clasificación completa

Corte observado en Supabase DEV: 5 de septiembre de 2026. Los Advisors son una señal complementaria; no reemplazan revisión de grants, RLS ni pruebas de abuso.

### Security Advisor — 21 findings, 0 ERROR

| Finding | Objeto | Clasificación | Decisión |
| --- | --- | --- | --- |
| `auth_leaked_password_protection` | Auth | **BLOCKER PROD** | Aceptado solo en DEV Free. Habilitar en PROD con Pro o superior. No ocultar mediante SQL/app. |
| `rls_enabled_no_policy` | `notification_push_deliveries` | **ACCEPTED / INTENTIONAL** | Ledger server-only; permisos cliente revocados. Mantener sin policy pública. |
| `rls_enabled_no_policy` | `password_recovery_rate_limits` | **ACCEPTED / INTENTIONAL** | Rate limit server-only; permisos cliente revocados. Mantener sin policy pública. |
| `anon_security_definer_function_executable` | `verify_membership_token(text)` | **ACCEPTED / INTENTIONAL** | Verificación pública de QR con salida mínima. Revalidar grants, entropía y expiración antes de PROD. |
| `authenticated_security_definer_function_executable` | `create_membership_verification_token()` | **ACCEPTED / INTENTIONAL** | Identidad activa derivada del JWT; crea/revoca token propio. |
| igual | `create_my_proposal(text,text)` | **ACCEPTED / INTENTIONAL** | Mutación propia con identidad derivada. |
| igual | `current_profile_id()` | **ACCEPTED / INTENTIONAL** | Frontera de contexto necesaria para RLS/RPC sin confiar en IDs cliente. |
| igual | `current_user_role()` | **ACCEPTED / INTENTIONAL** | Rol desde perfil activo, no metadata editable. |
| igual | `get_my_profile()` | **ACCEPTED / INTENTIONAL** | Entrega controlada del perfil autenticado. |
| igual | `is_admin()` | **ACCEPTED / INTENTIONAL** | Helper de autorización para evitar recursión RLS. |
| igual | `list_visible_proposals()` | **ACCEPTED / INTENTIONAL** | Agregado autorizado sin exponer apoyos privados. |
| igual | `mark_my_notification_read(uuid)` | **ACCEPTED / INTENTIONAL** | Mutación de destinatario propio. |
| igual | `register_my_push_subscription(text,text,text,text)` | **ACCEPTED / INTENTIONAL** | Identidad derivada; endpoint/keys no expuestos a terceros. |
| igual | `register_my_request_file(uuid,text,text,text)` | **ACCEPTED / INTENTIONAL** | Registra archivo solo para trámite autorizado. |
| igual | `save_my_request_draft(uuid,jsonb,integer)` | **ACCEPTED / INTENTIONAL** | Borrador propio y validado. |
| igual | `submit_my_request(uuid,jsonb)` | **ACCEPTED / INTENTIONAL** | Envío propio y transición controlada. |
| igual | `support_proposal(uuid)` | **ACCEPTED / INTENTIONAL** | Apoyo propio/único con reglas de estado. |
| igual | `touch_my_push_subscription(text)` | **ACCEPTED / INTENTIONAL** | Reconciliación del dispositivo autenticado. |
| igual | `unregister_my_push_subscription(text)` | **ACCEPTED / INTENTIONAL** | Baja explícita de la suscripción propia. |
| igual | `update_my_contact(text,text)` | **ACCEPTED / INTENTIONAL** | Solo email/teléfono propios; no permite rol/ficha. |
| igual | `verify_membership_token(text)` | **ACCEPTED / INTENTIONAL** | Mismo contrato público mínimo; acceso authenticated también intencional. |

Las 17 funciones `SECURITY DEFINER` observadas tienen `search_path` fijado (por ejemplo `public`, `public, extensions` o vacío en RPC push) y controles de identidad/rol. La aceptación no es perpetua: cualquier cambio de cuerpo, grants o output obliga a reauditar.

### Performance Advisor — 34 findings

Los 13 findings `multiple_permissive_policies` se clasifican **REVIEW BEFORE PROD**. Pueden duplicar evaluación y afectar rendimiento, pero la auditoría no encontró evidencia de bypass; RLS DEV está probada. Solo se consolidan tras demostrar equivalencia semántica por rol/operación:

| Acción | Tablas |
| --- | --- |
| `SELECT` | `agreement_locations`, `agreements`, `content_items`, `document_versions`, `documents`, `notification_recipients`, `notifications`, `request_definitions`, `request_events`, `request_files`, `request_messages` |
| `INSERT` | `request_files`, `request_messages` |

Los 21 findings `unused_index` se clasifican **INFO** en DEV de bajo volumen. Conservar hasta obtener métricas representativas; luego revisar costo de escritura, selectividad y planes antes de eliminar:

`agreement_favorites_agreement_idx`, `app_settings_updated_by_idx`, `audit_log_actor_idx`, `content_items_created_by_idx`, `document_versions_created_by_idx`, `notification_campaigns_created_by_idx`, `proposal_moderation_actor_idx`, `proposal_supports_profile_idx`, `proposals_profile_idx`, `request_events_actor_idx`, `request_files_uploaded_by_idx`, `request_messages_author_idx`, `requests_assigned_to_idx`, `password_recovery_rate_limits_updated_idx`, `notification_push_deliveries_device_idx`, `content_status_published_idx`, `agreements_status_category_idx`, `proposal_status_created_idx`, `request_drafts_profile_idx`, `content_kind_status_idx`, `notification_campaigns_status_idx`.

Resumen de findings:

| Clasificación | Cantidad |
| --- | ---: |
| BLOCKER PROD | 1 |
| ACCEPTED / INTENTIONAL | 20 |
| REVIEW BEFORE PROD | 13 |
| INFO | 21 |
| **Total** | **55** |

## 9. Plan ejecutable y orden recomendado

### Fase 2 — preparación técnica sin producción

- [x] Reconstruir la cadena canónica inicial y mantenerla en 18 migraciones con checksums/orden después del enforcement MFA.
- [x] Aplicar la cadena desde cero en el proyecto PROD vacío mediante CLI, conservar las 17 versiones y comparar tablas, RLS, policies, funciones y Storage con el baseline esperado.
- [x] Parametrizar recuperación y push para entornos explícitos; en modo PROD, fallar cerrado si URL/origen/secreto no están presentes. Desplegado y validado E2E únicamente en DEV.
- [x] Crear un inventario permitido de Edge Functions que excluya `dev-seed-test-users` de PROD.
- [x] Crear validadores y build sintético de artefacto PROD que rechacen project ref/origen/base/secrets DEV, sin deploy. Ver `docs/PRODUCTION_BUILD.md`.
- [x] Definir arquitectura y requisitos de hosting PROD, sin provisionar proveedor ni dominio. Ver `docs/PRODUCTION_HOSTING.md`.
- [x] Definir política canónica CSP/security headers/cache y validarla localmente con `test:prod-hosting`.
- [x] Definir promoción por SHA/artifact/manifest inmutable y proveer un template no ejecutable fuera de `.github/workflows/`.
- [x] Definir rollback frontend por redeploy del artefacto aprobado anterior, sin recompilar. Ver `docs/PRODUCTION_ROLLBACK.md`.
- [x] Documentar gobernanza GitHub requerida, manteniendo Settings y branches sin cambios. Ver `docs/GITHUB_PRODUCTION_GOVERNANCE.md`.
- [x] Provisionar y validar la foundation Cloudflare Pages sobre HTTPS.
- [x] Adoptar `https://afucoa-v2-prod.pages.dev` como origin canónico, desplegar Production, activar HSTS canónico, ajustar Auth Site URL y repetir la validación final. B06 CLOSED.
- [x] Crear workflows PROD/rollback reales, activar Environment approval con branch allowlist, proteger contra force push/deletion y validar promoción, rollback y restauración reales. B07 CLOSED.
- [x] Activar health #19, matriz de 17 alertas, cinco monitores UptimeRobot FREE y auditoría GitHub externa completa.
- [x] Crear incident response y runbooks de frontend, Auth, DB/Storage, recovery, push, Edge, secrets y DNS/TLS.
- [x] Aprobar el baseline RPO/RTO, verificar backups físicos PROD, ejecutar restore real aislado y demostrar export/delete/restore byte a byte de Storage sintético. RPO 13 h 42 min 46,708 s; RTO 12 min 34,589 s.
- [x] Crear borrador de retención sin purga automática, runbook de rotación y checklist de cutover. Todas las decisiones institucionales siguen pendientes.
- [x] Cerrar B08 con backup físico `COMPLETED`, restore aislado, equivalencia 17/17, Storage sintético byte a byte, RPO/RTO y cleanup validados. Dump lógico adicional reclasificado como defensa en profundidad futura no bloqueante.
- [x] Cerrar B09 con cobertura combinada UptimeRobot 5 min + GitHub-hosted runners 15 min, baseline, game days y circuito de incidentes probado.

### Fase 3 — infraestructura PROD vacía

- [x] Provisionar Supabase PROD Pro separado y confirmar región/aislamiento; verificar un único Owner necesario, MFA individual, responsables, billing, Spend Cap y recursos activos. B02 CLOSED; ver `docs/PROD_GOVERNANCE.md`.
- [x] Aplicar la cadena aprobada a PROD vacío y validar estructura/historial sin usuarios ni datos. Smoke/RLS con usuarios sintéticos quedan para una fase posterior.
- [x] Configurar el hardening base Auth PROD: política de 12/cuatro clases, signup cerrado y Leaked Password Protection.
- [x] Completar Auth PROD: Site URL canónico, redirects mínimos, MFA privilegiado AAL2 y ciclo operativo de altas/bajas/revocación/reset. B03 queda parcial únicamente por Recovery PROD/B04 E2E.
- [ ] Crear VAPID PROD y secrets Edge PROD; desplegar funciones parametrizadas.
- [ ] Configurar proveedor/email PROD, dominio, SPF/DKIM/DMARC y alertas.
- [x] Backups diarios, RPO/RTO y restore físico/Storage sintético validados sin PITR. B08 CLOSED; dump lógico adicional no bloqueante.
- [x] Crear una foundation Cloudflare Pages Preview mediante Direct Upload, sin dominio propio ni identidades.
- [x] Adoptar el hostname estable `afucoa-v2-prod.pages.dev` como origin canónico, validar el deployment Production y completar promoción/rollback/restauración mediante el pipeline protegido. B07 CLOSED.

### Fase 4 — validación preproducción

- [ ] Ejecutar suites sintéticas, RLS, integración, recovery E2E, push E2E y matriz responsive sobre la URL final.
- [ ] Ejecutar pruebas de carga/abuso controladas para login, recovery, Storage y push.
- [ ] Verificar Advisors; resolver blockers y justificar cada aceptación con dueño/fecha.
- [ ] Ejecutar revisión de privacidad, términos, soporte, incidente y continuidad.
- [ ] Congelar SHA candidato, generar evidencia y celebrar go/no-go.

### Fase 5 — piloto/cutover, solo con nueva autorización

- [ ] Reactivar Pilot 01 únicamente por decisión explícita.
- [ ] Validar los participantes, email y consentimiento; dry-run y reporte sin credenciales.
- [ ] Aplicar lote limitado server-side, observar, probar rollback y soporte.
- [ ] Ampliar gradualmente solo si se cumplen criterios de estabilidad y seguridad.

## 10. Qué puede hacerse sin pagar y qué requiere costo

### Puede hacerse ahora sin contratar infraestructura

- reconstruir/ensayar migraciones en entorno local o desechable disponible;
- parametrizar código por ambiente y agregar validadores fail-closed;
- diseñar workflow PROD, promoción, rollback y branch rules;
- crear CSP propuesta, inventario de orígenes y threat model;
- preparar runbooks, SLO, matriz de alertas, RPO/RTO y checklist de restore;
- consolidar evidencia de RLS/`SECURITY DEFINER` y añadir tests sintéticos;
- inventariar DNS, dominios, responsables, retención y ciclo de usuarios;
- fijar dependencias/actions y mejorar el escaneo de artefactos;
- planificar el piloto sin ejecutarlo ni usar datos reales.

Algunas funciones de GitHub Environments/protecciones dependen de visibilidad y plan. Debe verificarse la disponibilidad real en Settings antes de considerarlas cerradas.

### Requiere Supabase Pro o superior

- **Leaked Password Protection**, ya habilitada en PROD Pro y obligatoria para conservar el gate;
- backups diarios administrados y retención de producción;
- un proyecto PROD en plan adecuado a disponibilidad/capacidad, sin pausas propias de Free;
- PITR si el RPO lo exige: es un add-on adicional sobre Pro y requiere compute compatible;
- un custom domain para la API Supabase solo si se decide usarlo: es add-on opcional, no es requisito para que el frontend tenga dominio propio.

La tarifa observada de Supabase parte de USD 25/mes para Pro; PITR y custom domain tienen cargos adicionales según retención/configuración. Confirmar precios y cuotas vigentes antes de contratar.

### Otros costos o dependencias externas posibles

- registro/renovación del dominio y DNS;
- Resend/SMTP según volumen, retención y soporte;
- hosting/CDN si GitHub Pages no cumple headers, SLA o control requerido;
- monitoring/on-call, almacenamiento de logs y pruebas de seguridad;
- operación de soporte, validación de identidad y comunicación a socios.

## 11. Pruebas ejecutadas en esta auditoría

| Comando | Resultado | Observación |
| --- | --- | --- |
| `pnpm test:prod-operations` | 12/12 PASS + contrato PASS | 20 archivos operativos, 17 alertas y 7 smoke checks no destructivos; evidencia Fases 3F/3G incluida. |
| `pnpm test:prod-hosting` | PASS | CSP/headers/cache PROD, ausencia de referencias DEV, template inactivo y release manifest determinístico/sin secretos. |
| `pnpm test:prod-artifact` | PASS | Build PROD sintético sin red; base `/`; 0 referencias DEV, 0 source maps y 0 material privilegiado. Casos negativos fail-closed cubiertos. |
| `pnpm test:edge-config` | 14/14 PASS + check estático PASS | Fail-closed, CORS exacto, selección segura de Secret API Key, restricciones PROD/DEV y 4 funciones PROD permitidas. |
| `pnpm test:migrations` | 18/18 PASS | Versiones/nombres/orden/checksums; 0 obsoletas; 3 buckets esperados; 0 objetos Storage copiados. |
| `pnpm test:recovery` | 13/13 PASS | Neutralidad, HMAC, expiración/reuso/intentos, rate limits, CORS, fail-closed y POST server-to-server. |
| `pnpm test:staging` | PASS | Incluyó migraciones, Edge config y guard de Auth LIVE; build 142 módulos; 5 archivos; 0 source maps; 0 clave privilegiada detectada. |
| `pnpm test:session` | 11/11 PASS | Concurrencia, errores transitorios, perfil ausente/inactivo, refresh, restauración, cambio de identidad y logout manual. |
| `pnpm test:push` | 47/47 PASS | Suscripción, logout/login, cambio de cuenta, payload, worker, tags, AAL2 del sender, provider policy, harness PROD cleanup-safe, lotes y cifrado. |
| `pnpm test:navigation` | 5/5 PASS | Visibilidad y protección Admin; logout conserva push y baja explícita desactiva. |
| `pnpm test:mfa` | 14/14 PASS | Socio AAL1, admin/superadmin AAL1 denegado, AAL2, gate, enrollment/challenge, refresh, cuenta inactiva, secreto no persistido y guard central. |

Fase 3H ejecutó una suite LIVE dedicada con dos identidades PROD inequívocamente sintéticas y confirmó MFA/lifecycle para admin y superadmin. Fase 3I repitió el patrón cleanup-safe para Web Push y dejó nuevamente 0 usuarios, 0 profiles, 0 factores MFA, 0 objetos Storage y 0 datos de negocio. Las matrices generales RLS 40/40 e integración 34/34 permanecen como evidencia DEV y deberán repetirse contra la infraestructura preproducción completa cuando B04 autorice Recovery PROD.

## 12. Restricciones preservadas

Fase 2B modificó el código versionado de Edge Functions, sus tests/validadores y documentación. Posteriormente, la parametrización fue desplegada y validada E2E solo en DEV con las cuatro funciones `ACTIVE`. Fase 2C registró esa evidencia documentalmente. Fase 2D agregó la ruta local/CI de build PROD sintético. Fase 2E versiona arquitectura, security headers/cache, release manifest, promoción, rollback, threat check, gobernanza y un template no ejecutable. Fase 2F agrega únicamente contratos repo-only: monitoring, alertas, SLI/SLO, incidentes/runbooks, propuesta RPO/RTO, restore drill, retención, rotación, smoke checks y cutover. El workflow staging solo valida esos archivos; no activa monitoring ni despliega PROD.

Fase 3A modificó exclusivamente la base PROD vacía mediante las 17 migraciones iniciales. Fase 3B cambió únicamente Auth PROD: política fuerte, HIBP y cierre de signup público; no creó usuarios ni perfiles. Fase 3C agregó el adaptador versionado de headers y creó el proyecto Cloudflare Pages. Fase 3D desplegó el artefacto `canonical-domain` en Production y actualizó únicamente `Site URL`/redirects de Auth PROD. Fase 3E configuró GitHub Environment/variables/secret por nombre, protegió `afucoa-v2` y validó promoción/rollback/restauración. Fase 3F aprobó el baseline RPO/RTO, restauró un backup físico real en un proyecto temporal, validó estructura y Storage sintético y eliminó el recurso. Fase 3G cerró B08 y B02. Fase 3H agregó la migración #18, MFA privilegiado TOTP y lifecycle. Fase 3I rotó la clave DEV expuesta, configuró VAPID/runtime Push PROD, desplegó solo dos Edge Functions, validó Web Push real y eliminó todo dato sintético. Fase 3J agregó la migración #19 y monitoring operativo sin datos reales; Fase 3K cerró B09 con cobertura externa combinada sin costo. B01, B02, B05, B06, B07, B08 y B09 están **CLOSED**; B03 sigue **PARTIAL** únicamente por Recovery PROD/B04 E2E; B04 y B10 permanecen **OPEN** y Pilot 01 sigue **PARKED**. AFUCOA V2 no está declarada completamente lista para producción.
