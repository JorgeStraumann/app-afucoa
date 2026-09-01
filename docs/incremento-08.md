# AFUCOA V2 — Incremento 08

## Objetivo
Sustituir mocks por repositorios reales en los módulos de socio prioritarios y cerrar la primera implementación de Storage privado + verificación pública del carné.

## Implementado
- Convenios consume `agreements` y `agreement_locations` cuando `VITE_AFUCOA_MODE=supabase`.
- Trámites consume `request_definitions`, crea expedientes mediante `submit_my_request`, guarda borradores y consulta solicitudes reales.
- Adjuntos de solicitudes se almacenan en bucket privado `request-files` y se registran mediante RPC.
- Mis Solicitudes muestra eventos, mensajes y adjuntos reales. Los archivos se abren con URL firmada temporal.
- Notificaciones consume `notification_recipients` + `notifications` y marca lecturas mediante RPC.
- Mi Cuenta permite actualizar correo/teléfono y preferencias con persistencia real.
- Biblioteca Documental consume `documents` y abre PDFs privados mediante URL firmada.
- Carné Digital genera un QR real. En Supabase el QR contiene exclusivamente una URL con token opaco temporal.
- Ruta pública `#/verificar/:token` valida el token contra `verify_membership_token` y muestra solo nombre, ficha, estado y vencimiento.
- `storage-v2.sql` crea buckets y políticas de acceso.

## Buckets
- `request-files`: privado, PDF/JPG/PNG, máximo 10 MB.
- `documents-private`: privado, PDF, máximo 20 MB.
- `public-media`: público, destinado exclusivamente a imágenes editoriales sin datos sensibles.

## Orden SQL recomendado en desarrollo
1. `supabase/schema-v2.sql`
2. `supabase/security-v2.sql`
3. `supabase/storage-v2.sql`

No ejecutar primero en producción. Probar con usuarios de desarrollo y datos ficticios.

## QR
El token se genera con `gen_random_bytes`, se persiste únicamente como SHA-256 y vence a los 5 minutos. Generar un QR nuevo revoca el token activo anterior del socio.

## Estado de validación
Todos los archivos JavaScript pasaron `node --check`.
`npm install` no completó dentro del tiempo disponible en el entorno, por lo que el build Vite completo todavía debe validarse en un entorno con acceso normal al registro npm. El proyecto agrega la dependencia `qrcode` para renderizar el QR en el navegador.

## Pendiente para Incremento 09
- recuperación/cambio de contraseña mediante backend confiable;
- alta inicial/migración de cuentas sin exponer mecanismos administrativos al cliente;
- importador de socios V1 → V2 con validación y reporte;
- pruebas RLS automáticas para socio/admin/anon;
- conexión de Propuestas, Noticias/Agenda y administración a repositorios reales;
- push real y registro de dispositivos.
