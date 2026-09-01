# Integración real con Supabase DEV

## Alcance

La rama `afucoa-v2` está conectada exclusivamente al proyecto de desarrollo `AFUCOA V2 DEV` (`imiplnspvmsrsuikulwm`). No se modificó V1 ni el proyecto de producción.

El frontend usa solamente la URL pública del proyecto y su publishable key a través de `.env.local`, que permanece ignorado por Git. No se agregó, usó ni expuso una clave `service_role` en el navegador, el código fuente o los scripts de prueba.

Variables locales:

```dotenv
VITE_AFUCOA_MODE=supabase
VITE_SUPABASE_URL=<URL del proyecto DEV>
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key del proyecto DEV>
VITE_AUTH_ALIAS_DOMAIN=auth.afucoa.local
```

## Resultado de las pruebas

La ejecución del 31 de agosto de 2026 validó los tres logins y los roles `socio`, `admin` y `superadmin`. La matriz base terminó 40/40 y la prueba de integración profunda terminó 34/34 después de corregir el único fallo encontrado.

Se comprobó:

- aislamiento completo entre socio A y socio B para solicitudes, mensajes, adjuntos y URLs firmadas;
- denegación de auditoría y operaciones administrativas a socios;
- acceso de admin y superadmin a perfiles, auditoría y moderación;
- actualización de email/teléfono mediante `update_my_contact`, sin posibilidad de cambiar rol o ficha;
- guardado de borrador y creación real de un expediente mediante los RPC de negocio;
- mensajes propios, rechazo de mensajes sobre un expediente ajeno y ocultamiento de notas internas;
- carga, registro y descarga firmada de PDF privado, con rechazo del path ajeno;
- creación, publicación, apoyo único por socio, cierre y rechazo de nuevos apoyos;
- generación de QR, verificación pública mínima y revocación automática del QR anterior;
- redirección de `#/admin` a login sin sesión y revalidación del rol contra Supabase antes de cada pantalla administrativa.

La cuenta admin se degradó temporalmente a `socio` para actuar como socio B. Al finalizar se restauró a `admin`. Los tres perfiles quedaron `activo`, con sus fichas originales y sin cambios residuales de contacto.

## Fallos corregidos

1. `submit_my_request` devuelve un conjunto de filas; el repositorio de frontend ahora normaliza la primera fila antes de usar `id` y `request_number`.
2. El listado de propuestas ahora usa `list_visible_proposals()`, que entrega autoría, apoyo propio y total agregado sin exponer las filas privadas de otros apoyos.
3. La UI escapa título, descripción, respuesta y metadatos de propuestas antes de insertarlos en HTML.
4. Los mensajes escritos por el socio se muestran como `Vos`, no como `AFUCOA`.
5. Las rutas administrativas refrescan el perfil real antes de comprobar el rol, por lo que una degradación de permisos se aplica sin depender de la sesión en memoria.
6. `create_membership_verification_token()` calificó las columnas de la tabla para eliminar la ambigüedad de `expires_at` detectada en la prueba real.

## Migraciones aplicadas solo a DEV

- `list_visible_proposals`
- `fix_membership_token_ambiguity`

Ambas migraciones están versionadas en `supabase/migrations/` y tienen permisos explícitos: ejecución solo para `authenticated`. La verificación de un QR permanece deliberadamente disponible a `anon` y devuelve únicamente nombre, ficha, estado y vencimiento.

## Repetición

```powershell
$env:AFUCOA_SUPABASE_URL = '<URL DEV>'
$env:AFUCOA_PUBLISHABLE_KEY = '<publishable key DEV>'
$env:AFUCOA_TEST_USERS = '<JSON de credenciales temporales, nunca versionar>'
node tests/rls-live-check.mjs
node tests/supabase-integration-live.mjs
```

La prueba profunda crea datos marcados con el prefijo `codex-`. Se debe ejecutar contra DEV, preparar una segunda identidad socio y eliminar los IDs informados en `fixtures` al finalizar. Nunca ejecutar esta batería contra producción.

## Revisión de seguridad

Supabase Advisor no informó errores nuevos después de las migraciones. Mantiene advertencias esperadas sobre RPC `SECURITY DEFINER` que son la frontera de negocio de la aplicación y tienen grants restringidos. `verify_membership_token` es la excepción pública intencional. También informa que la protección contra contraseñas filtradas está desactivada en Auth; conviene habilitarla antes de producción.
