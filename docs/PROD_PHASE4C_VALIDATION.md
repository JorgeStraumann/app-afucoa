# AFUCOA V2 — Validación post-deploy PROD (Fase 4C)

Fecha: 24 de septiembre de 2026 (America/Montevideo)

Rama: `afucoa-v2`

SHA funcional desplegado y validado: `e91327e17fa0b813f354f4d00345ef26cd55d38f`

Workflow PROD: run `35800017711`, `SUCCESS`

Cloudflare Pages deployment: `81c04089-9f91-4712-97a9-7f8b73c07c65`

Origin canónico: `https://afucoa-v2-prod.pages.dev/`

Supabase PROD: `rywdochyzhgfaymrmxek`

## Dictamen

**GO TÉCNICO.** El blocker funcional detectado en Fase 4A quedó corregido y revalidado sobre el origin público con el SHA exacto autorizado. Administración → Propuestas cargó datos reales sintéticos sin `PGRST201`, mostró autor y apoyos correctos, permitió moderación y presentó el estado vacío esperado. En modo Supabase no reapareció contenido demo ante errores.

Este dictamen no habilita personas reales. B01–B09 permanecen `CLOSED`; B10 continúa `OPEN`; Pilot 01 continúa `PARKED`.

## Validación pública

- Socio sintético: login correcto; no vio enlaces de Administración; el acceso manual a `#/admin` fue rechazado.
- Admin sintético: MFA TOTP/AAL2 correcto; acceso a Administración → Propuestas; autor `Socio Sintético Fase 4C`; conteos de apoyos `1` y `0`; moderación a `publicada` confirmada por la UI.
- Superadmin sintético: MFA TOTP/AAL2 correcto y acceso administrativo confirmado.
- Consulta live: dos propuestas sintéticas; sin `PGRST201`, sin error de página y sin errores de consola.
- Estado vacío: el filtro sin coincidencias mostró `0 propuestas` y `No hay resultados`.
- Smoke autenticado: Inicio, Carné, Convenios, Trámites, Biblioteca, Propuestas, Notificaciones y Mi Cuenta.
- Responsive: 390×844, 768×1024 y 1440×900 sin overflow horizontal; navegación y sesión estables.

La revisión móvil 390×844 se ejecutó sobre la URL pública. La captura exacta de esa ejecución no quedó persistida correctamente; se conserva la captura móvil del shell administrativo de Fase 4A y, para el flujo corregido, evidencia nueva en tablet y desktop. No se presenta una imagen reescalada como si fuera evidencia mobile.

## Evidencia visual

- [Mobile admin shell — 390×844, Fase 4A](evidence/prod-pre-go-live-2026-09-20/mobile-admin-dashboard.png)
- [Administración → Propuestas — 768×1024, Fase 4C](evidence/prod-phase4c-2026-09-24/tablet-admin-propuestas-768x1024.png)
- [Administración → Propuestas — 1440×900, Fase 4C](evidence/prod-phase4c-2026-09-24/desktop-admin-propuestas-1440x900.png)

Las capturas contienen únicamente identidades inequívocamente sintéticas y no incluyen contraseñas, secretos, códigos TOTP ni datos reales.

## Cleanup PROD

Se eliminaron exclusivamente los artefactos sintéticos creados para Fase 4C. La consulta read-only final confirmó:

| Recurso | Conteo final |
| --- | ---: |
| Auth users sintéticos | 0 |
| MFA factors sintéticos | 0 |
| Profiles sintéticos | 0 |
| Proposals sintéticas | 0 |
| Proposal supports sintéticos | 0 |
| Proposal moderation events sintéticos | 0 |
| Audit log asociado | 0 |

No se modificaron datos reales, migraciones, RLS, funciones `SECURITY DEFINER`, Edge Functions, Auth settings, secretos ni infraestructura.

## Regresión local de cierre

| Suite | Resultado |
| --- | --- |
| `pnpm test:admin-proposals` | 3/3 PASS |
| `pnpm test:navigation` | 5/5 PASS |
| `pnpm test:session` | 11/11 PASS |
| `pnpm test:prod-artifact` | 16/16 PASS + build/check sintético PASS |
| `pnpm test:prod-hosting` | 18/18 PASS |
| `pnpm test:staging` | PASS; migraciones 19/19, edge-config 14/14, aislamiento Auth LIVE 1/1, monitoring 7/7, admin-proposals 3/3, build 142 módulos y chequeo de artefacto PASS |

No se reejecutaron matrices LIVE generales contra DEV o PROD: este cierre no cambió SQL/RLS y no se introdujeron credenciales de cuentas compartidas. Se conserva la evidencia RLS/integración ya aprobada y las regresiones específicas confirman que el fix no relaja autorización.

## Estado de despliegue

PROD conserva el SHA funcional `e91327e17fa0b813f354f4d00345ef26cd55d38f`. El cierre posterior es documental y no debe producir una segunda promoción PROD. El siguiente paso es exclusivamente institucional: resolver B10 mediante una decisión GO/NO-GO separada antes de cualquier alta real o reactivación de Pilot 01.
