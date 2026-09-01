# Incremento 09 — Identidad, migración y módulos reales

## Implementado
- Recuperación de contraseña en dos pasos: solicitud de código y confirmación.
- Edge Functions de referencia para recuperación; la primera requiere conectar un proveedor de correo transaccional antes de producción.
- Tabla de códigos de recuperación con hash, caducidad, consumo e intentos.
- RPC `create_my_proposal` y `support_proposal` con identidad del servidor y unicidad por base de datos.
- Propuestas del socio conectables a Supabase.
- Noticias/Comunicados/Agenda conectables a `content_items`.
- Preparación de perfiles para trazabilidad de migración V1.
- Script local para normalizar un CSV V1 sin escribir en producción.
- Matriz de pruebas RLS para anon/socio A/socio B/admin.

## Decisión de migración
La migración se divide en tres operaciones y nunca se hace directamente sobre producción:
1. Exportar y normalizar padrón V1.
2. Crear usuarios Auth mediante un proceso server-side con `service_role`; vincular `profiles.auth_user_id`.
3. Validar conteos, duplicados, estados y una muestra de cuentas antes de habilitar V2.

No se migran contraseñas V1 salvo que exista un hash compatible y exista una razón técnica justificada. Por defecto se crea una activación/recuperación inicial.

## Pendiente antes de usuarios reales
- Integrar proveedor transaccional de correo para entregar códigos de recuperación.
- Añadir rate limiting/CAPTCHA al endpoint público de recuperación.
- Ejecutar `schema-v2.sql`, `security-v2.sql` y `storage-v2.sql` en desarrollo.
- Completar pruebas RLS de `tests/rls-checklist.md`.
- Validar build Vite completo y pruebas de navegador.
- Conectar las mutaciones del panel Admin a RPC/Edge Functions auditadas.
