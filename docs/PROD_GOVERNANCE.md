# AFUCOA V2 — Gobernanza Supabase PROD

Fecha de verificación: 6 de septiembre de 2026 (America/Montevideo)

Estado: **GOBERNANZA OPERATIVA VERIFICADA; B02 CLOSED.** Este cierre no declara a AFUCOA V2 habilitada completamente para producción ni autoriza datos reales.

## Inventario verificado

| Control | Estado observado |
| --- | --- |
| Organización | `AFUCOA PROD` |
| Proyecto | `rywdochyzhgfaymrmxek` |
| Plan / región | Pro / `sa-east-1` |
| Salud / compute | `ACTIVE_HEALTHY` / micro |
| Proyectos activos | 1, exclusivamente PROD |
| Proyecto temporal del restore | eliminado; `pgpgyjafphfevhvjdgwt` no existe como recurso activo |
| Add-ons | Dedicated IPv4, PITR y Custom Domain deshabilitados |
| Auth users / profiles / objetos Storage / Edge Functions | 0 / 0 / 0 / 0 |
| Migraciones | 17/17 canónicas, intactas |

La vista de facturación puede conservar líneas históricas por compute ya consumido por un recurso eliminado. Eso no representa un proyecto temporal activo: el inventario actual de la organización contiene un solo proyecto.

## Miembros, roles y least privilege

La organización tiene **1 miembro humano**. Es la cuenta operadora de Jorge, con rol Supabase **Owner** y MFA habilitado. No hay miembros DEV, cuentas de prueba, accesos V1 ni otros colaboradores en `AFUCOA PROD`.

Por la estructura actual, los siguientes roles recaen temporalmente en Jorge:

- Supabase Organization Owner;
- Production Platform Owner;
- Database Owner;
- Identity/Auth Owner;
- Security Owner;
- Billing Owner;
- Release Manager.

Esto es un **SINGLE-OPERATOR TEMPORARY MODEL**. No constituye separación de funciones. El acceso Owner es necesario mientras exista una sola persona responsable y, dado que no hay miembros adicionales, el inventario satisface el mínimo acceso humano posible para operar la organización. Cuando exista un segundo administrador de confianza deben revisarse la continuidad, la segregación y el rol mínimo de cada cuenta.

## MFA

- MFA individual de la única cuenta humana con privilegios: **ENABLED**, verificado en la vista Team de la organización.
- Enforcement MFA de organización: **OFF**.
- El plan Pro permite exigir MFA a nivel de organización, pero no se activó porque actualmente hay un solo Owner y no se verificó un segundo administrador ni un factor de respaldo independiente. Activarlo en esas condiciones agregaría riesgo de lockout.
- Mejora futura: registrar un segundo administrador de confianza con mínimo privilegio y validar un factor de respaldo; luego evaluar la activación del enforcement organizacional mediante una ventana controlada.

Supabase documenta que habilitar el enforcement bloquea inmediatamente el acceso de miembros sin MFA y que los Owner deben tener MFA antes de activarlo. También recomienda dos factores TOTP independientes para reducir el riesgo de pérdida de acceso. Referencias: [Account MFA](https://supabase.com/docs/guides/platform/multi-factor-authentication) y [Organization MFA enforcement](https://supabase.com/docs/guides/platform/mfa/org-mfa-enforcement).

## Billing y control de costos

| Control | Estado |
| --- | --- |
| Plan | Pro vigente |
| Responsable operativo de billing | Jorge, como único Owner y Billing Owner temporal |
| Método de pago | configurado; no se registran marca, últimos dígitos ni otros datos |
| Ciclo/factura | panel operativo con próxima factura y uso desglosado disponibles |
| Spend Cap | **ENABLED** |
| Compute activo | un proyecto micro |
| PITR / add-ons con costo | deshabilitados |

El Spend Cap evita cargos adicionales por uso cubierto por ese control, pero puede volver al proyecto no responsivo o read-only si supera la cuota incluida. No cubre todos los conceptos: compute y ciertos add-ons se facturan independientemente. Supabase no ofrece alertas presupuestarias finas en este flujo; el control operativo es revisar Usage y Upcoming Invoice durante el ciclo. No se cambió plan, compute, Spend Cap, método de pago ni add-on durante esta auditoría. Referencias: [Cost Control](https://supabase.com/docs/guides/platform/cost-control) y [Billing on Supabase](https://supabase.com/docs/guides/platform/billing-on-supabase).

## GitHub y release

La rama `afucoa-v2` tiene una regla de protección que aplica a una rama. Force push y eliminación permanecen deshabilitados. La protección y el Environment `production` ya validados en Fase 3E siguen siendo la autoridad para promoción; esta auditoría fue read-only y no cambió reglas ni workflows.

## Riesgos residuales y revisiones

1. El modelo de una sola persona concentra funciones y presenta riesgo de continuidad. Revisar al incorporar un segundo administrador de confianza.
2. El enforcement MFA organizacional permanece deshabilitado para evitar lockout. El MFA individual del único Owner sí está habilitado.
3. El Spend Cap reduce exposición variable, pero no limita compute ni todos los add-ons y puede afectar disponibilidad al alcanzar cuotas.
4. Las revisiones de uso, factura próxima, miembros, MFA y add-ons son manuales hasta integrar monitoring/gobernanza operativa; B09 permanece abierto.
5. PROD continúa sin usuarios, perfiles, objetos ni Edge Functions. B03, B04, B05, B09 y B10 conservan pendientes propios.

Revisar este inventario al menos trimestralmente y ante cualquier cambio de miembro, rol, plan, compute, add-on, método de pago, factor MFA o responsable operativo.

## Dictamen B02

**B02 CLOSED:** la organización/proyecto aislados, ownership efectivo, responsables, acceso humano mínimo, MFA individual privilegiado, facturación operativa y controles de costo disponibles quedaron verificados. Los riesgos del modelo single-operator y del enforcement organizacional OFF están explícitos y no se ocultan como separación real de funciones.

Pilot 01 permanece **PARKED**. No se crearon usuarios, datos ni recursos y no se modificaron Supabase PROD/DEV, V1, `main`, hosting, secretos ni configuración.
