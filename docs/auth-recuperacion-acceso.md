# Auth y recuperación de acceso

## Alcance

Este flujo pertenece exclusivamente a AFUCOA V2. Pilot 01 continúa suspendido. El navegador usa solamente la URL y la publishable key; la resolución de identidad, el envío y el cambio de contraseña ocurren en Edge Functions. La parametrización multiambiente está versionada, desplegada y validada E2E únicamente en DEV; no fue desplegada en PROD.

## Login por cédula

La interfaz normaliza la cédula a dígitos y deriva el alias Auth `<cedula>@auth.afucoa.local`. Ese alias no es el correo de contacto. Supabase Auth valida la contraseña y `get_my_profile()` resuelve el rol real desde `profiles.auth_user_id`.

Los perfiles distintos de `activo` quedan bloqueados en dos capas:

- la sesión del frontend se descarta si no recibe un perfil activo;
- `current_profile_id()`, `current_user_role()`, `get_my_profile()` y `update_my_contact()` exigen `status = 'activo'`. Las RLS/RPC que dependen de ese contexto bloquean operaciones propias y administrativas; esto no equivale a revocar el JWT ni a bloquear todos los contenidos publicados para `authenticated`.

Los mensajes de login no distinguen entre cédula inexistente y contraseña incorrecta.

## Recuperación en dos pasos

1. `request-password-recovery` recibe la cédula y siempre responde: “Si la cuenta está habilitada, recibirás un código en breve”. La respuesta es igual para identidad existente, inexistente, inactiva, sin correo, sin proveedor o limitada.
2. Solo un perfil activo, vinculado a Auth y con correo real puede generar un código.
3. El código tiene 8 dígitos, se genera con `crypto.getRandomValues()`, vence en 10 minutos y se guarda únicamente como HMAC-SHA-256. La clave HMAC es `SUPABASE_SERVICE_ROLE_KEY`, disponible solo dentro de la Edge Function.
4. Crear un código invalida atómicamente todos los anteriores del mismo perfil.
5. `confirm-password-recovery` consume el código atómicamente antes de llamar a `auth.admin.updateUserById()`. Un código consumido, invalidado, vencido o bloqueado no puede reutilizarse.
6. Tras cinco códigos incorrectos, el código queda invalidado.

La confirmación devuelve un único error público para código incorrecto, vencido, reutilizado o bloqueado. No se registran cédulas, correos, IP, códigos, contraseñas ni secretos en logs.

## Rate limiting

Los identificadores se guardan como HMAC, nunca como cédula o IP en claro.

| Operación | Alcance | Límite | Bloqueo |
|---|---:|---:|---:|
| Solicitar código | IP | 10 cada 15 min | 30 min |
| Solicitar código | identidad | 3 cada 60 min | 60 min |
| Confirmar código | IP | 20 cada 15 min | 30 min |
| Confirmar código | identidad | 10 cada 15 min | 30 min |
| Cada operación | global | 100 cada 60 min | 60 min |
| Probar un código | código | 5 intentos | invalidación |

La función SQL `take_password_recovery_rate_limit()` usa bloqueo asesor y de fila para evitar carreras, incluso al crear el primer contador. Se comprueba primero el límite global para acotar nuevos contadores. Los relojes se toman después de adquirir los bloqueos. Registro y consumo serializan por perfil, y el código queda ligado al `auth_user_id` original. Solo se acepta un código cuyo envío figure como `sent`. Estas funciones son `SECURITY INVOKER`, con ejecución revocada a `public`, `anon` y `authenticated`, y concedida únicamente a `service_role`.

El límite global es conservador para DEV y puede causar denegación temporal bajo abuso distribuido; no sustituye protección perimetral. La respuesta neutra incluye un piso temporal con jitter, sin prometer igualdad perfecta de tiempos.

## Correo transaccional

La integración con Resend está terminada dentro de `request-password-recovery`. Requiere secretos de Edge Functions, no variables Vite ni variables de GitHub Pages:

- `RESEND_API_KEY`
- `RECOVERY_EMAIL_FROM`, con formato de remitente aceptado por Resend y dominio verificado

La configuración compartida exige además `AFUCOA_ENV`, `AFUCOA_ALLOWED_ORIGINS`, `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. No existen origins por defecto. `RECOVERY_ALLOWED_ORIGINS` quedó reemplazada por la lista única compartida.

Si Resend rechaza el envío, el código queda marcado `failed` e invalidado. El código nunca se devuelve al cliente ni se imprime en logs. En la validación Fase 2C se usó un correo real autorizado asociado al usuario sintético DEV `10000001`; el valor del correo no se documenta.

## Política de contraseñas

La recuperación exige entre 12 y 72 caracteres, al menos una mayúscula, una minúscula, un número y un símbolo. La misma política se valida en cliente y servidor.

En Auth DEV se guardaron mínimo 12 y las cuatro clases, y se deshabilitaron las altas públicas. Estos ajustes del Dashboard no forman parte de las migraciones SQL. No se cambiaron planes pagos. Las contraseñas anteriores no se vuelven válidas/inválidas retroactivamente por esta política.

Antes de producción debe habilitarse **Leaked Password Protection** en Supabase Auth y conservarse una longitud mínima de al menos 12 caracteres con las cuatro clases. Esta protección depende del plan de Supabase; si el plan no la incluye, el lanzamiento debe detenerse o incorporar una alternativa server-side equivalente.

## Configuración runtime y CORS

`_shared/runtime-config.ts` valida ambiente, URL Supabase, clave server-side y origins exactos. La configuración inválida devuelve indisponibilidad genérica y no realiza operaciones de recuperación. Un origin ajeno recibe 403 sin reflexión ni fallback; `OPTIONS` requiere origin permitido y todas las respuestas incluyen `Vary: Origin`.

Se conservan POST server-to-server sin `Origin`: no reciben header CORS y siguen sujetos a validación de cuerpo, HMAC y límites IP/identidad/global. CORS no se trata como mecanismo de autenticación.

El contrato completo, inventario PROD y variables están en `docs/EDGE_RUNTIME_CONFIG.md`. En DEV, `request-password-recovery` v23 y `confirm-password-recovery` v23 quedaron `ACTIVE` con `AFUCOA_ENV=dev` y `AFUCOA_ALLOWED_ORIGINS` explícita. Las variables Supabase, Resend y VAPID existentes permanecen server-side y sus valores no se documentan. PROD continúa sin despliegue.

## SECURITY DEFINER revisadas

No se eliminó `SECURITY DEFINER` para silenciar Advisor. Se revisaron individualmente las funciones públicas existentes:

- contexto y rol (`current_profile_id`, `current_user_role`, `is_admin`, `get_my_profile`): necesarios para evaluar RLS sin recursión, `search_path` fijado y ejecución autenticada;
- mutaciones propias (`update_my_contact`, trámites, archivos, notificaciones, propuestas y apoyos): identidad derivada de `auth.uid()`, controles de pertenencia y ejecución autenticada;
- carné (`create_membership_verification_token`): autenticado y socio activo; `verify_membership_token` es la única RPC anónima intencional y entrega datos mínimos;
- listados agregados (`list_visible_proposals`): autenticado, evita exponer apoyos privados.

Los grants permanecen mínimos y las nuevas primitivas de recuperación no son `SECURITY DEFINER`.

## Pruebas

- `pnpm test:recovery`: 13/13; política, contratos, fail-closed y ejecución de los handlers reales con I/O simulado (Supabase y correo).
- `pnpm test:edge-config`: 12/12 más check estático; configuración/CORS e inventario PROD, sin red ni secretos.
- `tests/password-recovery-state-machine.sql`: transacción sintética que valida código correcto, invalidación del anterior, expiración, reutilización, cinco intentos y rate limiting; siempre hace rollback.
- `pnpm test:rls` y `pnpm test:integration`: matriz real contra DEV con credenciales efímeras fuera del repositorio.
- `pnpm test:recovery-http`: endpoints públicos reales, CORS, neutralidad, código inválido, tablas privadas y altas públicas deshabilitadas; requiere `AFUCOA_SUPABASE_URL` y `AFUCOA_PUBLISHABLE_KEY`.
- `tests/password-recovery-access.sql`: permisos anon/authenticated y perfil inactivo; transacción con rollback.

Resultados y límites de verificación: `docs/auth-recuperacion-resultados.md`.

Aplicar las tres migraciones de recuperación después del esquema base y las migraciones previas. Los SQL de referencia no sustituyen la secuencia de migraciones. Antes de usuarios reales debe verificarse operacionalmente la titularidad del correo de contacto; editar `profiles.email` no constituye una verificación del buzón.

La recuperación real DEV fue aprobada con el usuario sintético `10000001`: solicitud desde staging, correo recibido, código de ocho dígitos recibido y aceptado, cambio de contraseña y login posterior correctos. La evidencia DB fue `delivery_status=sent`, `consumed=true` e `invalidated=false`. No se documentan correo, código, contraseña ni secretos.

Esta evidencia cierra la validación DEV, no la de producción. PROD requiere dominio/remitente, credenciales, origins, runtime y E2E propios; ningún valor DEV debe reutilizarse ni guardarse en Git, Vite o GitHub Pages.
