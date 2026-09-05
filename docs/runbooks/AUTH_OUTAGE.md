# Runbook — Auth outage o anomalía de sesión

1. Confirmar con usuario sintético PROD dedicado: login, sesión y `get_my_profile`; no usar cuentas reales.
2. Comparar salud de frontend, Auth, API y DB para separar credenciales inválidas de caída general.
3. Revisar métricas y audit logs redacted: login, refresh, logout, cambios de contraseña y cuentas inactivas.
4. Declarar SEV1 si Auth general está caído; SEV2 por degradación amplia; SEV3 por caso aislado.
5. Preservar request IDs, timestamps, SHA y configuración fingerprint; nunca contraseña, token o email completo.
6. No abrir signup, no omitir perfil activo y no debilitar RLS. Si se sospecha secreto expuesto, usar `SECRET_EXPOSURE.md`.
7. Mitigar mediante rollback de versión/config aprobada o escalamiento al proveedor, con doble revisión.
8. Revalidar socio sintético, admin sintético, refresh, logout y rechazo de cuenta inactiva.

Las sesiones reales no se revocan masivamente sin autorización del Incident Commander y Security Owner.
