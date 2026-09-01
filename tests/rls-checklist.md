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
