# AFUCOA V2

Nueva versión modular y responsive de la aplicación de AFUCOA.

## Estado actual — Incremento 10
El Portal del Socio y el Panel Administrativo están maquetados y navegables. La capa Supabase ya cubre Auth, RLS, Storage, QR verificable, trámites, propuestas y ahora también el backend administrativo principal.

El proyecto conserva dos modos:
- `demo`: funciona sin credenciales y utiliza datos ficticios.
- `supabase`: utiliza Supabase Auth, RLS, RPC y Storage.

## Desarrollo
```bash
npm install
npm run dev
```

Copiar `.env.example` a `.env.local` y completar las variables para activar Supabase.

## Base de datos de desarrollo
Ejecutar en este orden:
1. `supabase/schema-v2.sql`
2. `supabase/security-v2.sql`
3. `supabase/storage-v2.sql`
4. `supabase/admin-v2.sql`

No se debe usar `service_role` en el navegador. Los buckets de expedientes y documentos son privados. Las mutaciones administrativas siguen sometidas a RLS.

## Pilot 01

El procedimiento de incorporación controlada de 5–10 socios V1 está documentado en `docs/pilot-01.md`. La normalización no toca Supabase; la creación de Auth se realiza solamente desde el importador Node server-side y exige confirmación explícita del proyecto DEV. `npm run test:pilot` valida idempotencia y rollback con datos sintéticos.

## Incremento 10
- Socios administrativos conectables a `profiles`.
- Bandeja real de expedientes y RPC transaccional para cambios de estado.
- Editor de convenios con persistencia real.
- Publicación de contenido con persistencia real.
- Moderación de propuestas vía RPC.
- Dashboard con métricas reales.
- Auditoría automática de mutaciones administrativas mediante triggers.
- Modo demo preservado.

## Documentación
- `docs/puesta-en-marcha-supabase.md`
- `docs/migracion-v1-v2.md`
- `docs/incremento-09.md`
- `docs/incremento-10.md`
- `tests/rls-checklist.md`

## Validación
Los módulos JavaScript se verifican con `node --check`. Antes de producción hay que ejecutar la matriz RLS y el build completo de Vite en un entorno con npm disponible.
