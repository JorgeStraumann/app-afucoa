# Runbook — Edge Function incident

1. Identificar función, versión, región, ventana, 4xx/5xx/timeout y latencia; comprobar el allowlist del release.
2. Separar 4xx esperados de validación/rate limit de fallos server-side.
3. Declarar SEV2 por fallos sostenidos o configuración fail-closed; escalar a SEV1 si causa Auth inaccesible o compromiso.
4. Preservar logs redacted y config fingerprint. No imprimir secrets, payloads privados o cabeceras de autorización.
5. Comparar versión desplegada con manifest y revisar provider status/dependencias.
6. Mitigar con deploy de versión aprobada o corrección revisada; no agregar defaults inseguros ni abrir CORS.
7. Si falta/está expuesto un secret, usar `SECRET_EXPOSURE.md`.
8. Revalidar CORS exacto, métodos, neutralidad, Auth/RLS, proveedores y casos negativos antes de cerrar.

Una función inesperada activa es drift y bloquea promoción, aunque no tenga tráfico observado.
