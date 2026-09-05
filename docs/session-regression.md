# Corrección de carrera de sesión — AFUCOA V2 DEV

## Causa raíz

`startRealSession()` y el callback de Auth reconstruían simultáneamente el perfil después del login. El wrapper descartaba el tipo de evento y se trataban `SIGNED_IN`, `INITIAL_SESSION` y `TOKEN_REFRESHED` igual. Ambos caminos llamaban a `signOut()` ante cualquier excepción de `get_my_profile`, convirtiendo fallos transitorios en un logout y provocando 401 en RPC posteriores. Las respuestas asíncronas tampoco se invalidaban al cerrar sesión.

## Corrección

- Una carga compartida de perfil por identidad/generación para login, restauración y eventos.
- Propagación del tipo de evento fuera del lock de Auth; cancelación de callbacks pendientes al desuscribir.
- Eventos diferidos contrastados con la sesión actual del SDK, no aplicados desde snapshots obsoletos.
- Dos reintentos acotados de RPC. Un error de transporte/RPC conserva los tokens y el último perfil validado; el primer login no inventa un perfil si no puede validarlo.
- Solo una respuesta exitosa de perfil ausente/inactivo provoca cierre automático. Logout manual y `SIGNED_OUT` mantienen su semántica.
- Generaciones invalidan resultados pendientes tras logout/cambio de identidad.
- `TOKEN_REFRESHED` actualiza tokens sin reconstrucción ni remontar formularios; `USER_UPDATED` y `refreshProfile()` sí revalidan.
- Sin SQL, migraciones, cambios de RLS, grants, Edge Functions ni importaciones reales. Alcance exclusivamente `afucoa-v2` y DEV `imiplnspvmsrsuikulwm`.

## Regresión automatizada

`pnpm test:session`: 11 escenarios sobre los módulos de producción con dependencias simuladas: carrera, error transitorio/persistente, ausente, inactivo, logout tardío, refresh, cambio de identidad, restauración y wrapper de eventos.

`pnpm test:session-live`: 8/8 contra DEV con los mismos módulos de producción y Supabase real: login socio `10000001`, sesión persistente, perfil, contacto, QR, RPC entre pantallas, refresh real y logout manual. Todas las RPC devolvieron HTTP 200; el único logout fue manual y aislado con `{ scope: 'local' }`. El contacto sintético se restauró al finalizar. El QR de prueba conserva su vencimiento normal de cinco minutos.

Todos los tests LIVE que autentican las cuentas DEV compartidas hacen cleanup en `finally` mediante logout local. Nunca deben usar `auth.signOut()` sin scope: eso podría revocar sesiones manuales abiertas en otros navegadores. `pnpm test:live-auth-isolation`, incluido al inicio de `pnpm test:staging`, bloquea esa regresión sin modificar la semántica de logout de la aplicación real.

Variables efímeras del proceso: `AFUCOA_SUPABASE_URL`, `AFUCOA_PUBLISHABLE_KEY`, `AFUCOA_SOCIO_DEV_PASSWORD`. Nunca guardar contraseñas en Git, archivos o CI. El reporte imprime solo nombres de pruebas y paths/status HTTP, nunca headers, cuerpos ni tokens.

La prueba de RPC entre pantallas no sustituye la validación del navegador público. Para esa comprobación abrir staging, ingresar como socio DEV, guardar contacto sintético y comprobar **Guardado**; navegar a Inicio, Carné, Propuestas y volver a Mi Cuenta; refrescar la página, restaurar contacto y cerrar sesión. Registrar la evidencia pública en el cierre de la tarea.

## Fuera de alcance

No se valida correo real de recuperación en esta corrección. Pilot 01 sigue suspendido; no se tocaron usuarios reales, V1, main o producción. RLS sigue siendo la autoridad de acceso; conservar el perfil validado durante una falla de red no otorga permisos nuevos.
