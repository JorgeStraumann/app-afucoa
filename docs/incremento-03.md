# AFUCOA V2 — Incremento 03

## Construido
- Router parametrizado genérico (`/tramites/nuevo/:id`, `/solicitudes/:id`, `/convenios/:id`).
- Catálogo de definiciones de trámite basado en datos.
- Flujo de formularios por pasos con validación básica de campos obligatorios.
- Estado de borrador preparado conceptualmente; persistencia real queda para Supabase.
- Seguimiento de solicitud con línea temporal y mensajes contextuales.
- Primer módulo real de Noticias + Comunicados + Agenda.
- Diseño responsive de estos módulos para teléfono, tablet y escritorio.

## Modelo de datos agregado
- `request_drafts`: sincronización futura de formularios incompletos entre dispositivos.
- `request_messages`: conversación contextual vinculada al expediente.
- Versionado de definiciones de trámite.
- Audiencias y fijado de contenido editorial.

## Deliberadamente simulado
- Envío efectivo de formularios.
- Subida de archivos.
- Persistencia de borradores.
- Generación automática de constancias PDF.
- Mensajería real.
- Recordatorios de agenda.

Estas funciones se muestran como UX, pero todavía no realizan escrituras contra producción.

## Próximo incremento recomendado
1. Documentos + versionado visible.
2. Propuestas + apoyo único preparado para servidor.
3. Centro de notificaciones.
4. Mi Cuenta.
5. Primera base del administrador.
