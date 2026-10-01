# AFUCOA V2 — Seguimiento agregado de activación de la cohorte

Uso interno operativo. **No completar por persona ni agregar nombres, cédulas, emails, contraseñas, códigos, capturas o identificadores de cuenta.** Mantener cualquier detalle identificable fuera del repositorio, en el sistema restringido aprobado por AFUCOA.

## Estado conocido al 1 de octubre de 2026

| Hito agregado | Estado |
| --- | ---: |
| Cuentas Auth creadas y profiles vinculados | 5/5 |
| Smoke técnico de login y perfil | 5/5 |
| Titulares con primer acceso confirmado personalmente | 0/5 confirmado |
| Entrega de email de recuperación confirmada por titular | 0/5 confirmada |
| Contactos de email vacíos en la fuente de alta | 2/5 |

Las respuestas neutras del formulario y el smoke técnico no cuentan como prueba de entrega o de primer acceso personal. La ausencia de confirmación no demuestra que un titular no haya entrado; indica que no se registró evidencia confirmable bajo su control.

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

