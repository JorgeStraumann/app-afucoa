# Incremento 10 — backend administrativo real

Este incremento sustituye progresivamente los mocks del panel administrativo por lecturas y mutaciones reales contra Supabase cuando `VITE_AFUCOA_MODE=supabase`.

## Incluido

- `admin-repository.js`: socios, expedientes, convenios, contenido, propuestas, auditoría y métricas.
- Escritura real de convenios y publicaciones.
- Moderación real de propuestas.
- Actualización transaccional de expedientes mediante RPC.
- Auditoría automática de mutaciones administrativas mediante triggers.
- Los `GRANT` vuelven a habilitar solo las operaciones que RLS ya limita a roles administrativos.
- Modo demo conservado para desarrollo sin credenciales.

## Orden SQL de desarrollo

1. `schema-v2.sql`
2. `security-v2.sql`
3. `storage-v2.sql`
4. `admin-v2.sql`

No ejecutar directamente sobre producción. Primero validar la matriz de RLS con al menos un socio, un admin, un superadmin y una sesión anónima.

## Seguridad

`private.audit_admin_mutation()` usa `SECURITY DEFINER`, `search_path = ''`, nombres de esquema explícitos y no es ejecutable por clientes. Las RPC administrativas expuestas usan `SECURITY INVOKER`, por lo que continúan sometidas a permisos y RLS.
