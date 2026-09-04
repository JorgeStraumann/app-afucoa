-- Evaluate wall-clock time after waiting for locks, never before.
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
  if p_scope is null or p_subject_hash is null or p_limit is null
     or p_window_seconds is null or p_block_seconds is null
     or p_scope not in ('request_ip', 'request_identity', 'confirm_ip', 'confirm_identity', 'request_global', 'confirm_global')
     or p_subject_hash !~ '^[0-9a-f]{64}$'
     or p_limit not between 1 and 100
     or p_window_seconds not between 60 and 86400
     or p_block_seconds not between 60 and 86400 then
    raise exception 'invalid_rate_limit_parameters';
  end if;

  -- Serialize first insertion as well as subsequent increments.
  perform pg_advisory_xact_lock(hashtextextended(p_scope || ':' || p_subject_hash, 1));
  select * into v_row
    from public.password_recovery_rate_limits
   where scope = p_scope and subject_hash = p_subject_hash
   for update;
  v_now := clock_timestamp();

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
  if p_candidate_hash is null or p_candidate_hash !~ '^[0-9a-f]{64}$' then return 'invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_profile_id::text, 0));
  select * into v_row
    from public.password_recovery_codes
   where id = p_recovery_id and profile_id = p_profile_id
   for update;
  v_now := clock_timestamp();

  if not found or v_row.consumed_at is not null or v_row.invalidated_at is not null then
    return 'invalid';
  end if;

  if v_row.delivery_status <> 'sent' or not exists (
    select 1 from public.profiles p where p.id = p_profile_id
      and p.status = 'activo' and p.auth_user_id = v_row.auth_user_id
  ) then return 'invalid'; end if;

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
