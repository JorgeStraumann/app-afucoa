# AFUCOA V2 — Modelo de monitoring de producción

Estado: diseño previo a infraestructura; no hay proveedor ni alertas activas.

**AFUCOA V2 NO ESTÁ HABILITADA PARA PRODUCCIÓN. B09 continúa OPEN.** La matriz de `config/production-monitoring-policy.json` es un contrato declarativo y sus umbrales numéricos son provisionales. Deben recalibrarse con métricas de preproducción y PROD, ser aprobados por AFUCOA y recién entonces activarse en el proveedor elegido.

## Principios

- Separar telemetría PROD de DEV, con acceso mínimo y retención aprobada.
- Correlacionar por SHA de release, versión de función, request ID o UUID opaco. No registrar cédula, nombre, email, contenido de mensajes, títulos/cuerpos privados ni endpoints push completos.
- Preferir métricas agregadas. Si un diagnóstico exige un identificador, usar UUID técnico y acceso restringido.
- Una alerta debe indicar severidad, dueño, acción y runbook. Una alerta sin dueño no está operativa.
- Los probes sintéticos usan identidades PROD exclusivas y no mutan datos de negocio.
- Logs y métricas ayudan a detectar; no sustituyen RLS, auditoría, backups ni pruebas de restore.

Supabase permite observar por separado eventos de Auth, Postgres, PostgREST, Storage y Edge Functions; la retención y exportación dependen del plan. El proveedor y el método de extracción se deciden al provisionar PROD.

## Señales por componente

### Frontend y hosting

| Señal | Evidencia esperada | Riesgo cubierto |
| --- | --- | --- |
| HTTPS y TLS | probe externo desde más de una ubicación; validez, hostname y vencimiento del certificado | caída total, DNS/TLS vencido |
| Headers | comparación de CSP, HSTS, framing, MIME, referrer y permissions con la política versionada | deploy sin hardening |
| Release | SHA, digest y manifest aprobado versus artefacto servido | build equivocado o rollback incompleto |
| PWA | carga de manifest, `push-sw.js`, scope y estado de actualización | worker roto/obsoleto |
| Carga | errores JS, assets 4xx/5xx y navegación inicial | shell disponible pero app inutilizable |

El SHA puede exponerse solo como metadato técnico sin secretos. La comparación del deploy debe usar el release manifest inmutable, no el nombre móvil de una rama.

### Supabase y Database

Observar disponibilidad del API/DB, errores Postgres, conexiones/pool, latencia por operación, tamaño, crecimiento por tabla, consumo de Storage, fallos de RPC, denegaciones RLS inesperadas y versiones de migración versus manifest. Separar una denegación esperada de autorización de un incremento anómalo que afecte operaciones válidas. Nunca resolver una alerta debilitando RLS.

Los conteos de filas y tamaños usados en dashboards deben ser agregados. La comparación de migraciones debe reportar versión/checksum, no SQL con datos.

### Auth

Medir éxito/error de login sintético, refresh y duración funcional de sesión; solicitudes de recuperación; intentos y rate limits; cambios administrativos; y actividad de cuentas inactivas. Los audit logs de Auth registran login, logout, refresh y cambios de contraseña, pero el dashboard operativo debe evitar IP, user-agent o identidad salvo acceso restringido para un incidente.

### Edge Functions

Por función: requests, 4xx, 5xx, timeouts, latencia, errores fail-closed de configuración, versión desplegada y presencia/ausencia frente al allowlist de release. Los 4xx se segmentan: validación/abuso esperado no equivale a fallo server-side. Ningún log debe imprimir secrets o payload sensible.

### Recuperación de contraseña y email

Medir solicitudes, códigos registrados, `sent`/`failed`, expirados, reuso, intentos inválidos, eventos de rate limit, latencia y salud del proveedor. Mantener respuesta pública neutra y métricas agregadas: no revelar si una cédula existe. Nunca registrar código, HMAC, contraseña ni destinatario completo.

### Web Push

Medir targets encontrados, intentos, aceptación del proveedor, `sent`, `failed`, 404/410, dispositivos desactivados, estado del ledger, claims `sending` atascados, lotes al límite y diferencia entre destinatarios internos y deliveries. Un 404/410 representa endpoint inválido y debe distinguirse de una falla general del proveedor.

Web Push no garantiza exactly-once ni permite probar que el sistema operativo mostró un toast. Los indicadores operables son dispatch completado, aceptación del proveedor, ledger consistente y limpieza segura de endpoints inválidos. No almacenar ni mostrar endpoints completos en logs o paneles.

### Storage

Por bucket: errores de upload/download, URLs firmadas, tamaño, MIME rechazado, accesos denegados y crecimiento. Las denegaciones válidas de usuarios ajenos son señal de control efectivo; una subida de denegaciones para usuarios autorizados puede indicar regresión RLS/policy. No incluir paths privados, nombres de personas ni URLs firmadas en telemetría.

## Operación de alertas

1. El proveedor futuro evalúa la matriz versionada.
2. La primera persona de guardia valida que no sea mantenimiento o probe defectuoso.
3. Si cumple condición, declara SEV y abre timeline conforme a `docs/INCIDENT_RESPONSE.md`.
4. Cada cambio de severidad y mitigación queda registrado con hora UTC, evidencia redacted y SHA.
5. Tras preproducción y las primeras semanas de PROD, se revisan falsos positivos, tiempos y baseline; toda modificación de threshold requiere PR y aprobación.

## Pendientes para cerrar B09

- seleccionar e integrar proveedor, retención y acceso;
- instrumentar release, frontend y probes sintéticos;
- crear dashboards y activar alertas;
- obtener baseline real y recalibrar umbrales provisionales;
- probar el circuito de guardia/escalamiento;
- ejecutar game day y registrar tiempos observados.

La existencia de esta especificación no cierra B09.
