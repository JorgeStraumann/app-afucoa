# AFUCOA V2 — Incremento 07: Supabase real y seguridad base

## Qué cambia

Este incremento introduce una capa de integración real con Supabase sin obligar a conectar todavía el proyecto productivo. La aplicación puede funcionar en dos modos:

- `demo`: conserva los datos de demostración y permite recorrer toda la interfaz.
- `supabase`: utiliza Supabase Auth y los repositorios reales.

La selección se realiza mediante variables de entorno. Nunca se debe guardar la `service_role` en el frontend.

## Autenticación por cédula

La UX mantiene cédula + contraseña. Supabase Auth usa internamente un alias de email determinístico, por ejemplo `ci-12345678@auth.afucoa.local`. Ese alias NO es el correo real del socio y no constituye un secreto.

La recuperación de contraseña no debe intentar enviar correo al alias. Se implementará con una Edge Function que reciba la cédula, resuelva el correo real del perfil y dispare un flujo de recuperación sin exponerlo al cliente.

## Sesión y roles

`bootstrapSession()` restaura la sesión de Supabase, obtiene el perfil mediante `get_my_profile()` y carga el rol. Las rutas `/admin/*` exigen `admin` o `superadmin` incluso en la capa cliente. Esto es solo defensa de UX: la autorización real está en RLS.

## RLS

`supabase/security-v2.sql` activa Row Level Security y define políticas iniciales. Principios aplicados:

- el socio puede leer su perfil pero no editar directamente rol, estado o ficha;
- cambios de contacto se realizan mediante RPC limitada;
- el socio ve únicamente sus solicitudes y mensajes visibles;
- administradores pueden operar bandejas administrativas;
- convenios, contenido y documentos se exponen solo cuando están publicados;
- apoyos se restringen a la identidad autenticada;
- tokens QR nunca son legibles directamente;
- auditoría y configuración son administrativas.

## QR

`create_membership_verification_token()` crea un token aleatorio de cinco minutos, revoca tokens anteriores activos y guarda únicamente SHA-256. `verify_membership_token()` puede ser llamado desde una pantalla pública y devuelve solo:

- válido/no válido;
- nombre;
- ficha;
- estado de afiliación;
- vencimiento del token.

No devuelve cédula, correo ni teléfono.

## Repositorios creados

- `auth-service.js`
- `profile-service.js`
- `agreements-repository.js`
- `requests-repository.js`
- `notifications-repository.js`
- `membership-service.js`

El siguiente incremento conectará progresivamente las pantallas de Convenios, Trámites, Notificaciones y Mi Cuenta a estos repositorios, además de Storage.
