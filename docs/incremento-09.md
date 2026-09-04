# Incremento 09 — Identidad, migración y módulos reales

## Implementado
- Recuperación de contraseña en dos pasos: solicitud de código y confirmación.
- Edge Functions completas para recuperación, con CORS restringido, respuesta neutra y adaptador server-side de Resend.
- Códigos HMAC de 8 dígitos, caducidad de 10 minutos, consumo único, invalidación de anteriores y máximo de cinco intentos.
- Rate limiting atómico por IP e identidad sin almacenar esos datos en claro.
- RPC `create_my_proposal` y `support_proposal` con identidad del servidor y unicidad por base de datos.
- Propuestas del socio conectables a Supabase.
- Noticias/Comunicados/Agenda conectables a `content_items`.
- Preparación de perfiles para trazabilidad de migración V1.
- Flujo Pilot 01 para normalizar, prevalidar, importar de forma idempotente y revertir un lote de 5–10 socios en DEV.
- Matriz de pruebas RLS para anon/socio A/socio B/admin.

## Decisión de migración
La migración se divide en tres operaciones y nunca se hace directamente sobre producción:
1. Exportar y normalizar padrón V1.
2. Crear usuarios Auth mediante un proceso server-side con `service_role`; vincular `profiles.auth_user_id`.
3. Validar conteos, duplicados, estados y una muestra de cuentas antes de habilitar V2.

No se migran contraseñas V1 salvo que exista un hash compatible y exista una razón técnica justificada. Por defecto se crea una activación/recuperación inicial.

## Pilot 01 preparado
- Procedimiento operativo: `docs/pilot-01.md`.
- Auth se crea únicamente con `supabase.auth.admin.createUser()` desde Node server-side.
- Reporte separado de credenciales y journal de rollback por lote.
- Validación sintética automatizada sin crear usuarios reales.

## Pendiente antes de usuarios reales
- Configurar en Edge Function Secrets un remitente Resend verificado y un destinatario de prueba; no usar variables Vite/GitHub Pages.
- DEV ya tiene esquema, seguridad, storage y migraciones aplicados; para otro entorno respetar la secuencia completa de migraciones.
- Aprobar la lista nominal de 5–10 participantes y el canal seguro de entrega de credenciales temporales.
- Habilitar `Leaked Password Protection` y mantener la política de 12–72 caracteres antes del inicio del piloto.
- Pilot 01 sigue suspendido: no ejecutar importaciones reales ni `--apply`.
