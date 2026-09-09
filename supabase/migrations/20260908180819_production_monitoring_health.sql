-- Public, read-only production health contract for external monitoring.
-- SECURITY DEFINER is required because anon cannot inspect catalog metadata or
-- private Storage configuration. The function has no arguments, uses an empty
-- search_path, schema-qualifies every object, and returns fixed booleans only.
create or replace function public.production_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_database boolean := false;
  v_rls boolean := false;
  v_storage boolean := false;
  v_push boolean := false;
begin
  select
    to_regclass('public.profiles') is not null
    and to_regclass('public.notifications') is not null
    and to_regclass('public.notification_push_deliveries') is not null
    and to_regprocedure('public.is_privileged_aal2()') is not null
    and to_regprocedure('public.require_privileged_aal2()') is not null
    and to_regprocedure('public.is_admin()') is not null
    and to_regprocedure('public.claim_notification_push(uuid,uuid,uuid)') is not null
    and exists (
      select 1
        from pg_catalog.pg_attribute a
        join pg_catalog.pg_class c on c.oid = a.attrelid
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        join pg_catalog.pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
       where n.nspname = 'public'
         and c.relname = 'profiles'
         and a.attname = 'id'
         and pg_catalog.pg_get_expr(d.adbin, d.adrelid) like '%gen_random_uuid%'
    )
    into v_database;

  select not exists (
    select 1
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p')
       and not c.relrowsecurity
  ) into v_rls;

  select
    count(*) = 3
    and bool_and(
      case b.id
        when 'request-files' then
          not b.public
          and b.file_size_limit = 10485760
          and b.allowed_mime_types @> array['application/pdf','image/jpeg','image/png']::text[]
          and b.allowed_mime_types <@ array['application/pdf','image/jpeg','image/png']::text[]
        when 'documents-private' then
          not b.public
          and b.file_size_limit = 20971520
          and b.allowed_mime_types = array['application/pdf']::text[]
        when 'public-media' then
          b.public
          and b.file_size_limit = 10485760
          and b.allowed_mime_types @> array['image/jpeg','image/png','image/webp']::text[]
          and b.allowed_mime_types <@ array['image/jpeg','image/png','image/webp']::text[]
        else false
      end
    )
    and coalesce((
      select c.relrowsecurity
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'storage' and c.relname = 'objects'
       limit 1
    ), false)
    into v_storage
    from storage.buckets b
   where b.id in ('request-files', 'documents-private', 'public-media');

  select not exists (
    select 1
      from public.notification_push_deliveries d
     where d.status = 'sending'
       and d.updated_at < pg_catalog.now() - interval '10 minutes'
  ) into v_push;

  return pg_catalog.jsonb_build_object(
    'ok', v_database and v_rls and v_storage and v_push,
    'database', v_database,
    'rls', v_rls,
    'storage', v_storage,
    'push', v_push,
    'schemaContract', 19
  );
end;
$$;

revoke all on function public.production_health() from public, anon, authenticated, service_role;
grant execute on function public.production_health() to anon;

comment on function public.production_health() is
  'Minimal anonymous production health contract. Returns technical booleans only; no PII, identifiers, counts, SQL, endpoints, or secrets.';
