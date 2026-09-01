# AFUCOA — estrategia de migración V1 → V2

## Principio
V1 permanece operativa. V2 se construye y prueba en paralelo. No se reemplaza producción hasta validar datos, permisos y flujos críticos.

## Matriz inicial

| Área V1 | Destino V2 | Tratamiento |
|---|---|---|
| Socios / padrón | `profiles` | Migrar y normalizar cédula, ficha, nombres, contacto, sector y estado. Deduplicar antes de importar. |
| Login por RPC + localStorage | Supabase Auth + `profiles` | Reemplazar. No migrar contraseñas si no existe un mecanismo criptográficamente válido; activar alta/recuperación segura. |
| Convenios | `agreements`, `agreement_locations` | Migrar contenido, separar sucursales y normalizar categorías/acciones. |
| Propuestas | `proposals`, `proposal_supports` | Migrar propuestas. Recalcular apoyos únicamente desde datos confiables de servidor; no importar `localStorage`. |
| Solicitudes/formularios | `request_definitions`, `requests`, `request_events`, `request_files` | Transformar a motor de trámites. Conservar historial verificable cuando exista. |
| Noticias/comunicados | `content_items` | Normalizar tipos y estados editoriales. |
| Documentos | `documents` | Migrar archivos y establecer versión vigente. |
| Push Firebase | `push_devices` | Reasociar tokens por usuario/dispositivo; limpiar tokens obsoletos. |
| Admin con clave en sessionStorage | Roles/Auth | Eliminar completamente. |
| Google Apps Script no-cors | Integración backend | Sustituir por endpoint verificable/Edge Function cuando corresponda. |

## Etapas
1. Inventario de tablas/RPC actuales de Supabase V1.
2. Exportación de respaldo antes de cualquier transformación.
3. Script de migración a un entorno V2 de prueba.
4. Verificación de conteos, duplicados y campos obligatorios.
5. Pruebas con socios ficticios o autorizados.
6. Congelamiento breve de escritura V1 al momento del corte definitivo.
7. Migración delta final.
8. Activación V2 y monitoreo.

## Reglas de corte
- V1 no se elimina al lanzar V2; queda disponible como rollback durante una ventana acordada.
- No se reutilizan secretos/contraseñas del frontend V1.
- No se importa información de votos/apoyos que solo exista en almacenamiento local del navegador.
- Los identificadores de solicitud V2 usan formato `AF-AAAA-00001`.
- Toda migración debe producir un reporte de filas leídas, insertadas, actualizadas, omitidas y con error.
