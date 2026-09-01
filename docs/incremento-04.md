# AFUCOA V2 — Incremento 04

## Alcance implementado

- Biblioteca Documental con búsqueda, filtros por categoría y distinción de versión vigente/archivada.
- Propuestas con vistas Activas / Finalizadas / Mis propuestas, formulario de alta y apoyo de demostración.
- Centro de Notificaciones con filtros, estados leídos/no leídos, enlaces contextuales y preferencias.
- Mi Cuenta con perfil, afiliación, datos de contacto, preferencias, actividad y cierre de sesión.
- Nuevas tablas de soporte para versionado documental, favoritos, preferencias y trazabilidad de moderación.

## Estado del backend

Los módulos utilizan datos mock. No se consideran conectados a producción. Los apoyos, cambios de preferencias, favoritos y formularios todavía no persisten en Supabase.

## Seguridad pendiente

Antes de producción: Supabase Auth, roles, RLS, funciones/RPC restringidas, reglas de Storage, auditoría y revisión de exposición de datos personales.

## Próximo incremento

Panel de Administración V2: dashboard, gestión de socios, trámites, convenios, contenido, documentos, propuestas y notificaciones. Primero se construirá la estructura y CRUD visual con datos mock; luego se conectará al modelo de datos.
