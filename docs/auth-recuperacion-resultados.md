# Cierre técnico Auth — 3 de septiembre de 2026 (Uruguay)

Alcance: rama `afucoa-v2`, Supabase DEV `imiplnspvmsrsuikulwm`. Sin importaciones reales, sin cambios en main, V1 o producción.

Actualización Fase 2B: la parametrización fail-closed y sus regresiones están versionadas localmente, pero no fueron desplegadas. La evidencia HTTP indicada como v12 corresponde a la versión DEV previa; no se repitieron tests LIVE ni se cambiaron secrets remotos.

## Cambios

- Recuperación conserva las dos Edge Functions existentes, desplegadas en DEV como versión 12.
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
| HTTP público DEV | 8/8 | Edge Functions reales v12; neutralidad, CORS, tablas privadas y registro público cerrado |
| Máquina de estados SQL | OK | Base DEV real, rollback; incluye cinco intentos, identidad cambiada y envío pendiente |
| Acceso SQL | OK | Base DEV real, rollback; permisos anon/authenticated y perfil inactivo |
| Consumo concurrente SQL | OK | Dos confirmaciones simultáneas: exactamente una aceptada; fixture eliminado |
| RLS general | 40/40 | Ejecución real durante esta etapa, antes del endurecimiento final de concurrencia de recuperación |
| Integración general | 34/34 | Ejecución real durante esta etapa; solicitudes, mensajes, archivos privados, propuestas y QR |
| Roles Auth DEV | 3/3 | Login y perfil de socio/admin/superadmin durante esta etapa |
| Pilot sintético | 6/6 | Sin participantes reales ni importación |
| Build y artefacto staging | OK | Base `/app-afucoa/`, proyecto DEV, sin source maps ni secretos detectados |

Los dos escenarios SQL y HTTP se repitieron después de la última migración. La matriz general no se presenta como repetida después de esa migración: sus cambios finales afectan exclusivamente la recuperación. No se verificó entrega de correo real ni recuperación completa contra un buzón real. Los ensayos positivos de actualización de contraseña en handlers usan un adaptador Auth simulado.

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

## Única configuración manual pendiente

Configurar el canal de correo de prueba DEV: remitente Resend de dominio verificado (`RESEND_API_KEY` y `RECOVERY_EMAIL_FROM` en Edge Function Secrets) y un buzón autorizado en el perfil DEV usado para la prueba. No pegar claves en chat, Vite, GitHub Pages ni archivos del repositorio. Los tres perfiles DEV no tenían correo de contacto y no había secretos personalizados al revisar el Dashboard.

Después de esa configuración se debe validar recepción y recuperación end-to-end antes de declarar el acceso listo para personas reales. Pilot 01 sigue suspendido.
