# AFUCOA V2 — Borrador de decisión institucional B10

Estado: **READY FOR DECISION — NOT APPROVED**

Fecha de preparación: 30 de septiembre de 2026 (America/Montevideo)

Este documento reduce B10 a las decisiones humanas imprescindibles. No constituye una aprobación, no reactiva Pilot 01, no crea usuarios y no autoriza un `--apply`. Los nombres, contactos, cédulas y cualquier evidencia con PII deben conservarse fuera del repositorio.

## Hechos técnicos ya cerrados

- B01–B09: `CLOSED`.
- E01: matriz PROD sintética RLS/integración `112/112`, cleanup final en cero.
- E02: baseline acotado `30/30` health, `20/20` hosting y rate limit concurrente `3 permitidos / 5 bloqueados`.
- SHA funcional actualmente desplegado: `e91327e17fa0b813f354f4d00345ef26cd55d38f`.
- Origin canónico: `https://afucoa-v2-prod.pages.dev/`.
- Rollback frontend, restore, Recovery, Web Push, MFA privilegiado y monitoring: probados.
- PROD permanece sin personas reales. Pilot 01 permanece `PARKED`.

## Propuesta recomendada de GO condicionado

La recomendación técnica es **GO CON CONDICIONES para una cohorte inicial máxima de 5 socios autorizados**, no un lanzamiento masivo.

Condiciones:

1. alta server-side, sin importar contraseñas V1;
2. dry-run previo y detención ante cualquier `rejected` o conflicto;
3. confirmación de titularidad del email y entrega de acceso por canal separado;
4. soporte disponible durante la ventana y cuatro horas posteriores;
5. monitoring y runbooks activos;
6. suspensión inmediata ante un criterio de aborto;
7. autorización separada antes de cualquier `--apply` y antes de ampliar la cohorte.

La ventana recomendada es un día hábil entre martes y jueves, de 09:00 a 12:00, zona `America/Montevideo`, evitando feriados y períodos sin disponibilidad de soporte. La fecha exacta sigue pendiente.

## I01 — soporte y operación

Modelo inicial recomendado:

| Campo | Recomendación para aprobación |
| --- | --- |
| Canal primario | correo institucional controlado por AFUCOA; dirección guardada en directorio restringido |
| Canal alternativo | teléfono o mensajería institucional controlada; dato fuera del repositorio |
| Horario inicial | lunes a viernes, 09:00–17:00, `America/Montevideo` |
| Ventana de alta | responsable disponible durante la ventana y cuatro horas posteriores |
| Modelo operativo | un operador temporal para la cohorte inicial; separar roles antes de ampliar |
| Severidades | SEV1 inmediata/30 min; SEV2 prioritaria/60 min; SEV3 en horario operativo/seguimiento diario |
| Evidencia con PII | repositorio/directorio restringido aprobado, nunca GitHub público |
| Verificación de identidad | cédula + ficha contra fuente institucional y segundo dato controlado; nunca contraseña, TOTP o código Recovery |

Para aprobar I01 falta registrar fuera del repositorio:

- responsable titular, suplente e Incident Commander;
- responsable de privacidad/seguridad;
- direcciones/canales concretos;
- referencia al directorio restringido;
- aceptación o modificación del horario y cadencias.

## I02 — datos y privacidad

Tratamiento mínimo propuesto para la cohorte:

- identidad/membresía: cédula, ficha, nombre, apellido, sector y estado;
- contacto: email confirmado y teléfono solo si es necesario para soporte;
- Auth: nuevo usuario Supabase; jamás contraseña/hash de V1;
- actividad: trámites, mensajes, propuestas, notificaciones, preferencias, auditoría y archivos que el socio genere;
- exclusiones: no copiar contraseñas, preguntas de seguridad, OTP, Recovery, secretos ni datos no requeridos por AFUCOA V2.

Controles ya implementados: RLS, buckets privados, signed URLs, recuperación neutra, payload Push sin PII, trazabilidad y preservación de historial cuando existe actividad.

Para aprobar I02 falta una referencia externa restringida que confirme:

- finalidad y fundamento institucional/legal;
- texto informativo/consentimiento, versión y momento de presentación;
- plazos de retención por categoría y legal hold;
- procedimiento de derechos, verificación y plazo de respuesta;
- evaluación de Supabase, Cloudflare, Brevo y GitHub;
- responsables de negocio/datos y privacidad/legal.

No se activará ninguna purga automática con esta aprobación; `docs/DATA_RETENTION.md` continúa report-only hasta una fase específica.

## I03 — alcance y ventana

Propuesta recomendada:

- máximo 5 socios reales expresamente autorizados;
- listado nominal y consentimiento fuera del repositorio;
- cero importación masiva;
- dry-run obligatorio con `5 ready`, `0 rejected`, `0 conflicts` antes de solicitar `--apply`;
- una sola ventana de alta;
- observación individual de login, cambio/recuperación de acceso, Mi Cuenta, carné, biblioteca y un trámite;
- evaluación al cierre antes de incorporar otra persona.

Falta decidir fecha/hora exactas, fuente del listado autorizado, canal de entrega de acceso y referencia externa al consentimiento. Pilot 01 no se considera reactivado por aprobar este borrador.

## Criterios de aborto

Detener altas y preservar evidencia ante cualquiera de estos eventos:

- identidad rechazada, duplicada o históricamente conflictiva;
- destinatario de email/push incorrecto;
- fallo de aislamiento RLS o acceso administrativo;
- login, MFA o Recovery ampliamente no operativos;
- SEV1/SEV2 abierto;
- soporte/Incident Commander no disponible;
- reporte, journal o rollback incompletos;
- cambio no aprobado en SHA, esquema, secretos o proveedores.

## Registro mínimo que debe completar AFUCOA

| Campo | Estado |
| --- | --- |
| Decisión: GO condicionado / NO-GO | **PENDING** |
| Fecha/hora y zona | **PENDING** |
| SHA autorizado | **PENDING** |
| Aprobador negocio | **PENDING** |
| Aprobador operación/soporte | **PENDING** |
| Aprobador privacidad/datos | **PENDING** |
| Aprobador técnico/release | **PENDING** |
| Incident Commander | **PENDING** |
| Referencia restringida I01 | **PENDING** |
| Referencia restringida I02 | **PENDING** |
| Referencia restringida I03/cohorte | **PENDING** |
| Condiciones/vencimiento | **PENDING** |

## Texto sugerido de aprobación

La autoridad competente puede registrar externamente una decisión equivalente a:

> AFUCOA aprueba I01, I02 e I03 según las referencias restringidas indicadas y adopta un GO CON CONDICIONES para una cohorte máxima de 5 socios, en la ventana aprobada, sobre el SHA completo autorizado. Esta decisión no autoriza por sí sola un `--apply`; la ejecución requiere revisar el dry-run sin rechazos/conflictos y emitir una autorización separada. Pilot 01 y cualquier ampliación permanecen suspendidos fuera de ese alcance.

Una confirmación informal o sin las referencias/responsables anteriores no cierra B10.

## Secuencia después de la aprobación

1. registrar la decisión y referencias sin PII en `docs/PROD_GO_NO_GO_PACKET.md`;
2. congelar y verificar el SHA exacto;
3. preparar el archivo autorizado fuera del repositorio;
4. ejecutar únicamente normalización y dry-run;
5. entregar el resumen público y detenerse;
6. solicitar autorización explícita para el `--apply` exacto;
7. ejecutar, verificar, observar y cerrar o revertir según el journal.

