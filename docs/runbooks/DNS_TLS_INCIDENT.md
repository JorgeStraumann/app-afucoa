# Runbook — DNS o TLS incident

1. Confirmar resolución autoritativa, propagación, hostname, cadena TLS, vencimiento y probe desde más de una red.
2. Registrar UTC, respuestas DNS, certificado público, cambio aprobado más reciente y proveedor; no registrar credenciales.
3. Declarar SEV1 si el dominio canónico no resuelve o TLS es inválido; SEV2 si existe degradación parcial.
4. Congelar cambios simultáneos. Comparar zona/certificado con la configuración aprobada y provider status.
5. Mitigar mediante rollback del cambio DNS/certificado aprobado o escalamiento al proveedor, con Domain Owner y segundo revisor.
6. No desactivar HTTPS/HSTS como solución. No publicar origen alternativo con claves/config incorrectas.
7. Validar resolución pública, TLS, HTTPS 200, headers, assets, service worker, Auth redirects y Edge origins.
8. Considerar TTL real antes de declarar recuperación; comunicar la propagación residual.

La información de registrar/DNS y contactos de emergencia vive en el gestor operativo restringido, no en Git.
