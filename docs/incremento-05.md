# AFUCOA V2 — Incremento 05

## Objetivo
Incorporar el primer bloque operativo del Panel de Administración V2 sin conectar todavía datos reales ni modificar la V1.

## Implementado
- Shell administrativo independiente y responsive.
- Dashboard administrativo con métricas, prioridades, actividad y accesos rápidos.
- Gestión de socios con búsqueda, filtro por estado y ficha modal de desarrollo.
- Bandeja de trámites con filtros por estado, responsable, expediente y apertura de solicitud.
- Gestión de convenios con catálogo administrativo y editor visual de borradores.
- Rutas reservadas para Contenido, Documentos, Propuestas, Notificaciones, Auditoría y Configuración.
- Adaptación móvil/tablet/PC con menú lateral desplegable en pantallas pequeñas.

## Límites de esta entrega
- Los datos son `mock` y no representan el padrón real.
- Guardar/editar no persiste todavía en Supabase.
- Los permisos de administrador son visuales; todavía no hay Supabase Auth/RLS.
- No se habilitan acciones destructivas ni cambios reales.

## Próximo incremento
Incremento 06: editores funcionales para Contenido, Documentos, Propuestas y Notificaciones; primera vista de Auditoría; configuración inicial de roles/categorías; preparación de capa `services` para sustituir mocks por Supabase.
