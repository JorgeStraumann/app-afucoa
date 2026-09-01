# Matriz de pruebas RLS — AFUCOA V2

Ejecutar en un proyecto Supabase de desarrollo con cuatro identidades: anon, socio A, socio B y admin.

| Caso | anon | socio A | socio B | admin |
|---|---|---|---|---|
| Leer perfil socio A | No | Sí | No | Sí |
| Editar rol/ficha directamente | No | No | No | Solo flujo admin |
| Leer solicitud de socio A | No | Sí | No | Sí |
| Leer adjunto de solicitud A | No | Sí | No | Sí |
| Crear propuesta propia | No | Sí | Sí | Sí |
| Apoyar propuesta publicada dos veces | No | 1 registro | 1 registro | 1 registro |
| Leer documentos publicados | No* | Sí | Sí | Sí |
| Leer audit_log | No | No | No | Sí |
| Leer tabla de códigos de recuperación | No | No | No | No desde cliente |
| Verificar QR vigente por RPC | Sí | Sí | Sí | Sí |

`*` El portal actual exige sesión para biblioteca. La verificación QR es la única ruta pública de datos de membresía.

Además probar: token QR vencido/revocado, usuario dado de baja, archivo con path ajeno, propuesta cerrada, sesión admin degradada a socio y recuperación con más de cinco intentos.

## Prueba automatizada

`rls-live-check.mjs` ejecuta la matriz contra identidades reales y requiere las variables de entorno `AFUCOA_SUPABASE_URL`, `AFUCOA_PUBLISHABLE_KEY` y `AFUCOA_TEST_USERS`. Las credenciales nunca deben guardarse en el repositorio.

`supabase-integration-live.mjs` amplía la matriz con flujos reales de contacto, borrador y envío de trámite, mensajes visibles e internos, carga y descarga privada, moderación y apoyos de propuestas, y rotación/verificación del QR. Requiere una segunda identidad con rol `socio`; en DEV se puede degradar temporalmente la cuenta admin y se debe restaurar en un bloque de limpieza aunque la prueba falle.

## Última ejecución en DEV

Fecha: 31 de agosto de 2026 (1 de septiembre UTC). Proyecto: `imiplnspvmsrsuikulwm`.

- Matriz base: 40/40 controles aprobados.
- Integración profunda inicial: 32/34; detectó ambigüedad SQL en `create_membership_verification_token`.
- Integración profunda tras la corrección: 34/34 controles aprobados.
- Logins verificados: socio, admin y superadmin.
- Aislamiento socio A/socio B aprobado para solicitudes, mensajes, metadatos y objetos de Storage.
- Mi Cuenta: contacto editable; rol y ficha inmutables para socio.
- Propuestas: moderación, apoyo único, cierre, autoría y total de apoyos aprobados.
- QR: generación, validación anónima mínima y revocación del token anterior aprobadas.
- Limpieza: fixtures, objetos privados y tokens temporales eliminados; roles y contacto restaurados.
