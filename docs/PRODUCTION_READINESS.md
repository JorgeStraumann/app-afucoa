# AFUCOA V2 — Production Readiness, fase 1

Fecha de corte: 5 de septiembre de 2026 (America/Montevideo)

Rama auditada: `afucoa-v2`

Baseline al iniciar la auditoría: `1044fcd91eb35abcfa9346d295e16cfb4be7141e`

Entorno observado: Supabase `AFUCOA V2 DEV` (`imiplnspvmsrsuikulwm`) y staging público

Tipo de revisión: solo lectura y documentación

## Dictamen ejecutivo

**AFUCOA V2 todavía no está habilitada para producción.** Se controlan diez gates y quedan **nueve blockers abiertos**. En Fase 3A, B01 quedó **CLOSED**: las 17 migraciones canónicas se aplicaron sin intervención desde una base `public` vacía al proyecto PROD aislado, el historial remoto conserva exactamente las versiones originales y la estructura coincide con el baseline esperado. B02 pasa a **PARTIAL** porque proyecto, organización Pro, región y separación DEV/PROD están confirmados; faltan gobernanza de accesos, responsables/facturación y validaciones operativas.

Los riesgos técnicos más inmediatos son:

1. El bootstrap canónico quedó demostrado, pero PROD todavía no tiene Auth endurecido, funciones, secrets, proveedores, dominio, hosting, monitoring ni restore probado.
2. El subproblema de vínculos explícitos al project ref y orígenes DEV quedó resuelto mediante configuración compartida fail-closed. La parametrización fue desplegada y validada E2E en DEV durante Fase 2C; B04/B05 continúan abiertos por infraestructura, secrets, dominio y E2E exclusivamente PROD.

La protección contra contraseñas filtradas está deshabilitada en DEV. Es un riesgo aceptado únicamente porque DEV está en Free; es un **BLOCKER PROD**, requiere Supabase Pro o superior y no debe intentarse silenciar mediante SQL o cambios de frontend.

## Alcance y evidencia

La auditoría incluyó:

- código, configuración versionada, migraciones, pruebas y documentación de `afucoa-v2`;
- consultas read-only al catálogo de Supabase DEV, Auth settings públicos, Storage, Edge Functions y Advisors;
- comparación entre las migraciones versionadas y el historial de migraciones registrado en DEV;
- ejecución local de las cuatro suites requeridas;
- revisión de documentación oficial de Supabase, GitHub, Resend y navegadores.

La auditoría inicial de Fase 1 no ejecutó migraciones, SQL de escritura, despliegues, cambios de settings, rotaciones, llamadas de recuperación real ni pruebas LIVE con datos. Este documento incorpora ahora la validación DEV posterior de Fase 2C descrita como evidencia operacional confirmada. El presente cierre fue exclusivamente documental y no ejecutó despliegues ni modificó Supabase.

## Blockers de producción

| ID | Blocker | Dependencia/costo | Criterio de cierre |
| --- | --- | --- | --- |
| B01 — **CLOSED** | Bootstrap canónico reproducible | Completado con Supabase CLI 2.116.0, sin Docker | 17/17 aplicadas desde base vacía; historial exacto; 28 tablas con RLS, 46 policies públicas, 11 Storage policies, 17 funciones definer y 3 buckets coinciden. Evidencia: `docs/PROD_BOOTSTRAP.md`. |
| B02 — **PARTIAL** | Proyecto PROD separado existe, pero su gobernanza operativa no está cerrada | Organización `AFUCOA PROD` en Pro; región `sa-east-1` | Proyecto/ref, plan, región y aislamiento confirmados. Falta aprobar responsables, acceso mínimo/facturación y completar controles operativos del proyecto. |
| B03 | Auth PROD no endurecido ni probado | Leaked Password Protection requiere Supabase Pro o superior | Configurar y evidenciar mínimo 12, cuatro clases, altas públicas cerradas, Leaked Password Protection habilitado, redirects exactos, sesiones y ciclo de altas/bajas. Resolver MFA para admin/superadmin o registrar una excepción de riesgo aprobada. |
| B04 — **ABIERTO** | Recuperación parametrizada y validada E2E en DEV, pero PROD no está lista | Dominio y proveedor de correo; costo según proveedor/volumen | Configurar/desplegar runtime PROD, usar email/dominio/secrets PROD, verificar titularidad de emails y aprobar E2E real PROD: solicitud neutra, recepción, cambio, login, expirado, reuso y límites. |
| B05 — **ABIERTO** | Web Push parametrizado y validado E2E en DEV, pero PROD no está lista | VAPID PROD, dominio HTTPS y observabilidad; costos posibles del hosting/monitoring | Configurar/desplegar runtime PROD, generar VAPID PROD nueva, validar dominio/scope/runtime final y completar E2E PROD multidispositivo, limpieza 404/410, ledger, retry y alertas. Nunca copiar VAPID DEV. |
| B06 | Dominio/hosting/frontend PROD no están definidos ni endurecidos | Dominio, DNS y posible hosting/CDN | Aprobar URL canónica HTTPS, base path, manifest, worker, redirects Auth, CORS y headers CSP/HSTS/Referrer/Permissions. Probar URL directa, refresh y actualización del worker. |
| B07 | Pipeline de producción, promoción y protecciones no existen | GitHub puede cubrir parte sin costo si el repositorio/plan lo permite | Crear en otra fase un workflow PROD separado, environment protegido, aprobación humana, concurrencia, artefacto inmutable y rollback. Verificar branch rules en GitHub; no desplegar V2 desde `main` mientras `main` represente V1. |
| B08 — **OPEN** | Contrato documental creado, pero backups/restore/RPO/RTO PROD no están operativos | Backups diarios en Pro; PITR es add-on y requiere Pro + compute compatible | Aprobar RPO/RTO, provisionar y evidenciar backups PROD de DB/Storage, y ejecutar el restore drill real aislado con tiempos observados. |
| B09 — **OPEN** | Modelo, matriz, SLI/SLO y runbooks creados, pero monitoring no está operativo | Puede comenzar gratis; proveedor, integración y retención pueden tener costo | Elegir/integrar proveedor, obtener métricas PROD, activar alertas, calibrar thresholds y ensayar guardia/escalamiento. |
| B10 — **OPEN** | Cutover gate documentado; alta/cutover de personas reales no aprobados | Operación y soporte; Pilot 01 permanece PARKED | Cerrar todos los blockers, aprobar datos/consentimiento/soporte y celebrar go/no-go. Reactivar Pilot solo mediante autorización posterior explícita; no migrar contraseñas V1. |

La cantidad de blockers es de lanzamiento, no la cantidad de avisos del Advisor. Un solo blocker abierto impide promover a producción.

## 1. Auth y seguridad

### Estado actual

- El login normaliza la cédula y usa el alias Auth `<cedula>@auth.afucoa.local`; el correo de contacto no es el identificador de Auth.
- La recuperación exige entre 12 y 72 caracteres, con mayúscula, minúscula, número y símbolo, tanto en frontend como en Edge Function.
- La documentación DEV registra mínimo 12, las cuatro clases y altas públicas deshabilitadas en Auth. Estos settings del Dashboard no son parte de las migraciones y deben verificarse nuevamente en PROD.
- `request-password-recovery` mantiene una respuesta pública neutra. El código es de ocho dígitos, HMAC-SHA-256, vence en 10 minutos, se invalida al emitir uno nuevo, tiene cinco intentos y uso único.
- Los rate limits actuales cubren IP, identidad, operación global y código. Los límites DEV son una base, no una capacidad de producción aprobada.
- DEV mantiene desplegada `dev-seed-test-users`, una función auxiliar que no está versionada en esta rama. Es exclusivamente DEV y debe quedar expresamente excluida del inventario/despliegue PROD.
- `session.js` serializa la reconstrucción de sesión; un error transitorio de perfil no invalida tokens. Un perfil confirmado ausente/inactivo sí cierra la sesión.
- El logout real de la aplicación conserva deliberadamente el logout global de Supabase. Los tests LIVE con cuentas DEV compartidas inyectan/usan `signOut({ scope: 'local' })`, y `tests/live-auth-isolation.test.mjs` impide reintroducir un logout global en esos archivos.
- Los roles `socio`, `admin` y `superadmin` se resuelven desde `profiles`/RPC, no desde metadata editable. La navegación oculta Administración al socio, pero la autorización efectiva sigue siendo RLS/RPC y `adminOnly`.
- Las 28 tablas del esquema `public` observado tienen RLS habilitado. Se observaron 46 políticas públicas y 11 políticas de Storage. No hay vistas públicas.
- Todas las foreign keys públicas observadas tienen un índice utilizable.

### Requisitos de salida

- Habilitar **Leaked Password Protection** en Auth PROD. Supabase documenta esta comprobación como disponible en Pro y superiores. DEV Free conserva el warning de forma consciente; no se elimina con SQL ni con código de aplicación.
- Revalidar en el Dashboard PROD la política de contraseña, signup cerrado, redirects, expiración/refresh de sesión y protección contra abuso.
- Definir el segundo factor para cuentas privilegiadas. La recomendación es MFA obligatorio para admin/superadmin; si no se implementa antes del go-live, se necesita una excepción de riesgo explícita con controles compensatorios y fecha de remediación.
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

### Requisitos PROD

- Servir frontend, manifest y worker por HTTPS. Registrar el worker desde la ruta base final y comprobar que su scope cubra toda la aplicación.
- Si el dominio final está en raíz, construir con `AFUCOA_PUBLIC_BASE=/` y comprobar `/push-sw.js`; si vive bajo subruta, scope/start_url/íconos deben usar la misma base.
- Generar VAPID PROD y registrar su rotación. Rotar VAPID normalmente exige volver a suscribir dispositivos; planificar comunicación y ventana.
- [x] Eliminar los defaults DEV de `_shared/push-http.ts`, centralizar origins/URL/clave en configuración fail-closed y validar el despliegue E2E en DEV. PROD continúa pendiente.
- Revalidar: permiso por gesto explícito, Chrome/Edge/Firefox, instalación iOS compatible, cierre de app, refresh, logout/login, cambio de cuenta, dispositivo inválido y kill switch.
- Alertar por tasa de `failed`, 404/410, claims `sending` estancados, límite de lotes, timeout, ledger incompleto y discrepancia entre destinatarios internos y deliveries.
- Definir retención/purga de endpoints inactivos y ledger, preservando auditoría mínima y privacidad.

Los límites actuales (20 dispositivos activos por perfil, 40 por invocación, hasta cinco lotes desde frontend, concurrencia 4, timeout 8 s y TTL 300 s) deben someterse a capacidad y abuso antes de PROD.

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
- No existe workflow de producción, por diseño. La configuración remota de branch protection no está versionada y no pudo verificarse desde la CLI local; por lo tanto permanece pendiente, aunque el código no muestre un incumplimiento.

### Diseño requerido para un workflow PROD futuro

- No clonar el workflow cambiando solo una URL. Crear un workflow distinto con validador PROD, environment separado y sin defaults DEV.
- Promover un commit/artefacto inmutable que ya pasó staging, mediante `workflow_dispatch` o tag/release aprobado; no reconstruir desde una referencia móvil sin evidencia.
- Proteger `afucoa-v2` y la futura referencia de release con PR review/status checks. Mientras `main` sea V1, no usar un merge automático a `main` como mecanismo de producción de V2.
- Usar un GitHub Environment de producción con aprobación requerida, restricción de branches/tags, no self-review si el plan lo permite, y concurrencia que impida dos despliegues simultáneos.
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
- La cadena local contiene ahora las 17 versiones/nombres canónicos observados en DEV. `MANIFEST.json` conserva los SHA-256 normalizados obtenidos de `supabase_migrations.schema_migrations.statements[]`, y `pnpm test:migrations` informa 17/17. Las dos versiones obsoletas `20260831*` fueron retiradas.
- La igualdad comprobada es de SQL normalizado: CRLF/CR a LF y exactamente un LF terminal; no se afirma igualdad byte-a-byte con la representación interna de Supabase.
- Fase 3A aplicó la cadena con Supabase CLI 2.116.0 sobre PROD vacío, sin Docker. El historial remoto quedó 17/17 y el resultado estructural coincide con el baseline esperado: 28 tablas públicas con RLS, 46 policies públicas, 11 Storage policies, 17 funciones `SECURITY DEFINER` y 3 buckets. Ver `docs/PROD_BOOTSTRAP.md`.

### Requisitos PROD

- Reconstruir y verificar migraciones en un proyecto vacío; comparar esquema, funciones, grants, policies, triggers, índices y buckets contra la especificación, no contra datos DEV.
- Ejecutar migraciones con un rol de despliegue controlado y guardar evidencia. Prohibir cambios manuales no versionados; si ocurre una emergencia, reconciliarla inmediatamente.
- Mantener privados `documents-private` y `request-files`; probar rechazo anónimo/ajeno y URLs firmadas. Auditar que `public-media` solo contenga material apto para exposición pública.
- Confirmar límites de archivo también server-side, MIME real/magic bytes, nombres/paths opacos, antivirus o proceso de cuarentena según evaluación de riesgo.
- Definir retención, borrado legal, exportación y restauración de objetos junto con la DB; un backup de Postgres no restaura por sí solo los objetos de Storage.
- Aprobar RPO/RTO. Supabase documenta backups diarios en planes pagos; en Free no hay backups automáticos. PITR es un add-on para Pro y superiores con costo adicional y requisitos de compute. Ensayar un restore real antes del go-live.

Referencias: [Supabase — Database Backups](https://supabase.com/docs/guides/platform/backups) y [Supabase — Pricing](https://supabase.com/pricing).

## 7. Dominio y frontend

Checklist para pasar de `https://jorgestraumann.github.io/app-afucoa/` al dominio final:

- [ ] Elegir la URL canónica y decidir raíz (`/`) o subruta estable antes de emitir manifest/worker.
- [ ] Configurar DNS, HTTPS y renovación; forzar HTTPS. GitHub Pages soporta HTTPS en dominios personalizados correctamente configurados.
- [ ] Construir con `VITE_AFUCOA_MODE=supabase`, URL PROD, publishable key PROD, dominio de alias aprobado y `AFUCOA_PUBLIC_BASE` final.
- [ ] Verificar que HTML, assets, manifest, iconos y worker no contienen `/app-afucoa/` ni project refs DEV.
- [ ] Probar navegación hash, deep link compartido, refresh, back/forward, apertura desde push y actualización del service worker.
- [ ] Configurar en Supabase PROD `Site URL` y redirects exactos. Configurar CORS de Edge Functions solo para el origen final y orígenes operativos explícitos.
- [ ] Definir CSP al menos para `default-src`, `script-src`, `style-src`, `img-src`, `font-src`, `connect-src`, `worker-src` y `manifest-src`, incluyendo exclusivamente Supabase PROD y proveedores necesarios.
- [ ] Añadir/verificar HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y protección de framing (`frame-ancestors`). El workflow Pages actual no configura estos headers; si el hosting elegido no ofrece control, usar un CDN/proxy/hosting que lo permita o aprobar controles equivalentes.
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

- [x] Reconstruir la cadena canónica de 17 migraciones y documentar checksums/orden.
- [x] Aplicar la cadena desde cero en el proyecto PROD vacío mediante CLI, conservar las 17 versiones y comparar tablas, RLS, policies, funciones y Storage con el baseline esperado.
- [x] Parametrizar recuperación y push para entornos explícitos; en modo PROD, fallar cerrado si URL/origen/secreto no están presentes. Desplegado y validado E2E únicamente en DEV.
- [x] Crear un inventario permitido de Edge Functions que excluya `dev-seed-test-users` de PROD.
- [x] Crear validadores y build sintético de artefacto PROD que rechacen project ref/origen/base/secrets DEV, sin deploy. Ver `docs/PRODUCTION_BUILD.md`.
- [x] Definir arquitectura y requisitos de hosting PROD, sin provisionar proveedor ni dominio. Ver `docs/PRODUCTION_HOSTING.md`.
- [x] Definir política canónica CSP/security headers/cache y validarla localmente con `test:prod-hosting`.
- [x] Definir promoción por SHA/artifact/manifest inmutable y proveer un template no ejecutable fuera de `.github/workflows/`.
- [x] Definir rollback frontend por redeploy del artefacto aprobado anterior, sin recompilar. Ver `docs/PRODUCTION_ROLLBACK.md`.
- [x] Documentar gobernanza GitHub requerida, manteniendo Settings y branches sin cambios. Ver `docs/GITHUB_PRODUCTION_GOVERNANCE.md`.
- [ ] Provisionar dominio/hosting real y validar headers/cache/worker sobre HTTPS. B06 continúa abierto.
- [ ] Crear workflow PROD real y activar rulesets/branch protection/Environment approval. B07 continúa abierto.
- [x] Definir modelo de monitoring, matriz declarativa de 17 alertas, SLI/SLO provisionales y health checks sintéticos no destructivos. B09 permanece OPEN hasta integración, métricas, activación y calibración.
- [x] Crear incident response y runbooks de frontend, Auth, DB/Storage, recovery, push, Edge, secrets y DNS/TLS.
- [x] Proponer RPO/RTO con estado `PENDING AFUCOA APPROVAL`, estrategia separada de DB/Storage/Auth/config/secrets/artifacts y restore drill futuro de 12 pasos. B08 permanece OPEN.
- [x] Crear borrador de retención sin purga automática, runbook de rotación y checklist de cutover. Todas las decisiones institucionales siguen pendientes.
- [ ] Aprobar RPO/RTO, activar backups PROD y ejecutar restore drill real aislado.
- [ ] Integrar proveedor de monitoring, activar/calibrar alertas y ensayar respuesta operativa.

### Fase 3 — infraestructura PROD vacía

- [x] Provisionar Supabase PROD Pro separado y confirmar región/aislamiento. Accesos mínimos, responsables y billing alerts siguen pendientes en B02.
- [x] Aplicar la cadena aprobada a PROD vacío y validar estructura/historial sin usuarios ni datos. Smoke/RLS con usuarios sintéticos quedan para una fase posterior.
- [ ] Configurar Auth PROD: política, signup cerrado, leaked password protection, redirects y decisión MFA.
- [ ] Crear VAPID PROD y secrets Edge PROD; desplegar funciones parametrizadas.
- [ ] Configurar proveedor/email PROD, dominio, SPF/DKIM/DMARC y alertas.
- [ ] Configurar backup/PITR según RPO/RTO y ensayar restore.
- [ ] Crear domain/hosting y pipeline PROD protegido; publicar solo una pantalla cerrada o entorno de preproducción sin personas reales.

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

- **Leaked Password Protection**, obligatoria para el go-live;
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
| `pnpm test:prod-hosting` | PASS | CSP/headers/cache PROD, ausencia de referencias DEV, template inactivo y release manifest determinístico/sin secretos. |
| `pnpm test:prod-artifact` | PASS | Build PROD sintético sin red; base `/`; 0 referencias DEV, 0 source maps y 0 material privilegiado. Casos negativos fail-closed cubiertos. |
| `pnpm test:edge-config` | 12/12 PASS + check estático PASS | Fail-closed, CORS exacto, restricciones PROD/DEV, secreto no enumerable y 4 funciones PROD permitidas. |
| `pnpm test:migrations` | 17/17 PASS | Versiones/nombres/orden/checksums; 0 obsoletas; 3 buckets esperados; 0 objetos Storage copiados. |
| `pnpm test:recovery` | 13/13 PASS | Neutralidad, HMAC, expiración/reuso/intentos, rate limits, CORS, fail-closed y POST server-to-server. |
| `pnpm test:staging` | PASS | Incluyó guard de Auth LIVE; build 163 módulos; 5 archivos; 0 source maps; clave publishable configurada; 0 clave privilegiada detectada. |
| `pnpm test:session` | 11/11 PASS | Concurrencia, errores transitorios, perfil ausente/inactivo, refresh, restauración, cambio de identidad y logout manual. |
| `pnpm test:push` | 44/44 PASS | Suscripción, logout/login, cambio de cuenta, payload, worker, tags, provider policy, lotes y cifrado. |
| `pnpm test:navigation` | 5/5 PASS | Visibilidad y protección Admin; logout conserva push y baja explícita desactiva. |

No se ejecutaron suites LIVE porque esta fase no autoriza cambios/datos y no eran parte de los cuatro comandos solicitados. La evidencia versionada más reciente conserva RLS 40/40 e integración 34/34; deben repetirse contra infraestructura vacía/preproducción antes de un go-live.

## 12. Restricciones preservadas

Fase 2B modificó el código versionado de Edge Functions, sus tests/validadores y documentación. Posteriormente, la parametrización fue desplegada y validada E2E solo en DEV con las cuatro funciones `ACTIVE`. Fase 2C registró esa evidencia documentalmente. Fase 2D agregó la ruta local/CI de build PROD sintético. Fase 2E versiona arquitectura, security headers/cache, release manifest, promoción, rollback, threat check, gobernanza y un template no ejecutable. Fase 2F agrega únicamente contratos repo-only: monitoring, alertas, SLI/SLO, incidentes/runbooks, propuesta RPO/RTO, restore drill, retención, rotación, smoke checks y cutover. El workflow staging solo valida esos archivos; no activa monitoring ni despliega PROD.

Fase 3A modificó exclusivamente la base PROD vacía mediante las 17 migraciones versionadas: 28 tablas públicas con RLS, funciones/policies/índices esperados y tres buckets sin objetos. No se modificaron Edge Functions, Auth, secrets, VAPID, Resend, DNS, dominio, Repository Settings, branch protection, Environments, `main`, V1, Pilot 01, usuarios ni datos reales. B01 está **CLOSED**; B02 está **PARTIAL**; B03–B10 permanecen **OPEN** y Pilot 01 sigue **PARKED**. AFUCOA V2 no está declarada lista para producción.
