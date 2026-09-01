# Incremento 09 — Identidad, migración y módulos reales

## Implementado
- Recuperación de contraseña en dos pasos: solicitud de código y confirmación.
- Edge Functions de referencia para recuperación; la primera requiere conectar un proveedor de correo transaccional antes de producción.
- Tabla de códigos de recuperación con hash, caducidad, consumo e intentos.
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
- Integrar proveedor transaccional de correo para entregar códigos de recuperación.
- Añadir rate limiting/CAPTCHA al endpoint público de recuperación.
- Ejecutar `schema-v2.sql`, `security-v2.sql` y `storage-v2.sql` en desarrollo.
- Aprobar la lista nominal de 5–10 participantes y el canal seguro de entrega de credenciales temporales.
- Habilitar protección de contraseñas filtradas y revisar SMTP/recuperación antes del inicio del piloto.
- Conectar las mutaciones del panel Admin a RPC/Edge Functions auditadas.
