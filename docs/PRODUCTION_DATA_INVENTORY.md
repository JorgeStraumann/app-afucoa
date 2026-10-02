# AFUCOA V2 — Inventario de datos y minimización (borrador)

Fecha: 2026-10-01 (America/Montevideo)

Estado: **INVENTARIO TÉCNICO EXTRAÍDO DE LAS MIGRACIONES; FINALIDAD/BASE LEGAL PENDIENTES DE APROBACIÓN**

## Alcance y método

Inventario estático de las 28 tablas `public` definidas en las migraciones canónicas y de los tres buckets de Storage. No consulta filas, no inspecciona los datos de socios ni cambia Supabase. Los campos describen capacidades del esquema; no afirman que cada campo esté poblado en PROD.

La aprobación B10 y el `--apply` cubren solo el batch exacto de cinco socios. Este documento ayuda a resolver G01–G06 de `docs/PRODUCTION_GOVERNANCE_CLOSEOUT.md`; no es una aprobación de finalidad, base legal, consentimiento, transferencia ni plazo de retención.

## Inventario por grupo de datos

| Grupo / tablas | Campos o contenido relevante del esquema | Sensibilidad y acceso esperado | Minimización recomendada |
| --- | --- | --- | --- |
| Identidad y membresía — `profiles` | nombre/apellido, `document_number`, `member_number`, email, teléfono, departamento/sector, foto, estado/rol, vínculo Auth e IDs de trazabilidad | **Alta**; dato identificatorio y contacto. Perfil propio o funciones administrativas según RLS/RPC | Mantener un solo perfil canónico; no repetir cédula/número de socio en trámites, mensajes, notificaciones ni logs si el vínculo al perfil basta. Contactos opcionales solo cuando exista una finalidad operativa aprobada. No guardar credenciales Auth en esta tabla. |
| Auth y factores | Identidad de login, estado de verificación, sesiones y factores MFA gestionados por Supabase Auth; no son columnas de `public` | **Muy alta**; acceso restringido a Auth y operaciones server-side aprobadas | No copiar contraseñas, hashes de contraseñas, OTP, recovery codes, TOTP ni tokens de sesión a `public`, Storage, logs o repositorio. V2 no migra contraseñas V1. |
| Trámites — `requests`, `request_drafts`, `request_definitions`, `request_events`, `request_messages`, `request_files` | Perfil, tipo/estado, `payload` JSON, pasos de borrador, mensajes/notas, actor, visibilidad, nombre/MIME/ruta de archivos y marcas de tiempo | **Alta/muy alta**; el `payload`, los mensajes y adjuntos pueden contener datos libres o documentos de soporte. Acceso limitado al titular y personal autorizado | Definir allowlist de campos por trámite; justificar cada campo; validar longitudes/tipos/tamaño/MIME; evitar datos sensibles en notas libres si no son necesarios. No duplicar identidad ya ligada al perfil. Enviar archivos solo por bucket privado. |
| Propuestas — `proposals`, `proposal_supports`, `proposal_moderation_events` | Título/descripción/respuesta, autor, apoyo asociado a perfil, actor y nota de moderación | **Media/alta**; participación puede ser sensible antes de publicación; apoyos identifican personas | Publicar solo contenido con estado aprobado. No exponer listados de personas que apoyan ni notas internas. No incluir identidad en mensajes/telemetría pública. |
| Comunicación — `notifications`, `notification_recipients`, `notification_campaigns`, `notification_preferences` | Título/cuerpo interno, ruta, audiencia/target JSON, destinatarios, lectura y preferencias | **Media/alta**; puede revelar relación con un trámite, evento o categoría | Mantener payload Push genérico y sin PII; enviar al mínimo de destinatarios; validar audiencia y vencimiento. No registrar cuerpos completos en logs. |
| Dispositivos Push — `push_devices`, `notification_push_deliveries` | Endpoint, claves de cifrado Push, perfil, plataforma, actividad/última vez; dispositivo, notificación y resultado de envío | **Muy alta** para endpoint/keys; ledger técnico relacionado a perfil. No es contenido, pero puede identificar un endpoint | Mantener solo dispositivos activos por consentimiento/acción explícita; restringir lectura de endpoint/keys a backend; nunca incluirlos en log/reporte; conservar baja explícita y protección contra mezclar cuentas. Logout no significa baja. |
| Contenido y catálogo — `agreements`, `agreement_locations`, `agreement_favorites`, `content_items`, `documents`, `document_versions`, `document_favorites`, `request_definitions` | Convenios, direcciones/teléfonos de locales, noticias/eventos, documentos, instrucciones/formularios, favoritos por perfil y fechas | De baja a media; contenido publicado puede ser público, pero favoritos y borradores no | Separar contenido público publicado de borradores/metadata privada. No publicar contactos personales sin aprobación. Los documentos privados se sirven mediante autorización/URL firmada de vida corta, nunca con ruta abierta. |
| Verificación de carné — `membership_verification_tokens` | Hash de token, perfil, vencimiento y revocación | **Alta**; capacidad de verificación vinculada a membresía | Guardar solo hash; token aleatorio corto de vida útil y revocable; respuesta pública mínima, sin exportar más datos de membresía de los aprobados. |
| Recuperación — `password_recovery_codes`, `password_recovery_rate_limits` | Hash de código, intentos, expiración, consumo, invalidación, estado de entrega, hash de IP; alcance/subject hash/ventana/bloqueo | **Muy alta**; datos de seguridad server-only | No guardar código en claro ni revelar existencia de identidad. Mantener acceso de cliente revocado, retención corta solo si se aprueba y borrado/limpieza tras expiración conforme a política futura. Nunca registrar email/código/IP sin redacción aprobada. |
| Seguridad y configuración — `audit_log`, `app_settings`, `proposal_moderation_events` | Actor, acción, tipo/ID de entidad, metadata JSON, configuración y marcas de tiempo | **Alta** si metadata incorpora PII; configuración puede afectar controles | Aplicar esquema/allowlist de metadata; no copiar payloads, email, cédulas, endpoints ni secretos. Preferir IDs opacos y valores agregados. Proteger cambios administrativos con trazabilidad. |

## Storage

| Bucket | Uso definido | Política técnica versionada | Regla de minimización |
| --- | --- | --- | --- |
| `request-files` | Adjuntos de trámites | Privado; límite 10 MiB; PDF/JPEG/PNG | Usar ruta opaca asociada al trámite; rechazar adjuntos innecesarios; acceso según identidad/rol y signed URL temporal. |
| `documents-private` | PDFs de biblioteca privada | Privado; límite 20 MiB; PDF | Solo material aprobado para miembros; no guardar datos personales en nombre/ruta; validar autorización antes de firmar descarga. |
| `public-media` | Imágenes de contenido público | Público; límite 10 MiB; JPEG/PNG/WebP | Publicar exclusivamente material revisado como apto para difusión; excluir documentos de socios y metadatos identificables. |

Los límites y tipos anteriores reflejan la configuración de migración. No certifican escaneo antivirus ni validación del contenido real; esos controles server-side y de cuarentena deben decidirse según riesgo antes de ampliar cargas.

## Decisiones a completar por Data Owner y responsables institucionales

- Confirmar la necesidad de cada campo y cada formulario; registrar campos excluidos y su motivo.
- Aprobar finalidad y base institucional/legal por grupo, y texto de información/consentimiento cuando corresponda.
- Definir si los campos libres `payload`, `body`, `metadata`, `audience` y `target` requieren validaciones adicionales o prohibición de tipos de datos.
- Revisar responsables/proveedores y ubicación de Supabase, Cloudflare, Brevo, GitHub y canales de soporte.
- Aprobar tabla de retención de `docs/DATA_RETENTION.md`, legal hold, derechos y procedimiento de borrado/exportación.
- Mantener apagada toda purga automática hasta completar aprobación y ensayo report-only en copia aislada.

Este inventario mejora la base de decisión, pero **no cierra G01–G09** por sí solo y no autoriza otro lote. La decisión de no solicitar confirmaciones directas adicionales a los titulares permanece registrada aparte y no cambia las finalidades ni los plazos aún pendientes.
