# Runbook — Exposición o compromiso de secretos

1. Tratar una evidencia creíble como SEV1. No copiar el valor al ticket, chat, captura o repositorio.
2. Identificar tipo, entorno, consumidores, privilegio, primera/última evidencia y posible uso indebido.
3. Preservar logs, commits y audit trail sin el secreto; limitar acceso al canal Security.
4. Contener acceso y generar reemplazo desde el sistema autorizado. Coordinar dependencias para evitar una caída mayor.
5. Actualizar consumidores server-side, validar con smoke checks y recién entonces revocar la credencial anterior cuando el riesgo lo permita.
6. Para material que firma/autoriza sesiones, evaluar revocación de sesiones y alcance de datos con Identity/Database Owner.
7. Para VAPID, asumir posible resuscripción; para email/hosting/GitHub, revisar actividad y permisos del proveedor.
8. Escanear repositorio, artifacts, source maps y logs; retirar copias visibles conforme al procedimiento de la plataforma.
9. Comunicar hechos e impacto con Security/Privacy/Legal; no prometer ausencia de acceso sin evidencia.
10. Ejecutar post-validación y postmortem. Seguir además `SECRET_ROTATION.md`.

No se incluyen valores ni comandos de revocación: varían por proveedor y requieren doble revisión.
