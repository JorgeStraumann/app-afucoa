# AFUCOA V2 — Seguimiento agregado de activación de la cohorte

Uso interno operativo. **No completar por persona ni agregar nombres, cédulas, emails, contraseñas, códigos, capturas o identificadores de cuenta.** Mantener cualquier detalle identificable fuera del repositorio, en el sistema restringido aprobado por AFUCOA.

## Estado conocido al 1 de octubre de 2026

| Hito agregado | Estado |
| --- | ---: |
| Cuentas Auth creadas y profiles vinculados | 5/5 |
| Smoke técnico de login y perfil | 5/5 |
| Titulares con primer acceso confirmado personalmente | 1/5 confirmado |
| Entrega de email de recuperación confirmada por titular | 0/5 confirmada |
| Contactos de email vacíos en la fuente de alta | 2/5 |

Actualización: el responsable informó que inició sesión con su cuenta real y que las pantallas revisadas funcionaron correctamente. Se registra un primer acceso confirmado en forma agregada, sin asociar identidad. No se informó si utilizó una contraseña temporal ni se confirmó una recuperación/cambio de contraseña.

**Cierre operativo del seguimiento individual (2026-10-01):** el responsable decidió que no se solicitarán confirmaciones directas adicionales a los otros titulares y da por cerrado este tema. Esta decisión cierra el requisito de seguimiento individual para este lote; no cambia la evidencia factual de la tabla: solo hay 1/5 primeros accesos informados personalmente y 0/5 entregas de correo de recuperación confirmadas. No se presume el estado de las otras cuatro cuentas ni se declara recuperación completada. Esta decisión tampoco autoriza ampliar la cohorte ni reactivar Pilot 01.

Las respuestas neutras del formulario y el smoke técnico no cuentan como prueba de entrega de correo. El seguimiento queda cerrado por decisión del responsable, no por inferencia de esos eventos.

## Plantilla para actualizar sin PII

Actualizar solo totales y fecha. Usar `No confirmado` cuando no haya confirmación del titular; no inferir el resultado a partir de logs agregados.

| Fecha de corte | Contacto verificado por canal institucional | Acceso inicial confirmado por titular | Recuperación completada por titular | Incidentes abiertos | Observación agregada sin identidades |
| --- | ---: | ---: | ---: | ---: | --- |
| AAAA-MM-DD | __/5 | __/5 | __/5 | __ | __ |

## Criterios

- **Contacto verificado:** el titular confirma por el procedimiento institucional que controla el correo registrado; formato válido por sí solo no alcanza.
- **Acceso confirmado:** el titular confirma el acceso por un canal institucional conocido, sin enviar contraseña, código ni captura con datos privados.
- **Recuperación completada:** confirmación del titular de que recibió y usó su código y pudo iniciar sesión con la contraseña nueva. No pedir el código ni observar su buzón.
- Si un contacto falta o está desactualizado, detener la recuperación automatizada y coordinar su actualización mediante el procedimiento institucional. No redirigir el código ni sustituir el destinatario por decisión del operador.
- No ampliar la cohorte ni reactivar Pilot 01 como resultado de completar este seguimiento.
