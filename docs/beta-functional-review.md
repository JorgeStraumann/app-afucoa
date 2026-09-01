# Revisión funcional Beta — AFUCOA V2 DEV

Fecha: 1 de septiembre de 2026. Proyecto: `imiplnspvmsrsuikulwm` (`AFUCOA V2 DEV`).

## Alcance y seguridad

- Entorno local configurado en modo `supabase` con URL y publishable key.
- No se incorporó ni expuso ningún valor de `service_role` en frontend o evidencias. El importador Pilot 01 posterior solo admite la clave desde el entorno privado del proceso Node server-side.
- No se modificó AFUCOA V1 ni un proyecto de producción.
- Los tres perfiles DEV quedaron restaurados en sus roles finales: `socio`, `admin` y `superadmin`.

## Documentos Beta

Los cuatro PDF se cargaron en el bucket privado `documents-private` con los paths exactos del paquete:

| Path | Bytes | SHA-256 |
|---|---:|---|
| `beta/estatuto-afucoa.pdf` | 2596 | `8d9fcba7201abbac02d9609299989334caceeba335af91b71af6bb86fec1fc2f` |
| `beta/reglamento-funcionamiento.pdf` | 2512 | `14119f7baf1853454c7a707ab052da748cb65efe42d0ba30936abf17d9813f80` |
| `beta/guia-convenios.pdf` | 2458 | `ed9e3db2fccde6bafd1430b0aac720e743b25cb41465277fcc12cada51b4940f` |
| `beta/manual-socio.pdf` | 2523 | `1bdfce5ebec50fff16d13d68b0ed5175108ace38f8d14d4871e09157d3c8d8c8` |

Antes de publicar se verificó, para cada objeto, creación de URL firmada como socio, respuesta HTTP 200 y coincidencia del hash. El acceso anónimo no pudo crear URL firmada ni descargar. La política temporal limitada a esos cuatro paths se eliminó antes de continuar. Recién entonces los cuatro metadatos pasaron de `borrador` a `publicado`; el estado final es 4/4 publicados y vigentes.

## Pruebas RLS e integración

- Matriz `tests/rls-checklist.md`: **40/40**.
- Integración profunda: **34/34**.
- Aislamiento socio A/socio B aprobado para perfil, trámites, mensajes, adjuntos y Storage.
- `/admin` rechazado para socio y habilitado para admin/superadmin.
- Mi Cuenta permite contacto y preferencias; rol y ficha no son editables por un socio.
- Creación de trámite, mensajes visibles/internos y archivo privado aprobado.
- Propuestas: creación, moderación, apoyo único, cierre, autoría y conteo aprobados.
- QR: generación, validación pública mínima, vencimiento y revocación aprobados.
- Los fixtures transitorios y el cambio temporal de rol usado para socio B se limpiaron/restauraron al terminar.

## Errores encontrados y corregidos

1. El alias de login agregaba el prefijo inexistente `ci-`; ahora usa el correo Auth real derivado de la cédula.
2. El detalle de convenio no resolvía slugs y no cargaba favoritos reales; ahora acepta UUID/slug y persiste favoritos con RLS.
3. Documentos favoritos seguían siendo solo visuales; ahora usan `document_favorites`.
4. La apertura de URLs firmadas ocurría después de una operación asíncrona y el navegador bloqueaba la ventana; ahora el documento/adjunto se abre en la pestaña actual.
5. Chips y tabs se cortaban a 390 px; ahora envuelven contenido sin provocar overflow de página.
6. El padrón Admin caía a datos mock por una relación PostgREST ambigua; se fijó la FK explícita y muestra los 3 perfiles DEV.
7. Dashboard, Documentos y Notificaciones Admin mostraban fixtures demo; ahora leen los datos reales de Supabase.
8. El Dashboard conservaba una tabla simulada aunque las métricas fueran reales; ahora la prioridad operativa usa solicitudes reales.
9. Los formularios Admin de documentos, notificaciones y configuración prometían operaciones demo; ahora cargan PDF al bucket privado, crean notificaciones internas para socios activos y persisten `app_settings` bajo RLS.
10. Cerrar sesión fallaba si Supabase ya había invalidado la sesión; el estado local ahora se limpia siempre.

## Resultado por módulo

| Módulo | Socio | Admin / Superadmin | Resultado |
|---|---|---|---|
| Inicio | Datos Beta y accesos rápidos | Dashboard con métricas, solicitudes y auditoría reales | Aprobado |
| Carné Digital / QR | Generación y render del QR | Verificación RPC cubierta por matriz | Aprobado |
| Convenios | Catálogo, detalle por slug, filtros y favoritos reales | Catálogo/editor conectado | Aprobado |
| Trámites / Mis Solicitudes | Definiciones, 2 solicitudes Beta, detalle y mensajes | Bandeja real y cambio de estado protegido | Aprobado |
| Mensajes / archivos | Privacidad, visibilidad interna y URLs firmadas | Acceso administrativo conforme a RLS | Aprobado |
| Noticias / Agenda | Contenido, filtros y estados vacíos | Editor y listado real | Aprobado |
| Biblioteca | 4 PDF privados publicados, favoritos y descarga firmada | Listado real y carga privada de PDF | Aprobado |
| Propuestas | Tabs, creación y apoyo único | Moderación real | Aprobado |
| Notificaciones | Centro, lectura y preferencias | Historial real y creación interna | Aprobado |
| Mi Cuenta | Contacto limitado, preferencias y cierre de sesión | Sesiones de ambos roles verificadas | Aprobado |
| Pantallas Admin | Bloqueadas para socio | 10/10 rutas revisadas | Aprobado |

## Revisión responsive y evidencia

Se recorrieron las rutas de socio y las diez rutas Admin con sesiones reales en 390×844, 768×1024 y 1440×900. En la matriz final no hubo `scrollWidth` de página mayor al viewport. Las tablas conservan scroll horizontal interno intencional cuando no entran completas.

Capturas seleccionadas:

- `artifacts/beta-review/socio-390-carnet-final.jpg`
- `artifacts/beta-review/socio-390-documentos-final.jpg`
- `artifacts/beta-review/socio-390-propuestas-final.jpg`
- `artifacts/beta-review/socio-768-documentos-final.jpg`
- `artifacts/beta-review/socio-1440-inicio-viewport.jpg`
- `artifacts/beta-review/admin-390-dashboard-final.jpg`
- `artifacts/beta-review/admin-768-documentos-final.jpg`
- `artifacts/beta-review/admin-1440-dashboard-final.jpg`
- `artifacts/beta-review/superadmin-390-configuracion-final.jpg`

## Observaciones no bloqueantes

- El canal push externo aún no está conectado; el centro interno de notificaciones sí funciona. La configuración lo indica explícitamente.
- El linter de Supabase informa advertencias sobre funciones `SECURITY DEFINER` expuestas. Las RPC de socio y la verificación pública del QR son intencionales y sus resultados quedaron limitados por validaciones/RLS; conviene mantener una revisión de privilegios antes de producción.
- La protección de contraseñas filtradas de Supabase Auth aparece deshabilitada en DEV y debería habilitarse antes de producción.
- Los avisos de índices sin uso son esperables con el volumen mínimo de datos Beta.
