# AFUCOA V2 — Validación pre-go-live PROD (Fase 4A)

Fecha de cierre: 21 de septiembre de 2026, America/Montevideo (`2026-09-22T00:19:56Z`)

Rama: `afucoa-v2`

SHA candidato inicial y revisado: `1573a3c386df93902095ec74f384fcd187da541a`

Supabase PROD: `rywdochyzhgfaymrmxek`

Frontend público: `https://afucoa-v2-prod.pages.dev`

## Dictamen

**NO-GO.** La revisión pública encontró un blocker funcional reproducible en Administración → Propuestas. La consulta real falla con `PGRST201` porque el embed `profile:profiles(...)` no identifica la FK y PostgREST reconoce más de una ruta entre `proposals` y `profiles`: la relación directa de autor y la relación muchos-a-muchos vía `proposal_supports`. La pantalla muestra `No se pudieron cargar las propuestas.` y conserva filas locales de fallback; esas filas no constituyen evidencia de datos live.

Fase 4A fue audit-only. No se corrigió el defecto, no se cambió SQL, no se desplegó nada y no se creó un commit. Debe abrirse una fase funcional acotada para desambiguar la relación —la FK PROD confirmada es `proposals_profile_id_fkey`—, agregar una regresión y repetir la validación antes de reconsiderar el go-live.

B01–B09 conservan su evidencia histórica `CLOSED`. B10 permanece `OPEN`. Pilot 01 continúa `PARKED` y no se autoriza incorporar personas reales.

## Resultado por área

| Área | Resultado de Fase 4A | Evidencia / límite |
| --- | --- | --- |
| Baseline Git | **PASS** | Rama `afucoa-v2`, candidato local y remoto `1573a3c...`; el árbol estaba limpio antes de agregar exclusivamente esta documentación/evidencia. |
| Suites locales obligatorias | **PASS** | Migraciones 19/19; operaciones PROD 12/12; hosting 18/18; artifact 16/16; edge-config 14/14; recovery 18/18; push 47/47; session 11/11; navigation 5/5; MFA 14/14; monitoring 7/7; staging PASS. |
| Infraestructura pública | **PASS** | Auditoría pública `13/13 PASS`, cuatro Edge Functions PROD `ACTIVE`, 0 Issues abiertos con label `production-monitoring`. Último run observado: `35668648021`, SUCCESS sobre el SHA candidato. |
| MFA/AAL2 PROD sintético | **PASS real** | Admin y superadmin: AAL1 rechazado, AAL2 aceptado, relogin/challenge y lifecycle/revocación PASS. Cleanup a cero. |
| Recovery PROD revalidación | **INCOMPLETA** | Solicitud neutra PASS y Brevo aceptó el envío con `delivery_status=sent`. Se canceló antes de leer el código porque el control de Chrome no pudo verificar la URL de Gmail. No hubo procedimiento alternativo manual; cleanup a cero. B04 conserva su E2E histórico aprobado. |
| Web Push PROD revalidación | **BRECHA DE EVIDENCIA** | El harness confirmó fail-closed server-side: sin JWT denegado, socio limitado a config, socio send denegado, admin AAL1 denegado, admin AAL2 permitido, origin PROD permitido y staging/hostil denegados. En el navegador integrado el permiso figuró bloqueado y no se pudo repetir activación/toast físico. Cleanup a cero. B05 conserva su E2E físico histórico. |
| RLS / integración PROD general | **NO REEJECUTADA** | `rls-live-check.mjs` y `supabase-integration-live.mjs` dependen de cuentas preexistentes/compartidas y no tienen creación + cleanup sintético PROD propio. Ejecutarlas habría violado el alcance. RLS 40/40 e integración 34/34 permanecen como evidencia histórica DEV, no como PASS PROD actual. |
| Revisión responsive socio | **PASS real** | 390×844, 768×1024 y 1440×900; rutas principales autenticadas sin redirect, overflow de body, error de consola ni error de página. |
| Revisión responsive admin | **BLOCKER PROD** | Shell/rutas administrativas se renderizan en las tres resoluciones, pero Administración → Propuestas falla al cargar la consulta live con `PGRST201`. |
| Advisors | **SIN CAMBIOS** | Hallazgos clasificados abajo; no se alteraron funciones `SECURITY DEFINER`, políticas ni índices. |
| Cleanup final | **PASS** | Todos los conteos exigidos quedaron en 0. |

## Revisión funcional y visual pública

### Socio

Con una identidad inequívocamente sintética se revisaron login, Inicio, Carné/QR, Convenios, Trámites, Noticias/Agenda, Documentos/Biblioteca, Propuestas, Notificaciones y Mi Cuenta en 390×844, 768×1024 y 1440×900. La navegación permaneció autenticada, no presentó overflow horizontal del body ni errores de consola/página.

Mensajes/archivos y descarga PDF fueron inspeccionados hasta donde permiten los estados sintéticos disponibles; no se creó contenido de negocio adicional para fabricar cobertura.

Capturas:

- [Mobile socio — 390×844](evidence/prod-pre-go-live-2026-09-20/mobile-socio-home.png)
- [Tablet socio — 768×1024](evidence/prod-pre-go-live-2026-09-20/tablet-socio-home.png)
- [Desktop socio — 1440×900](evidence/prod-pre-go-live-2026-09-20/desktop-socio-home.png)

### Administración

Se autenticó un admin sintético con desafío TOTP real y AAL2. Se revisaron Dashboard, Socios, Trámites, Convenios, Contenido, Documentos, Propuestas, Notificaciones, Auditoría y Configuración en las tres resoluciones. Los shells y layouts no presentaron overflow del body.

El error de Propuestas se observó en la URL pública y en consola:

`PGRST201: Could not embed because more than one relationship was found for 'proposals' and 'profiles'`.

El código versionado usa:

`profile:profiles(first_name,last_name)`

La consulta read-only al catálogo PROD confirmó `proposals_profile_id_fkey`. El diseño también tiene `proposal_supports(profile_id)`, que habilita una segunda ruta detectada por PostgREST. La remediación probable debe hacer explícita la FK directa, sin relajar RLS.

Capturas:

- [Mobile admin — 390×844](evidence/prod-pre-go-live-2026-09-20/mobile-admin-dashboard.png)
- [Tablet admin — 768×1024](evidence/prod-pre-go-live-2026-09-20/tablet-admin-dashboard.png)
- [Desktop admin — 1440×900](evidence/prod-pre-go-live-2026-09-20/desktop-admin-dashboard.png)
- [Blocker Administración → Propuestas](evidence/prod-pre-go-live-2026-09-20/desktop-admin-propuestas-blocker.png)

## Advisors PROD

### BLOCKER PROD

- Ningún finding del Advisor se reclasificó como blocker.
- El blocker actual proviene de la consulta funcional `listAdminProposals()` y no de un warning del Advisor.

### ACCEPTED / INTENTIONAL

- `rls_enabled_no_policy` en `notification_push_deliveries` y `password_recovery_rate_limits`: tablas server-only, sin acceso directo de clientes.
- Ejecución anónima de las funciones `SECURITY DEFINER` `production_health` y `verify_membership_token`: endpoints públicos deliberadamente mínimos y previamente revisados.
- Ejecución autenticada de 19 funciones `SECURITY DEFINER`: RPCs de aplicación con controles de identidad, ownership, rol o AAL2. No se modifican solo para silenciar warnings.

### REVIEW POST-GO-LIVE

- 19 índices sin uso: PROD está vacío y todavía no existe tráfico representativo.
- 13 grupos de políticas permisivas múltiples: revisar con métricas reales, sin consolidar a ciegas.
- `auth_db_connections_absolute`: revisar capacidad/concurrencia antes y después del cutover.

### INFO

- Los avisos de índices y políticas son señales de tuning, no autorización para cambios en esta fase.
- El estado observado no modifica la clasificación B01–B09 ni reemplaza B10.

## Auth y configuración verificada

- Signup público cerrado.
- Autoconfirm deshabilitado y usuarios anónimos deshabilitados.
- Política documentada: mínimo 12 caracteres y cuatro clases; Leaked Password Protection activa en PROD Pro.
- Legacy API keys deshabilitadas y signing key anterior revocada según el cierre aprobado previo.
- MFA privilegiado AAL2 validado con admin y superadmin sintéticos.
- No se reutilizó legacy `service_role`; la clave moderna se manejó solo en memoria durante los harnesses y fue retirada del proceso al terminar.

## Cleanup final PROD

Consulta final read-only:

| Recurso | Conteo |
| --- | ---: |
| Auth users | 0 |
| MFA factors | 0 |
| Profiles | 0 |
| Recovery codes | 0 |
| Recovery rate limits | 0 |
| Push devices sintéticos | 0 |
| Push deliveries sintéticos | 0 |
| Storage objects sintéticos | 0 |
| Requests | 0 |
| Proposals | 0 |
| Request messages | 0 |
| Notifications sintéticas | 0 |

No quedaron identidades, factores, objetos ni datos de negocio sintéticos activos.

## Riesgos y decisiones pendientes

Riesgos aceptados o ya conocidos:

- GitHub Actions schedule es best-effort y no ofrece SLA.
- UptimeRobot FREE observa desde una región.
- Web Push no garantiza exactly-once.
- La revalidación Fase 4A de Recovery y Push físico quedó incompleta; existe evidencia E2E histórica, pero no se presenta como un PASS nuevo.
- Falta una matriz general RLS/integración PROD cleanup-safe; la ausencia se registra como brecha de evidencia.

Decisiones humanas necesarias, en orden:

1. Autorizar una fase funcional acotada para corregir el embed ambiguo de Administración → Propuestas y agregar regresión.
2. Aprobar la revalidación pública posterior: socio/admin, RLS relevante, tres resoluciones y workflows sobre el SHA corregido.
3. Celebrar el gate institucional B10 y decidir `GO`, `GO CON CONDICIONES` o `NO-GO` con soporte, datos y operación aprobados.
4. Mantener Pilot 01 `PARKED` hasta que B10 concluya en GO explícito.

## Integridad del alcance

No se modificaron `main`, V1, Supabase DEV, Pilot 01, datos reales, Cloudflare, Edge Functions, Auth settings, secretos, DNS ni infraestructura. No se ejecutó deploy PROD. Al detectarse el blocker funcional tampoco se hizo commit, push ni se dispararon workflows nuevos; el SHA candidato permanece sin cambios.

El último workflow staging ya existente para el SHA candidato es el run `34421549074`, SUCCESS. El monitor PROD continuó por su schedule normal y el último run observado fue `35668648021`, SUCCESS. Ninguno fue disparado por esta auditoría.
