-- Synthetic DEV assertions; no external push and no persistent fixtures.
begin;
do $$
declare a uuid; b uuid; au uuid; bu uuid; d uuid; again uuid;
  endpoint_test text := 'https://fcm.googleapis.com/test-'||gen_random_uuid();
  n uuid; category text; pref_column text; cycle integer;
begin
  select id,auth_user_id into strict a,au from public.profiles where document_number='10000001';
  select id,auth_user_id into strict b,bu from public.profiles where document_number='10000002';
  update public.app_settings set value=jsonb_set(value,'{allowPush}','true') where key='features';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',au,'role','authenticated')::text,true);
  set local role authenticated;
  d:=public.register_my_push_subscription(endpoint_test,repeat('A',87),repeat('B',22),'web-test');
  again:=public.register_my_push_subscription(endpoint_test,repeat('A',87),repeat('B',22),'web-test');
  if d<>again then raise exception 'duplicate_endpoint'; end if;
  if not public.touch_my_push_subscription(endpoint_test) then raise exception 'touch_failed'; end if;
  if has_column_privilege('authenticated','public.push_devices','endpoint','SELECT') then raise exception 'endpoint_exposed'; end if;
  begin
    update public.push_devices set active=false where id=d;
    raise exception 'direct_write_allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.claim_notification_push(gen_random_uuid(),d,a);
    raise exception 'client_can_send';
  exception when insufficient_privilege then null; end;
  reset role;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',bu,'role','authenticated')::text,true);
  set local role authenticated;
  if public.touch_my_push_subscription(endpoint_test) then raise exception 'wrong_owner_touch'; end if;
  begin
    perform public.register_my_push_subscription(endpoint_test,repeat('C',87),repeat('D',22),'web-test');
    raise exception 'identity_takeover';
  exception when raise_exception then if sqlerrm<>'subscription_conflict' then raise; end if; end;
  -- Account switching must safely re-own an already matching endpoint even if
  -- the global kill switch is off; actual activation/sending remains blocked.
  reset role;
  update public.app_settings set value=jsonb_set(value,'{allowPush}','false') where key='features';
  set local role authenticated;
  again:=public.register_my_push_subscription(endpoint_test,repeat('A',87),repeat('B',22),'web-test');
  if d<>again then raise exception 'device_transfer_created_duplicate'; end if;
  reset role;
  if (select profile_id from public.push_devices where id=d)<>b then raise exception 'device_not_transferred'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',au,'role','authenticated')::text,true);
  set local role authenticated;
  if public.unregister_my_push_subscription(endpoint_test) then raise exception 'previous_owner_can_disable'; end if;
  perform public.register_my_push_subscription(endpoint_test,repeat('A',87),repeat('B',22),'web-test');
  reset role;
  update public.app_settings set value=jsonb_set(value,'{allowPush}','true') where key='features';
  insert into public.notification_preferences(profile_id) values(a) on conflict do nothing;
  for category,pref_column in select * from (values('convenio','agreements'),('evento','events'),('tramite','request_updates'),('institucional','news'),('documento','news'),('propuesta','news'),('sistema','news')) mapping loop
    insert into public.notifications(type,title,body,target_path) values(category::public.notification_type,'PUSH SQL TEST','Synthetic','#/notificaciones') returning id into n;
    insert into public.notification_recipients(notification_id,profile_id) values(n,a);
    execute format('update public.notification_preferences set %I=false where profile_id=$1',pref_column) using a;
    if exists(select 1 from public.get_notification_push_targets(n) where device_id=d) then raise exception 'preference_ignored_%',category; end if;
    execute format('update public.notification_preferences set %I=true where profile_id=$1',pref_column) using a;
    if not exists(select 1 from public.get_notification_push_targets(n) where device_id=d) then raise exception 'eligible_target_missing'; end if;
  end loop;
  update public.app_settings set value=jsonb_set(value,'{allowPush}','false') where key='features';
  if exists(select 1 from public.get_notification_push_targets(n)) then raise exception 'kill_switch_targets'; end if;
  if public.claim_notification_push(n,d,a) then raise exception 'kill_switch_claim'; end if;
  set local role authenticated;
  begin
    perform public.register_my_push_subscription(endpoint_test||'-blocked',repeat('A',87),repeat('B',22),'web-test');
    raise exception 'kill_switch_registration';
  exception when raise_exception then if sqlerrm<>'push_disabled' then raise; end if; end;
  reset role;
  update public.app_settings set value=jsonb_set(value,'{allowPush}','true') where key='features';
  if not public.claim_notification_push(n,d,a) then raise exception 'claim_failed'; end if;
  if public.claim_notification_push(n,d,a) then raise exception 'duplicate_claim'; end if;
  set local role authenticated;
  if not public.unregister_my_push_subscription(endpoint_test) then raise exception 'unregister_failed'; end if;
  if public.touch_my_push_subscription(endpoint_test) then raise exception 'inactive_device_touched'; end if;
  for cycle in 1..21 loop
    perform public.register_my_push_subscription(endpoint_test||cycle,repeat('A',87),repeat('B',22),'web-test');
    perform public.unregister_my_push_subscription(endpoint_test||cycle);
  end loop;
  reset role;
  if has_function_privilege('anon','public.register_my_push_subscription(text,text,text,text)','EXECUTE') then raise exception 'anon_registration'; end if;
  if has_table_privilege('authenticated','public.notification_push_deliveries','SELECT') then raise exception 'private_delivery_report_exposed'; end if;
end $$;
rollback;
