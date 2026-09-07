# AFUCOA V2 — ciclo operativo de cuentas privilegiadas

Fecha: 7 de septiembre de 2026 (America/Montevideo)

Este runbook aplica a `admin` y `superadmin` de AFUCOA V2 PROD. Toda operación administrativa se ejecuta server-side, con una Secret API Key de PROD, trazabilidad y verificación humana. Nunca se usan claves privilegiadas desde Vite, navegador o GitHub Pages.

## Alta administrativa

1. Verificar identidad y autorización fuera del sistema, con responsable registrado.
2. Crear el usuario Auth server-side, con contraseña temporal fuerte generada en memoria, email confirmado únicamente tras completar el procedimiento aprobado y sin signup público.
3. Crear el profile con `auth_user_id` exacto, rol autorizado, estado `activo` y trazabilidad de origen.
4. Verificar que password login queda en AAL1 y que ninguna operación privilegiada funciona todavía.
5. Forzar enrollment TOTP, completar challenge y comprobar AAL2 antes de habilitar `/admin`.
6. Registrar quién aprobó el alta y cuándo, sin guardar contraseña ni secreto TOTP.

## Cambio de rol

- Requiere aprobación administrativa trazable.
- El rol se cambia server-side; nunca desde metadata editable del usuario.
- Al elevar de socio a admin/superadmin, cerrar o revocar sesiones y exigir nuevo login + enrollment/challenge MFA antes de cualquier privilegio.
- Al degradar, revocar sesiones para evitar claims o estado local obsoleto y comprobar que los RPC/policies admin queden denegados.

## Baja o suspensión

1. Cambiar `profiles.status` a `inactivo`.
2. Revocar globalmente las sesiones de esa cuenta mediante Admin API server-side.
3. Confirmar que la sesión anterior no puede refrescar ni ejecutar operaciones privilegiadas.
4. Preservar profile e historial cuando existan dependencias de negocio o auditoría.
5. Eliminar el usuario/profile solo cuando una política específica autorice borrado y se haya comprobado ausencia de dependencias.

El estado `inactivo` y el requisito AAL2 son controles independientes: la cuenta inactiva queda denegada incluso si poseía una sesión AAL2.

## Reactivación

1. Confirmar la decisión y registrar responsable.
2. Cambiar el profile a `activo` server-side.
3. Exigir un nuevo login.
4. Si existe un factor verificado, exigir challenge; si no existe, forzar enrollment.
5. Verificar AAL2 y una operación privilegiada controlada antes de devolver acceso operativo.

## Pérdida del dispositivo MFA

- No existe auto-recuperación del factor.
- Verificar presencialmente o por el procedimiento institucional aprobado la identidad y autoridad del titular.
- Revocar sesiones activas antes de intervenir factores.
- Un operador autorizado elimina administrativamente solo el factor afectado usando Admin API server-side.
- En el próximo login, el frontend detecta ausencia de factor y fuerza re-enrollment.
- Registrar actor, motivo, fecha y resultado. No registrar el nuevo secreto, QR o códigos TOTP.

## Reset y re-enrollment

1. Validación humana reforzada y aprobación.
2. Revocación de sesiones.
3. Baja del factor perdido/comprometido server-side.
4. Login por password en AAL1, que permanece sin privilegios.
5. Nuevo enrollment TOTP y verify.
6. Confirmación AAL2 y acceso privilegiado.

No se envían secretos TOTP por email/chat ni se reutiliza un factor de otra cuenta o entorno.

## Evidencia Fase 3H

El ciclo fue validado con una identidad sintética PROD: activa, inactiva, sesión revocada, reactivada, nuevo login y challenge MFA. El cleanup final confirmó `auth.users=0`, `profiles=0`, factores sintéticos `=0`, Storage `=0` y datos de negocio `=0`. La migración #18 permanece como funcionalidad definitiva.

## Separación de entornos

- DEV y PROD usan proyectos, publishable keys y Secret API Keys distintas.
- Ningún secreto DEV se reutiliza en PROD.
- Recovery/Push PROD continúan sin desplegar; B04/B05 siguen abiertos.
- Pilot 01 continúa **PARKED**.
