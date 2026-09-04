-- Ejecutar exclusivamente contra AFUCOA V2 DEV. La transacción siempre revierte.
begin;

do $$
declare
  v_profile uuid;
  v_first uuid := gen_random_uuid();
  v_second uuid := gen_random_uuid();
  v_attempts uuid := gen_random_uuid();
  v_expired uuid := gen_random_uuid();
  v_result text;
  v_allowed boolean;
  v_hash_a text := repeat('a', 64);
  v_hash_b text := repeat('b', 64);
  v_hash_c text := repeat('c', 64);
  v_hash_d text := repeat('d', 64);
  v_rate_hash text := repeat('e', 64);
begin
  select id into strict v_profile
    from public.profiles
   where document_number = '10000001'
     and status = 'activo'
     and auth_user_id is not null;

  if not public.register_password_recovery_code(v_first, v_profile, v_hash_a, now() + interval '10 minutes', repeat('1', 64)) then
    raise exception 'registration_failed';
  end if;
  if not public.register_password_recovery_code(v_second, v_profile, v_hash_b, now() + interval '10 minutes', repeat('2', 64)) then
    raise exception 'second_registration_failed';
  end if;
  if not exists (select 1 from public.password_recovery_codes where id = v_first and invalidated_at is not null) then
    raise exception 'previous_code_not_invalidated';
  end if;

  v_result := public.consume_password_recovery_code(v_profile, v_second, v_hash_b);
  if v_result <> 'invalid' then raise exception 'pending_delivery_accepted'; end if;
  update public.password_recovery_codes set delivery_status='sent' where id=v_second;
  v_result := public.consume_password_recovery_code(v_profile, v_second, null);
  if v_result <> 'invalid' then raise exception 'null_hash_accepted'; end if;
  v_result := public.consume_password_recovery_code(v_profile, v_second, v_hash_b);
  if v_result <> 'ok' then raise exception 'correct_code_failed: %', v_result; end if;
  v_result := public.consume_password_recovery_code(v_profile, v_second, v_hash_b);
  if v_result <> 'invalid' then raise exception 'code_was_reused: %', v_result; end if;

  perform public.register_password_recovery_code(v_attempts, v_profile, v_hash_c, now() + interval '10 minutes', repeat('3', 64));
  update public.password_recovery_codes set delivery_status='sent' where id=v_attempts;
  for i in 1..4 loop
    v_result := public.consume_password_recovery_code(v_profile, v_attempts, v_hash_d);
    if v_result <> 'invalid' then raise exception 'unexpected_attempt_%: %', i, v_result; end if;
  end loop;
  v_result := public.consume_password_recovery_code(v_profile, v_attempts, v_hash_d);
  if v_result <> 'locked' then raise exception 'attempt_limit_failed: %', v_result; end if;
  v_result := public.consume_password_recovery_code(v_profile, v_attempts, v_hash_c);
  if v_result <> 'invalid' then raise exception 'locked_code_accepted: %', v_result; end if;

  insert into public.password_recovery_codes(
    id, profile_id, auth_user_id, code_hash, expires_at, delivery_status, request_ip_hash
  ) values (v_expired, v_profile, (select auth_user_id from public.profiles where id=v_profile), v_hash_d, now() - interval '1 second', 'sent', repeat('4', 64));
  v_result := public.consume_password_recovery_code(v_profile, v_expired, v_hash_d);
  if v_result <> 'expired' then raise exception 'expired_code_failed: %', v_result; end if;

  perform public.register_password_recovery_code(gen_random_uuid(), v_profile, v_hash_a, now() + interval '10 minutes', repeat('5',64));
  update public.password_recovery_codes set delivery_status='sent', auth_user_id=gen_random_uuid()
   where profile_id=v_profile and consumed_at is null and invalidated_at is null;
  v_result := public.consume_password_recovery_code(v_profile,
    (select id from public.password_recovery_codes where profile_id=v_profile and consumed_at is null and invalidated_at is null limit 1), v_hash_a);
  if v_result <> 'invalid' then raise exception 'historical_auth_identity_accepted'; end if;

  delete from public.password_recovery_rate_limits
   where scope = 'request_identity' and subject_hash = v_rate_hash;
  for i in 1..3 loop
    v_allowed := public.take_password_recovery_rate_limit('request_identity', v_rate_hash, 3, 3600, 3600);
    if not v_allowed then raise exception 'rate_limit_blocked_too_early_%', i; end if;
  end loop;
  v_allowed := public.take_password_recovery_rate_limit('request_identity', v_rate_hash, 3, 3600, 3600);
  if v_allowed then raise exception 'rate_limit_did_not_block'; end if;
end;
$$;

rollback;
