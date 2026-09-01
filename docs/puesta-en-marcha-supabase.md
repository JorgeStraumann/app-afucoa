# Puesta en marcha de Supabase — entorno de prueba

1. Crear o usar un proyecto Supabase de DESARROLLO. No comenzar ejecutando migraciones sobre producción.
2. Ejecutar `supabase/schema-v2.sql` en una base limpia de pruebas.
3. Revisar y ejecutar `supabase/security-v2.sql`.
4. Crear `.env.local` a partir de `.env.example`.
5. Configurar `VITE_AFUCOA_MODE=supabase`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
6. Crear usuarios Auth de prueba usando el alias de cédula definido por la app y vincular `profiles.auth_user_id` al UUID de `auth.users`.
7. Probar primero un socio, un administrador y un superadministrador.
8. Verificar manualmente que un socio no pueda leer solicitudes, perfiles ni archivos de otro socio.
9. Solo después de estas pruebas planificar migración del padrón V1.

## Prohibiciones

- No colocar `service_role` en `.env.local` de Vite ni en JavaScript del navegador.
- No desactivar RLS para solucionar errores de integración.
- No hacer públicos los buckets con documentos o adjuntos privados.
- No migrar contraseñas actuales sin evaluar su formato/hash y compatibilidad con Supabase Auth.
