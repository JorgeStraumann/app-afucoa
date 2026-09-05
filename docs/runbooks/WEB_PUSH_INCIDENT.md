# Runbook — Web Push incident

1. Comparar destinatarios internos, targets encontrados, deliveries, `sent`/`failed`, 404/410 y claims `sending`.
2. Declarar SEV2 si falla ampliamente; SEV3 para dispositivo/endpoints aislados, batch límite o churn anormal.
3. Revisar función/version, VAPID fingerprint no secreto, provider responses y ledger; nunca endpoint completo ni PII.
4. Distinguir endpoint inválido 404/410, timeout/5xx del proveedor, fallo de cifrado y ausencia legítima de dispositivos.
5. No reenviar manualmente un batch sin verificar el ledger: Web Push no garantiza exactly-once.
6. No desactivar suscripciones por logout. La baja explícita y la limpieza controlada de 404/410 mantienen su semántica.
7. Si VAPID está comprometida, seguir `SECRET_EXPOSURE.md` y planificar impacto de resuscripción.
8. Validar con dispositivos sintéticos: dispatch, aceptación, ledger, tags por `notification_id`, cambio de cuenta y baja explícita.

Un status `sent` no prueba que el sistema operativo mostró el toast; comunicar únicamente evidencia bajo control de AFUCOA.
