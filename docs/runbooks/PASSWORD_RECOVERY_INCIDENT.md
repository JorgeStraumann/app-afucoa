# Runbook — Recuperación de contraseña y email

1. Validar con métricas agregadas: solicitudes, códigos creados, `sent`/`failed`, expirados, reuso, límites y provider status.
2. Mantener siempre la respuesta pública neutra; nunca revelar existencia de cédula/email.
3. Declarar SEV2 si el flujo falla ampliamente; SEV3 por anomalía limitada o abuso sin compromiso confirmado.
4. Correlacionar Edge version/config, rate limits y proveedor mediante request IDs opacos.
5. No registrar código, HMAC, contraseña, destinatario completo ni secret del proveedor.
6. Si hay abuso, preservar rate limits y neutralidad; no relajar controles para recuperar entregabilidad.
7. Si hay exposición de credencial, seguir `SECRET_EXPOSURE.md`; si hay fallo de Edge, `EDGE_FUNCTION_INCIDENT.md`.
8. Revalidar solicitud neutra, entrega sintética autorizada, código correcto, incorrecto, expirado, reuso, exceso de intentos y login nuevo.

No ejecutar recovery recurrente sobre correos reales como health check.
