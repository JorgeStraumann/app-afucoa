# Runbook — Gestión y rotación de credenciales

Regla absoluta: nunca documentar valores reales ni reutilizar credenciales DEV en PROD. Generar con el proveedor, almacenar en gestor de secretos, limitar por entorno/rol y registrar solo dueño, versión/fingerprint no reversible, fecha y consumidores.

| Credencial | Generación y almacenamiento | Rotación/revocación | Impacto y post-validación |
| --- | --- | --- | --- |
| Supabase publishable key | proyecto PROD; variable pública aprobada del build | emitir/reemplazar según capacidades; actualizar build y retirar anterior cuando corresponda | es pública, pero identifica proyecto; escanear que solo la clave publicable llegue al bundle y validar Auth/RLS |
| Server/secret/service key | proyecto PROD; solo Edge/backend/vault, acceso mínimo | generar reemplazo, actualizar consumidores server-side, validar, revocar anterior; ante exposición seguir SEV1 | puede omitir RLS y exige alcance máximo de incidente; validar Edge/RPC y ausencia total en artifacts/logs |
| VAPID | par exclusivo PROD generado por operador autorizado; privada en Edge secret, pública al browser | planificar solapamiento si es posible; rotar privada/pública y revocar anterior | puede exigir resuscribir dispositivos; validar config, alta, dispatch, 404/410 y ledger |
| Resend/SMTP | cuenta/dominio PROD, scope mínimo; secret solo server-side | crear key nueva, cambiar Edge/provider, probar sintético y revocar anterior | validar envío/recovery, SPF/DKIM/DMARC, rate limits y que no haya destinatario/secret en logs |
| Token del proveedor de hosting | cuenta PROD, scope de deploy mínimo; vault/Environment protegido | reemplazar, actualizar workflow autorizado, validar deploy y revocar | puede impedir deploy/rollback; comprobar artifact digest, headers, SHA y permisos |
| Credenciales GitHub de deployment | preferir identidad federada/token efímero y Environment; no PAT amplio | renovar según política/proveedor, revisar workflows y sesiones, revocar lo anterior | validar aprobación, branch restriction, permisos mínimos, attestation y rollback |

## Procedimiento común

1. Abrir cambio/incidente y definir credencial, entorno, consumidores, dueño, ventana y rollback.
2. Generar reemplazo en el proveedor con mínimo privilegio; nunca copiarlo al ticket o terminal compartida.
3. Guardar el valor una vez en el vault/secret store; registrar metadatos sin valor.
4. Actualizar consumidores en orden controlado, manteniendo compatibilidad solo el tiempo indispensable.
5. Ejecutar smoke checks y revisar logs por fallos o exposición.
6. Revocar la anterior tras validación, o inmediatamente si el riesgo supera la disponibilidad.
7. Revalidar frontend artifact, Auth/RLS, Edge, email/push y deployment según la credencial.
8. Cerrar evidencia, fecha de próxima revisión y tareas. Ante compromiso, aplicar `SECRET_EXPOSURE.md`.

Las cadencias concretas son **PENDING POLICY/LEGAL APPROVAL** y deben ajustarse al proveedor. Ninguna rotación automática se activa en esta fase.
