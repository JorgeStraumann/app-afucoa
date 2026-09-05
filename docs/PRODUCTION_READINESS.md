# AFUCOA V2 — Production Readiness, fase 1

Fecha de corte: 5 de septiembre de 2026 (America/Montevideo)

Rama auditada: `afucoa-v2`

Baseline al iniciar la auditoría: `1044fcd91eb35abcfa9346d295e16cfb4be7141e`

Entorno observado: Supabase `AFUCOA V2 DEV` (`imiplnspvmsrsuikulwm`) y staging público

Tipo de revisión: solo lectura y documentación

## Dictamen ejecutivo

**AFUCOA V2 todavía no está habilitada para producción.** La base funcional de DEV es sólida —28/28 tablas públicas con RLS, 40/40 pruebas RLS documentadas, 34/34 de integración documentadas, sesiones 11/11, Web Push 44/44 y navegación 5/5—, pero existen **10 blockers de lanzamiento**. Ninguno requiere alterar DEV para ser identificado y ninguno fue corregido en esta fase.

Los dos riesgos técnicos más inmediatos son:

1. `supabase/migrations/` no contiene hoy la cadena inicial completa que ya existe en DEV; por lo tanto, no se ha demostrado que un proyecto PROD vacío pueda reconstruirse de forma determinística.
2. Las Edge Functions de recuperación y Web Push contienen vínculos explícitos al project ref y a los orígenes de DEV/staging. Antes de desplegarlas en PROD deben parametrizarse y validarse sin aceptar DEV como fallback de producción.

La protección contra contraseñas filtradas está deshabilitada en DEV. Es un riesgo aceptado únicamente porque DEV está en Free; es un **BLOCKER PROD**, requiere Supabase Pro o superior y no debe intentarse silenciar mediante SQL o cambios de frontend.

## Alcance y evidencia

La auditoría incluyó:

- código, configuración versionada, migraciones, pruebas y documentación de `afucoa-v2`;
- consultas read-only al catálogo de Supabase DEV, Auth settings públicos, Storage, Edge Functions y Advisors;
- comparación entre las migraciones versionadas y el historial de migraciones registrado en DEV;
- ejecución local de las cuatro suites requeridas;
- revisión de documentación oficial de Supabase, GitHub, Resend y navegadores.

No se ejecutaron migraciones, SQL de escritura, despliegues, cambios de settings, rotaciones, llamadas de recuperación real ni pruebas LIVE con datos. Los settings no visibles desde el repositorio o desde endpoints públicos se consideran **pendientes de verificación**, no aprobados por inferencia.

## Blockers de producción

| ID | Blocker | Dependencia/costo | Criterio de cierre |
| --- | --- | --- | --- |
| B01 | Cadena de migraciones no reproducible | Trabajo técnico; puede hacerse sin pagar | Reconstruir la secuencia canónica completa, conciliar nombres/checksums con DEV y levantar un proyecto desechable desde cero con esquema, grants, RLS, buckets y funciones esperadas. No copiar un dump ad hoc como sustituto de migraciones. |
| B02 | Proyecto Supabase PROD separado y plan de producción no provisionados/validados | Supabase Pro o superior; desde USD 25/mes según tarifa vigente | Crear un proyecto nuevo, con organización/región/plan aprobados y sin usuarios, datos, claves ni secretos DEV. Confirmar responsables, acceso mínimo y facturación. |
| B03 | Auth PROD no endurecido ni probado | Leaked Password Protection requiere Supabase Pro o superior | Configurar y evidenciar mínimo 12, cuatro clases, altas públicas cerradas, Leaked Password Protection habilitado, redirects exactos, sesiones y ciclo de altas/bajas. Resolver MFA para admin/superadmin o registrar una excepción de riesgo aprobada. |
| B04 | Recuperación de acceso PROD no está lista | Dominio y proveedor de correo; costo según proveedor/volumen | Quitar dependencia DEV del código/configuración, usar secretos PROD, verificar dominio/remitente y titularidad de emails, y aprobar E2E real: solicitud neutra, recepción, cambio, login, expirado, reuso y límites. |
| B05 | Web Push PROD no está lista | VAPID PROD, dominio HTTPS y observabilidad; costos posibles del hosting/monitoring | Parametrizar project ref/orígenes, generar VAPID PROD nueva, validar scope/origen final y completar E2E multidispositivo, limpieza 404/410, ledger, retry y alertas. Nunca copiar VAPID DEV. |
| B06 | Dominio/hosting/frontend PROD no están definidos ni endurecidos | Dominio, DNS y posible hosting/CDN | Aprobar URL canónica HTTPS, base path, manifest, worker, redirects Auth, CORS y headers CSP/HSTS/Referrer/Permissions. Probar URL directa, refresh y actualización del worker. |
| B07 | Pipeline de producción, promoción y protecciones no existen | GitHub puede cubrir parte sin costo si el repositorio/plan lo permite | Crear en otra fase un workflow PROD separado, environment protegido, aprobación humana, concurrencia, artefacto inmutable y rollback. Verificar branch rules en GitHub; no desplegar V2 desde `main` mientras `main` represente V1. |
| B08 | Backups, restore, RPO y RTO PROD no están aprobados ni ensayados | Backups diarios en Pro; PITR es add-on y requiere Pro + compute compatible | Definir RPO/RTO, retención y responsables; habilitar backup acorde; ensayar restore en un proyecto aislado y documentar evidencia/tiempo. |
| B09 | Monitoring y respuesta operativa incompletos | Puede comenzar gratis; servicio y retención pueden tener costo | Crear alertas/runbooks para Auth, DB, Storage, Edge, email y push; definir SLO, dueños, escalamiento, revisión de ledger y eventos atascados. |
| B10 | Alta/cutover de personas reales no aprobados | Operación y soporte; Pilot 01 sigue suspendido | Mantener Pilot suspendido hasta aprobar consentimiento, validación de identidad/email, lote, reporte, rollback y soporte. Ejecutar primero piloto limitado y criterios go/no-go; no migrar contraseñas V1. |

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

- VAPID DEV está configurado server-side y el E2E real fue confirmado.
- Logout conserva la suscripción; no ejecuta `unregister_my_push_subscription`.
- Al cambiar de cuenta, la suscripción se reconcilia usando RPC que deriva la identidad del JWT; el frontend no elige `profile_id`.
- La baja explícita sigue siendo la única acción que desactiva.
- El payload cifrado contiene solo `target_path`, `profile_id` y `notification_id`, todos datos técnicos/UUID opacos. Título y body son genéricos; no hay PII.
- Distintas notificaciones usan tags distintos; un retry de la misma conserva el tag y no se usa `renotify`.
- Los endpoints 404/410 se desactivan, 5xx conservan el dispositivo y el ledger limita reintentos. Web Push no garantiza exactly-once.

### Requisitos PROD

- Servir frontend, manifest y worker por HTTPS. Registrar el worker desde la ruta base final y comprobar que su scope cubra toda la aplicación.
- Si el dominio final está en raíz, construir con `AFUCOA_PUBLIC_BASE=/` y comprobar `/push-sw.js`; si vive bajo subruta, scope/start_url/íconos deben usar la misma base.
- Generar VAPID PROD y registrar su rotación. Rotar VAPID normalmente exige volver a suscribir dispositivos; planificar comunicación y ventana.
- Eliminar los defaults DEV de `_shared/push-http.ts` y de los orígenes permitidos mediante configuración validada que falle cerrada si falta PROD. Esto es trabajo de una fase posterior.
- Revalidar: permiso por gesto explícito, Chrome/Edge/Firefox, instalación iOS compatible, cierre de app, refresh, logout/login, cambio de cuenta, dispositivo inválido y kill switch.
- Alertar por tasa de `failed`, 404/410, claims `sending` estancados, límite de lotes, timeout, ledger incompleto y discrepancia entre destinatarios internos y deliveries.
- Definir retención/purga de endpoints inactivos y ledger, preservando auditoría mínima y privacidad.

Los límites actuales (20 dispositivos activos por perfil, 40 por invocación, hasta cinco lotes desde frontend, concurrencia 4, timeout 8 s y TTL 300 s) deben someterse a capacidad y abuso antes de PROD.

## 4. Email y recuperación

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
- La cadena local contiene migraciones desde `202608310001_*` y luego `20260902013551_*`, pero el historial remoto comienza con nueve pasos `20260901012911` a `20260901021400` que no tienen una representación uno-a-uno en `supabase/migrations/`. Los SQL monolíticos `schema-v2.sql`, `security-v2.sql`, `storage-v2.sql` y `admin-v2.sql` son referencias útiles, pero no sustituyen una cadena canónica ensayada.

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

- [ ] Reconstruir la cadena canónica de migraciones y documentar checksums/orden.
- [ ] Levantar un proyecto Supabase desechable/local desde cero; comparar esquema, RLS, grants, funciones, índices y Storage.
- [ ] Parametrizar recuperación y push para entornos explícitos; en modo PROD, fallar cerrado si URL/origen/secreto no están presentes.
- [ ] Crear un inventario permitido de Edge Functions que excluya `dev-seed-test-users` de PROD.
- [ ] Crear validadores de artefacto PROD que rechacen project ref/origen/base/secrets DEV.
- [ ] Definir arquitectura de dominio/hosting, CSP/headers, workflow PROD y rollback, sin desplegar todavía.
- [ ] Crear runbooks, matriz de monitoring, RPO/RTO, retención y prueba de restore.

### Fase 3 — infraestructura PROD vacía

- [ ] Contratar/provisionar Supabase PROD Pro separado, con accesos mínimos y billing alerts.
- [ ] Aplicar la cadena aprobada a PROD vacío y ejecutar smoke/RLS con usuarios sintéticos.
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
| `pnpm test:staging` | PASS | Incluyó guard de Auth LIVE; build 163 módulos; 5 archivos; 0 source maps; clave publishable configurada; 0 clave privilegiada detectada. |
| `pnpm test:session` | 11/11 PASS | Concurrencia, errores transitorios, perfil ausente/inactivo, refresh, restauración, cambio de identidad y logout manual. |
| `pnpm test:push` | 44/44 PASS | Suscripción, logout/login, cambio de cuenta, payload, worker, tags, provider policy, lotes y cifrado. |
| `pnpm test:navigation` | 5/5 PASS | Visibilidad y protección Admin; logout conserva push y baja explícita desactiva. |

No se ejecutaron suites LIVE porque esta fase no autoriza cambios/datos y no eran parte de los cuatro comandos solicitados. La evidencia versionada más reciente conserva RLS 40/40 e integración 34/34; deben repetirse contra infraestructura vacía/preproducción antes de un go-live.

## 12. Restricciones preservadas

Esta fase no modificó código funcional, SQL, migraciones, Edge Functions, Supabase DEV/PROD, Auth, secrets, VAPID, Resend, DNS, Pages, `main`, V1, Pilot 01 ni datos. El único archivo creado es este documento. Pilot 01 continúa suspendido.
