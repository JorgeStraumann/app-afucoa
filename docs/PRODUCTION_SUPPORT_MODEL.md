# AFUCOA V2 — Modelo mínimo de soporte de producción

Estado: **DRAFT — PENDING INSTITUTIONAL APPROVAL**

Este documento define qué debe decidir AFUCOA antes de habilitar personas reales. No publica contactos, no crea canales y no convierte objetivos provisionales en SLA.

## Decisiones requeridas

| Campo | Decisión |
| --- | --- |
| Canal primario para socios | **PENDING** |
| Canal alternativo ante caída total | **PENDING** |
| Horario y zona | **PENDING** |
| Responsable primario | **PENDING** |
| Responsable suplente | **PENDING** |
| Incident Commander | **PENDING** |
| Responsable privacidad/seguridad | **PENDING** |
| Tiempo objetivo de primera respuesta por severidad | **PENDING — no usar los valores provisionales como SLA** |
| Lugar restringido para evidencia con PII | **PENDING** |
| Canal de comunicación masiva ante incidentes | **PENDING** |

Los nombres, teléfonos y emails operativos deben conservarse en un directorio restringido fuera del repositorio. Aquí solo se registra la existencia y fecha de aprobación.

## Flujo mínimo

1. Registrar fecha, síntoma, módulo, entorno y medio de contacto; minimizar PII.
2. Clasificar como consulta, problema de acceso, defecto funcional, incidente de seguridad/privacidad o indisponibilidad.
3. Verificar identidad mediante el procedimiento institucional aprobado. Nunca pedir contraseña, código de recuperación, TOTP, API key ni sesión del navegador.
4. Resolver con el menor privilegio posible; los cambios de rol, estado o vínculo Auth requieren trazabilidad y revisión.
5. Escalar según `docs/INCIDENT_RESPONSE.md` y el runbook específico.
6. Comunicar hechos confirmados, impacto y próximo hito sin exponer PII ni detalles explotables.
7. Cerrar con resultado, responsable y acciones posteriores.

## Criterios de suspensión de altas

Detener nuevas altas o la cohorte en curso ante cualquiera de estos eventos:

- login, recuperación o MFA no operativos para la cohorte;
- evidencia de aislamiento/RLS incorrecto;
- envío de email o push a destinatario equivocado;
- datos incompatibles, duplicados o identidad histórica conflictiva;
- alerta SEV1/SEV2 activa;
- ausencia del responsable de soporte/Incident Commander;
- rollback no disponible o reporte incompleto.

## Checklist de aprobación

- [ ] canal primario y alternativo definidos;
- [ ] horario y zona aprobados;
- [ ] titular y suplente disponibles;
- [ ] verificación de identidad aprobada y ensayada;
- [ ] severidades/escalamiento aprobados;
- [ ] comunicaciones preparadas;
- [ ] repositorio restringido de evidencia definido;
- [ ] criterios de suspensión aceptados;
- [ ] fecha y aprobadores registrados fuera del repositorio.

Mientras exista un campo `PENDING`, I01 y B10 permanecen abiertos.
