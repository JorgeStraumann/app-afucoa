-- DEV only; no persistent changes.
begin;
do $$
declare role_name text; routine_name text;
begin
  foreach role_name in array array['anon','authenticated'] loop
    if has_table_privilege(role_name,'public.password_recovery_codes','select')
       or has_table_privilege(role_name,'public.password_recovery_codes','insert')
       or has_table_privilege(role_name,'public.password_recovery_rate_limits','select')
       or has_table_privilege(role_name,'public.password_recovery_rate_limits','update') then
      raise exception 'recovery_table_exposed_to_%', role_name;
    end if;
    foreach routine_name in array array[
      'public.take_password_recovery_rate_limit(text,text,integer,integer,integer)',
      'public.register_password_recovery_code(uuid,uuid,text,timestamptz,text)',
      'public.consume_password_recovery_code(uuid,uuid,text)'
    ] loop
      if has_function_privilege(role_name,routine_name,'execute') then
        raise exception 'recovery_rpc_exposed_to_%', role_name;
      end if;
    end loop;
  end loop;
end $$;

update public.profiles set status='inactivo' where document_number='10000001';
select set_config('request.jwt.claims',jsonb_build_object(
  'sub',(select auth_user_id from public.profiles where document_number='10000001'),
  'role','authenticated')::text,true);
set local role authenticated;
do $$
begin
  if public.current_profile_id() is not null or public.current_user_role() is not null then
    raise exception 'inactive_identity_has_business_context';
  end if;
  if exists(select 1 from public.get_my_profile()) then raise exception 'inactive_profile_returned'; end if;
  if public.update_my_contact('not-written@example.invalid',null) then raise exception 'inactive_contact_update'; end if;
  begin
    perform public.create_my_proposal('TEST NO INSERT','Esta propuesta no debe insertarse.');
    raise exception 'inactive_proposal_allowed';
  exception when raise_exception then
    if sqlerrm <> 'not_authenticated' then raise; end if;
  end;
end $$;
reset role;
rollback;
