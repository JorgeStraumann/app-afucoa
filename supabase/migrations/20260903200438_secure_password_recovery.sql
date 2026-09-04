-- AFUCOA V2 DEV: recuperación de acceso segura y límites de abuso.
-- Las funciones de este archivo son SECURITY INVOKER y solo service_role puede
-- ejecutarlas. Las Edge Functions son la única frontera pública del flujo.

alter table public.password_recovery_codes
  add column if not exists invalidated_at timestamptz,
  add column if not exists max_attempts integer not null default 5,
  add column if not exists delivery_status text not null default 'pending',
  add column if not exists request_ip_hash text;

alter table public.password_recovery_codes
  drop constraint if exists password_recovery_codes_max_attempts_check,
  add constraint password_recovery_codes_max_attempts_check
    check (max_attempts between 1 and 10),
  drop constraint if exists password_recovery_codes_attempts_check,
  add constraint password_recovery_codes_attempts_check
    check (attempts >= 0 and attempts <= max_attempts),
  drop constraint if exists password_recovery_codes_delivery_status_check,
  add constraint password_recovery_codes_delivery_status_check
    check (delivery_status in ('pending', 'sent', 'failed')),
  drop constraint if exists password_recovery_codes_code_hash_check,
  add constraint password_recovery_codes_code_hash_check
    check (code_hash ~ '^[0-9a-f]{64}$'),
  drop constraint if exists password_recovery_codes_request_ip_hash_check,
  add constraint password_recovery_codes_request_ip_hash_check
    check (request_ip_hash is null or request_ip_hash ~ '^[0-9a-f]{64}$');

create index if not exists password_recovery_active_profile_idx
  on public.password_recovery_codes(profile_id, created_at desc)
  where consumed_at is null and invalidated_at is null;

create table if not exists public.password_recovery_rate_limits (
  scope text not null,
  subject_hash text not null check (subject_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default now(),
  hit_count integer not null default 0 check (hit_count >= 0),
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (scope, subject_hash)
);

create index if not exists password_recovery_rate_limits_updated_idx
  on public.password_recovery_rate_limits(updated_at);

alter table public.password_recovery_rate_limits enable row level security;
revoke all on public.password_recovery_rate_limits from public, anon, authenticated;
revoke all on public.password_recovery_codes from public, anon, authenticated;

create or replace function public.take_password_recovery_rate_limit(
  p_scope text,
  p_subject_hash text,
  p_limit integer,
  p_window_seconds integer,
  p_block_seconds integer
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.password_recovery_rate_limits%rowtype;
begin
  if p_scope not in ('request_ip', 'request_identity', 'confirm_ip', 'confirm_identity')
     or p_subject_hash !~ '^[0-9a-f]{64}$'
     or p_limit not between 1 and 100
     or p_window_seconds not between 60 and 86400
     or p_block_seconds not between 60 and 86400 then
    raise exception 'invalid_rate_limit_parameters';
  end if;

  select * into v_row
    from public.password_recovery_rate_limits
   where scope = p_scope and subject_hash = p_subject_hash
   for update;

  if not found then
    insert into public.password_recovery_rate_limits(
      scope, subject_hash, window_started_at, hit_count, updated_at
    ) values (p_scope, p_subject_hash, v_now, 1, v_now);
    return true;
  end if;

  if v_row.blocked_until is not null and v_row.blocked_until > v_now then
    update public.password_recovery_rate_limits
       set updated_at = v_now
     where scope = p_scope and subject_hash = p_subject_hash;
    return false;
  end if;

  if v_row.window_started_at + make_interval(secs => p_window_seconds) <= v_now then
    update public.password_recovery_rate_limits
       set window_started_at = v_now,
           hit_count = 1,
           blocked_until = null,
           updated_at = v_now
     where scope = p_scope and subject_hash = p_subject_hash;
    return true;
  end if;

  if v_row.hit_count >= p_limit then
    update public.password_recovery_rate_limits
       set blocked_until = v_now + make_interval(secs => p_block_seconds),
           updated_at = v_now
     where scope = p_scope and subject_hash = p_subject_hash;
    return false;
  end if;

  update public.password_recovery_rate_limits
     set hit_count = hit_count + 1,
         blocked_until = null,
         updated_at = v_now
   where scope = p_scope and subject_hash = p_subject_hash;
  return true;
end;
$$;

create or replace function public.register_password_recovery_code(
  p_recovery_id uuid,
  p_profile_id uuid,
  p_code_hash text,
  p_expires_at timestamptz,
  p_request_ip_hash text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_code_hash !~ '^[0-9a-f]{64}$'
     or p_request_ip_hash !~ '^[0-9a-f]{64}$'
     or p_expires_at <= v_now + interval '1 minute'
     or p_expires_at > v_now + interval '15 minutes' then
    raise exception 'invalid_recovery_parameters';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_profile_id::text, 0));

  if not exists (
    select 1 from public.profiles p
     where p.id = p_profile_id
       and p.auth_user_id is not null
       and p.status = 'activo'
  ) then
    return false;
  end if;

  update public.password_recovery_codes
     set invalidated_at = v_now
   where profile_id = p_profile_id
     and consumed_at is null
     and invalidated_at is null;

  insert into public.password_recovery_codes(
    id, profile_id, code_hash, expires_at, max_attempts,
    delivery_status, request_ip_hash
  ) values (
    p_recovery_id, p_profile_id, p_code_hash, p_expires_at, 5,
    'pending', p_request_ip_hash
  );

  return true;
end;
$$;

create or replace function public.consume_password_recovery_code(
  p_profile_id uuid,
  p_recovery_id uuid,
  p_candidate_hash text
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.password_recovery_codes%rowtype;
begin
  select * into v_row
    from public.password_recovery_codes
   where id = p_recovery_id and profile_id = p_profile_id
   for update;

  if not found or v_row.consumed_at is not null or v_row.invalidated_at is not null then
    return 'invalid';
  end if;

  if v_row.expires_at <= v_now then
    update public.password_recovery_codes set invalidated_at = v_now where id = v_row.id;
    return 'expired';
  end if;

  if v_row.attempts >= v_row.max_attempts then
    update public.password_recovery_codes set invalidated_at = v_now where id = v_row.id;
    return 'locked';
  end if;

  if v_row.code_hash <> p_candidate_hash then
    update public.password_recovery_codes
       set attempts = least(attempts + 1, max_attempts),
           invalidated_at = case when attempts + 1 >= max_attempts then v_now else invalidated_at end
     where id = v_row.id;
    if v_row.attempts + 1 >= v_row.max_attempts then return 'locked'; end if;
    return 'invalid';
  end if;

  update public.password_recovery_codes
     set consumed_at = v_now
   where id = v_row.id;
  return 'ok';
end;
$$;

revoke all on function public.take_password_recovery_rate_limit(text,text,integer,integer,integer) from public, anon, authenticated;
revoke all on function public.register_password_recovery_code(uuid,uuid,text,timestamptz,text) from public, anon, authenticated;
revoke all on function public.consume_password_recovery_code(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.take_password_recovery_rate_limit(text,text,integer,integer,integer) to service_role;
grant execute on function public.register_password_recovery_code(uuid,uuid,text,timestamptz,text) to service_role;
grant execute on function public.consume_password_recovery_code(uuid,uuid,text) to service_role;

-- Un perfil inactivo no debe conservar acceso de negocio aunque Auth siga vigente.
-- Estos SECURITY DEFINER se cambian por esa razón de seguridad, no para silenciar Advisor.
create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
    from public.profiles p
   where p.auth_user_id = auth.uid()
     and p.status = 'activo'
   limit 1;
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
    from public.profiles p
   where p.auth_user_id = auth.uid()
     and p.status = 'activo'
   limit 1;
$$;

create or replace function public.get_my_profile()
returns table (
  id uuid,
  role public.user_role,
  first_name text,
  last_name text,
  member_number text,
  document_number text,
  email text,
  phone text,
  department text,
  sector text,
  photo_url text,
  status public.member_status,
  joined_at date
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.role, p.first_name, p.last_name, p.member_number,
         p.document_number, p.email, p.phone, p.department, p.sector,
         p.photo_url, p.status, p.joined_at
    from public.profiles p
   where p.auth_user_id = auth.uid()
     and p.status = 'activo'
   limit 1;
$$;

create or replace function public.update_my_contact(p_email text, p_phone text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.profiles
     set email = nullif(trim(p_email), ''),
         phone = nullif(trim(p_phone), ''),
         updated_at = now()
   where auth_user_id = auth.uid()
     and status = 'activo';
  return found;
end;
$$;

revoke all on function public.current_profile_id() from public;
revoke all on function public.current_user_role() from public;
revoke all on function public.get_my_profile() from public;
revoke all on function public.update_my_contact(text,text) from public;
grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.update_my_contact(text,text) to authenticated;
