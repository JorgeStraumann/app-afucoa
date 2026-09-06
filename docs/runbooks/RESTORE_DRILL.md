# Runbook — Restore drill aislado

Estado: procedimiento validado. **RESTORE REAL: EXECUTED AND VALIDATED** el 6 de septiembre de 2026 en un proyecto temporal aislado de `AFUCOA PROD`.

El drill no se ejecuta contra PROD ni reutiliza credenciales/dominios de servicio. Requiere Incident/Database/Security Owner, un destino desechable autorizado y evidencia redacted.

## Procedimiento exacto (12 pasos)

1. **Crear destino aislado:** provisionar un proyecto/entorno vacío, sin tráfico, usuarios reales ni integración con proveedores productivos.
2. **Seleccionar y restaurar:** elegir el backup/punto autorizado, registrar timestamp y restaurar en el destino aislado mediante el mecanismo soportado.
3. **Probar no impacto PROD:** confirmar antes y después que DNS, tráfico, funciones, secrets y datos de PROD no fueron modificados.
4. **Verificar esquema:** comparar migraciones, tablas, columnas, constraints, funciones, triggers, grants, RLS, índices y buckets con el manifest aprobado.
5. **Verificar filas/conteos sin PII:** comparar conteos agregados y checksums por categoría; no exportar ni capturar datos personales.
6. **Verificar RLS:** ejecutar casos positivos/negativos sintéticos para socio/admin/superadmin/anónimo, sin debilitar políticas.
7. **Verificar RPC:** probar las RPC críticas con identidades sintéticas, incluidos rechazo por rol y perfil inactivo.
8. **Verificar Storage:** restaurar/validar objetos en buckets aislados, checksums, límites, MIME, acceso privado y URLs firmadas.
9. **Verificar Auth:** comprobar configuración, identidades sintéticas, login, refresh/logout y vínculos de perfil; no enviar recovery a personas reales.
10. **Medir tiempos reales:** registrar inicio/fin de restore, validación, recuperación operativa y cada bloqueo/proveedor.
11. **Registrar RPO/RTO observado:** calcular el último dato recuperado y el tiempo hasta los checks aprobados; compararlos con el baseline AFUCOA aprobado: DB/Auth 24 h/8 h, Storage 24 h/12 h, Edge config último cambio aprobado/4 h y frontend RPO 0/2 h.
12. **Destruir de forma controlada:** obtener aprobación, confirmar que el target es el entorno aislado exacto, preservar evidencia permitida y retirarlo usando el procedimiento recuperable del proveedor.

## Criterios de éxito

- cero impacto en PROD y cero secretos/usuarios DEV reutilizados;
- manifest, RLS/RPC/Auth/Storage verificados;
- evidencia de datos agregada y protegida;
- RPO/RTO observados, gaps y plan de remediación registrados;
- cierre conjunto de Database, Security y Product Owner.

## Última ejecución

El drill real del 6 de septiembre de 2026 restauró el backup físico PROD `2026-09-06T03:15:00.292Z` en un proyecto temporal `sa-east-1`, validó equivalencia de 17 migraciones y estructura, probó export/delete/restore byte a byte de PDF/PNG/JPEG sintéticos y eliminó todos los objetos y el proyecto. RPO observado: 13 h 42 min 46,708 s. RTO observado: 12 min 34,589 s. La organización terminó con cero proyectos temporales facturables.

B08 queda **CLOSED**: el backup físico real, restore aislado, equivalencia 17/17, controles estructurales/Storage, RPO/RTO dentro de objetivo y cleanup completo cumplieron el criterio operativo aprobado. Un dump lógico adicional queda como **DEFENSE IN DEPTH / FUTURE IMPROVEMENT / NON-BLOCKING**; no se requieren credenciales ni infraestructura nuevas para cerrar B08. Ver `docs/PROD_BACKUP_RESTORE_DRILL.md`.
