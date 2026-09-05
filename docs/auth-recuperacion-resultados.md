# Cierre técnico Auth — 3 de septiembre de 2026 (Uruguay)

Alcance: rama `afucoa-v2`, Supabase DEV `imiplnspvmsrsuikulwm`. Sin importaciones reales, sin cambios en main, V1 o producción.

Actualización Fase 2C: la parametrización fail-closed de Fase 2B fue desplegada y validada E2E únicamente en DEV. Este cierre registra la evidencia confirmada sin volver a desplegar, modificar Supabase ni publicar valores de configuración o secretos.

## Cambios

- Recuperación conserva las dos Edge Functions existentes: `request-password-recovery` v23 y `confirm-password-recovery` v23, ambas `ACTIVE` en DEV.
- CORS, cuerpos limitados, respuesta neutra, generación criptográfica, HMAC, vencimiento de 10 minutos, cinco intentos, invalidación y consumo atómicos.
- Bloqueo compartido por perfil, vinculación al Auth original, reloj posterior al bloqueo y límites IP/identidad/global.
- Adaptador Resend server-side; errores de entrega invalidan el código. Si Auth falla después del consumo, se debe solicitar otro código.
- Formulario de 8 dígitos, política de 12–72 caracteres, estados accesibles y corrección de callback bajo bloqueo de Auth.
- La verificación visual pública detectó clases `auth-*` sin estilos. Recuperación reutiliza ahora `login-page`, `login-card` y `form-stack` del acceso aprobado, sin rediseñar el resto de la aplicación.
- Perfil ausente/inactivo rechazado por la sesión; contexto SQL activo para RPC/RLS dependientes.
- Auth DEV: altas públicas deshabilitadas, mínimo 12 caracteres y cuatro clases.
- CI ejecuta recuperación y regresión sintética Pilot, además de build y revisión del artefacto.

## Pruebas ejecutadas

| Prueba | Resultado | Alcance |
|---|---|---|
| Recuperación automática | 13/13 | Handlers reales, I/O Auth/correo simulado; correcto, incorrecto, vencido, reutilizado, límite, errores, CORS, fail-closed y server-to-server |
| HTTP público DEV | 8/8 | Evidencia histórica de neutralidad, CORS, tablas privadas y registro público cerrado; complementada por E2E parametrizado de Fase 2C |
| Recuperación email E2E DEV | OK | Funciones v23: solicitud staging, recepción real, código de 8 dígitos, cambio de contraseña y login posterior con usuario sintético `10000001` |
| Máquina de estados SQL | OK | Base DEV real, rollback; incluye cinco intentos, identidad cambiada y envío pendiente |
| Acceso SQL | OK | Base DEV real, rollback; permisos anon/authenticated y perfil inactivo |
| Consumo concurrente SQL | OK | Dos confirmaciones simultáneas: exactamente una aceptada; fixture eliminado |
| RLS general | 40/40 | Ejecución real durante esta etapa, antes del endurecimiento final de concurrencia de recuperación |
| Integración general | 34/34 | Ejecución real durante esta etapa; solicitudes, mensajes, archivos privados, propuestas y QR |
| Roles Auth DEV | 3/3 | Login y perfil de socio/admin/superadmin durante esta etapa |
| Pilot sintético | 6/6 | Sin participantes reales ni importación |
| Build y artefacto staging | OK | Base `/app-afucoa/`, proyecto DEV, sin source maps ni secretos detectados |

Los dos escenarios SQL y HTTP se repitieron después de la última migración. La matriz general no se presenta como repetida después de esa migración: sus cambios finales afectan exclusivamente la recuperación. Posteriormente, Fase 2C confirmó la entrega de correo y recuperación completas contra un buzón real autorizado del usuario sintético DEV `10000001`. La evidencia DB fue `delivery_status=sent`, `consumed=true` e `invalidated=false`; no se documentan código, correo ni contraseña.

Durante la ejecución previa de pruebas se rotaron contraseñas de los tres usuarios DEV. No se almacenaron en el repositorio; no se debe suponer que las contraseñas antiguas siguen vigentes ni que una entrega por portapapeles haya funcionado. En este cierre no se volvieron a rotar.

## Migraciones versionadas

- `20260903200438_secure_password_recovery.sql`
- `20260904001121_recovery_concurrency_hardening.sql`
- `20260904002017_recovery_lock_clock.sql`

## Advisor

Sin avisos de nivel ERROR. Se conservan 15 avisos de funciones SECURITY DEFINER accesibles, revisadas según su propósito; no se alteraron solo para silenciar advertencias. La tabla de límites tiene RLS sin políticas intencionalmente: acceso exclusivo servidor y permisos revocados a clientes. Performance informa 21 índices aún sin uso y 13 políticas permisivas múltiples, sin cambios de optimización fuera del alcance.

- [Funciones autenticadas con privilegios elevados](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Tabla privada sin políticas públicas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Protección de contraseñas](https://supabase.com/docs/guides/auth/password-security)

Leaked Password Protection permanece deshabilitado en el plan Free: es un requisito previo a producción, no se contrató un plan ni se habilitó producción.

## Estado después de Fase 2C

La configuración runtime DEV utiliza `AFUCOA_ENV=dev`, `AFUCOA_ALLOWED_ORIGINS` explícita y las variables Supabase provistas server-side. Resend existente fue preservado. No se publican valores ni se guardan claves en chat, Vite, GitHub Pages o repositorio.

La validación DEV quedó cerrada, pero no habilita usuarios reales ni producción. B04 permanece abierto hasta disponer de email, dominio, secrets, runtime y E2E exclusivamente PROD. Pilot 01 sigue suspendido.
