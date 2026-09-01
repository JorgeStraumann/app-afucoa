# AFUCOA V2 — Incremento 06

## Alcance

Se completan los módulos administrativos que estaban reservados en el incremento 05:

- Contenido: listado, filtros y editor de noticia/comunicado/evento.
- Documentos: buscador, versionado conceptual y formulario de carga.
- Propuestas: bandeja de moderación, estados y acciones de demostración.
- Notificaciones: historial y compositor con audiencia, canal, destino y programación.
- Auditoría: búsqueda y filtro del registro de acciones.
- Configuración: identidad institucional, parámetros operativos, políticas y roles.

## Backend preparado

El esquema agrega `app_settings` y `notification_campaigns`, además de índices para campañas y auditoría. Ninguna política RLS se declara todavía: esta rama continúa en fase de prototipo y no debe usarse con datos reales hasta completar Auth/RLS.

## Estado de interacción

Las acciones de guardar/publicar son demostrativas. Sirven para validar UX y arquitectura, pero no escriben en Supabase ni envían push reales.
