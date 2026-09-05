# AFUCOA V2 — Evidencia de bootstrap canónico PROD

Fecha: 5 de septiembre de 2026 (America/Montevideo)

Estado: bootstrap exclusivo de Database completado; **AFUCOA V2 no está habilitada para producción**.

## Destino autorizado

| Campo | Evidencia |
| --- | --- |
| Project ref PROD | `rywdochyzhgfaymrmxek` |
| Organización | `AFUCOA PROD` |
| Plan organización | Pro |
| Región | `sa-east-1` |
| Estado del proyecto | `ACTIVE_HEALTHY` |
| SHA de aplicación previo al bootstrap | `c45e78d6c807c474addf526ce68b809dc627420d` |
| Supabase CLI | `2.116.0`, ejecución temporal con `pnpm dlx` |

El link local fue verificado como `rywdochyzhgfaymrmxek` e `is_dev=false` antes de conectar. No se usó el proyecto DEV ni V1.

## Precheck y dry-run

- `pnpm test:migrations`: PASS, 17 migraciones, 17/17 checksums, cero versiones obsoletas.
- `MANIFEST.json` y los 17 archivos SQL coincidieron en nombre y orden.
- `supabase db push --linked --dry-run` informó exactamente las 17 migraciones históricas.
- No apareció migración inesperada, divergencia, SQL no versionado ni solicitud de `migration repair`.
- Se conservó el nombre histórico `20260904023548_web_push_dev.sql`.

## Push e historial

El push se ejecutó con Supabase CLI sobre el link PROD autorizado. Las 17 migraciones se aplicaron consecutivamente, sin modificación, squash, baseline, seed, fixture, repair ni intervención SQL manual.

`supabase migration list --linked` mostró correspondencia Local=Remote para exactamente estas versiones:

1. `20260901012911`
2. `20260901013024`
3. `20260901013043`
4. `20260901013059`
5. `20260901013115`
6. `20260901013137`
7. `20260901013205`
8. `20260901013226`
9. `20260901020856`
10. `20260901021400`
11. `20260902013551`
12. `20260903200438`
13. `20260904001121`
14. `20260904002017`
15. `20260904023548`
16. `20260904024725`
17. `20260905002735`

No existe ninguna versión generada en la fecha del bootstrap.

## Resultado estructural read-only

| Control | Resultado PROD | Baseline esperado |
| --- | ---: | ---: |
| Migraciones remotas | 17 | 17 |
| Tablas `public` | 28 | 28 |
| Tablas `public` con RLS | 28 | 28 |
| Políticas `public` | 46 | 46 |
| Políticas Storage | 11 | 11 |
| Funciones `public` | 26 | 26 |
| Funciones `public` `SECURITY DEFINER` | 17 | 17 |
| Buckets | 3 | 3 |
| Objetos Storage | 0 | 0 |
| Usuarios Auth | 0 | 0 |
| Edge Functions | 0 | 0 |
| Filas de negocio | 0 | 0 |

Los objetos esperados coinciden con el snapshot estructural DEV previamente documentado. La comparación se hizo contra evidencia versionada; DEV no fue consultado ni modificado en esta fase.

### Buckets creados por migración

| Bucket | Público | Límite | MIME permitido |
| --- | ---: | ---: | --- |
| `documents-private` | No | 20 MB | PDF |
| `request-files` | No | 10 MB | PDF, JPEG, PNG |
| `public-media` | Sí | 10 MB | JPEG, PNG, WebP |

La única fila pública no vacía es `app_settings=1`, configuración técnica creada canónicamente por `20260904023548_web_push_dev.sql`. No es fixture, seed ni dato copiado de DEV. Todas las tablas de perfiles, contenidos, trámites, documentos, propuestas, notificaciones, dispositivos, recovery y auditoría permanecen vacías.

## Advisors

Se ejecutaron Advisors read-only después del bootstrap. Reprodujeron las categorías esperadas ya clasificadas en `PRODUCTION_READINESS.md`: dos tablas server-only con RLS sin policy pública, funciones `SECURITY DEFINER` intencionales sujetas a revisión individual y findings de rendimiento propios de una base recién creada. No se modificó ninguna función/policy para silenciar warnings.

## Alcance preservado

- no se crearon usuarios Auth ni identidades sintéticas;
- no se desplegaron Edge Functions;
- no se cargaron objetos Storage, seeds, fixtures o datos reales;
- no se configuraron Auth, redirects, Leaked Password Protection, secrets, Resend, VAPID, dominio, hosting o workflows PROD;
- no se ejecutó Pilot 01;
- no se modificó ningún SQL histórico.

## Readiness

- **B01 CLOSED:** base `public` vacía al inicio, 17 migraciones aplicadas sin intervención, historial exacto y estructura esperada coincidente.
- **B02 PARTIAL:** proyecto PROD separado, organización Pro, región y aislamiento confirmados. Falta cerrar gobernanza de accesos mínimos, responsables/facturación y validaciones operativas de la infraestructura.
- B03–B10 permanecen abiertos; Pilot 01 continúa PARKED.
