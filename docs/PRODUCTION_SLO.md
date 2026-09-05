# AFUCOA V2 — SLI/SLO propuestos

Estado: propuesta no aprobada, sin medición PROD.

Todos los objetivos numéricos de este documento son **PROVISIONAL / PENDIENTE DE APROBACIÓN**. Deben validarse contra capacidad, presupuesto, dependencia de terceros y métricas reales. B09 continúa OPEN.

## Definiciones

- **SLI medible:** razón o duración calculable con eventos bajo control o visibilidad de AFUCOA.
- **SLO propuesto:** objetivo operativo sujeto a aprobación, ventana y exclusiones explícitas.
- **No garantizable:** resultado dependiente de navegador, sistema operativo, red, proveedor o conducta humana que no puede prometerse como entrega exacta.

| Servicio | SLI medible | SLO propuesto | No puede garantizarse |
| --- | --- | --- | --- |
| Frontend | respuestas HTTPS correctas y shell utilizable / probes válidos; carga de assets críticos; SHA/manifest coincidente | 99,9% mensual de probes válidos y 99% de cargas sintéticas completas — **PROVISIONAL / PENDIENTE DE APROBACIÓN** | disponibilidad de la red o dispositivo del usuario |
| Login | logins sintéticos exitosos con `get_my_profile` / intentos sintéticos; latencia p95 | 99,5% de éxito y p95 menor a 3 s — **PROVISIONAL / PENDIENTE DE APROBACIÓN** | que una credencial incorrecta o cuenta inactiva ingrese |
| Recuperación | solicitudes neutras aceptadas; código persistido; proveedor acepta email; confirmación válida; latencias | 99% de solicitudes sintéticas procesadas y 98% aceptadas por proveedor — **PROVISIONAL / PENDIENTE DE APROBACIÓN** | llegada a inbox, ausencia de spam, lectura humana o tiempo de entrega exacto |
| Edge Functions | respuestas válidas por función / invocaciones elegibles; 5xx/timeouts; latencia p95 | 99,5% de invocaciones elegibles sin 5xx/timeout y p95 menor a 2 s — **PROVISIONAL / PENDIENTE DE APROBACIÓN** | latencia de proveedores externos fuera del límite documentado |
| Database/RPC | operaciones sintéticas exitosas / operaciones elegibles; errores; latencia p95; integridad de manifest | 99,9% de lecturas/RPC sintéticas correctas y p95 menor a 1 s — **PROVISIONAL / PENDIENTE DE APROBACIÓN** | cero incidentes o cero pérdida sin un RPO aprobado y respaldos probados |
| Web Push | dispatch finalizado; proveedor acepta; ledger consistente; 404/410; claims completados | 98% de intentos a endpoints válidos aceptados y 99% de batches con ledger cerrado — **PROVISIONAL / PENDIENTE DE APROBACIÓN** | toast mostrado, atención del usuario, entrega exactly-once o orden global |

## Método de medición futuro

- Ventana mensual para disponibilidad y éxito; ventanas cortas solo para alertas.
- Excluir únicamente mantenimiento previamente comunicado y probes inválidos, con aprobación y evidencia.
- Mantener numerador, denominador, exclusiones, proveedor de datos, SHA y zona horaria documentados.
- Segmentar por función/bucket/operación sin dimensiones de PII.
- Publicar error budget interno luego de aprobar SLO; agotarlo debe detener promociones no urgentes hasta revisión.

## Web Push

El ledger puede demostrar que AFUCOA intentó el envío, recibió aceptación o error del servicio push y cerró el dispatch. Un `sent` no demuestra que Windows/Chrome mostró un toast. Los retries pueden deduplicarse por `notification_id`, pero Web Push **no garantiza exactly-once**. Por eso no existe SLO de “toast recibido” ni de exactamente una visualización.

## Criterio de aprobación

Antes de convertir esta propuesta en compromiso: ejecutar preproducción, medir al menos una ventana representativa, validar costos/retención, acordar horarios de soporte, revisar dependencias y obtener aprobación formal de AFUCOA. Hasta entonces, estos valores no son SLA ni cierran B09.
