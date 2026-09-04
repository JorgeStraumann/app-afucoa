-- AFUCOA V2 DEV only. Legacy token records remain readable but never sent as Web Push.
alter table public.push_devices alter column token drop not null;
alter table public.push_devices add column endpoint text unique;
alter table public.push_devices add column p256dh text;
alter table public.push_devices add column auth text;
alter table public.push_devices add constraint push_web_keys check (
  endpoint is null or (p256dh is not null and auth is not null)
);
create index push_devices_active_profile_idx on public.push_devices(profile_id) where active and endpoint is not null;
insert into public.app_settings(key,value,description)
values ('features','{"allowPush":true}'::jsonb,'Funciones operativas de AFUCOA V2 DEV') on conflict(key) do nothing;

-- RPC-only writes prevent caller-supplied profile IDs and cross-account endpoint duplication.
drop policy if exists push_devices_own on public.push_devices;
create policy push_devices_own_select on public.push_devices for select to authenticated
using (profile_id = (select public.current_profile_id()));
alter table public.push_devices enable row level security;
revoke all on public.push_devices from public, anon, authenticated;
grant select(id,profile_id,active,platform,last_seen_at,created_at) on public.push_devices to authenticated;
grant all on public.push_devices to service_role;

create function public.register_my_push_subscription(p_endpoint text,p_p256dh text,p_auth text,p_platform text default 'web')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_profile uuid := public.current_profile_id(); v_id uuid;
begin
  if auth.uid() is null or v_profile is null then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.app_settings where key='features' and value->'allowPush'='true'::jsonb) then raise exception 'push_disabled'; end if;
  if p_endpoint is null or length(p_endpoint)>2048 or p_endpoint !~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com|[a-z0-9-]+[.]notify[.]windows[.]com)/[^[:space:]#]+$'
    or p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{87}={0,1}$'
    or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{22}={0,2}$' then raise exception 'invalid_subscription'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_endpoint,9182));
  -- An endpoint alone is insufficient to take ownership: both encryption keys must match.
  if exists(select 1 from public.push_devices where endpoint=p_endpoint and (p256dh<>p_p256dh or auth<>p_auth)) then raise exception 'subscription_conflict'; end if;
  if not exists(select 1 from public.push_devices where endpoint=p_endpoint) and
     (select count(*) from public.push_devices where profile_id=v_profile and endpoint is not null)>=20 then raise exception 'device_limit'; end if;
  insert into public.push_devices(profile_id,endpoint,p256dh,auth,platform,active,last_seen_at)
  values(v_profile,p_endpoint,p_p256dh,p_auth,left(coalesce(p_platform,'web'),40),true,now())
  on conflict(endpoint) do update set profile_id=excluded.profile_id,active=true,last_seen_at=now(),platform=excluded.platform
  returning id into v_id;
  return v_id;
end $$;

create function public.unregister_my_push_subscription(p_endpoint text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authorized'; end if;
  update public.push_devices set active=false where endpoint=p_endpoint and profile_id=public.current_profile_id();
  return found;
end $$;

create function public.touch_my_push_subscription(p_endpoint text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authorized'; end if;
  update public.push_devices set last_seen_at=now() where endpoint=p_endpoint and active and profile_id=public.current_profile_id();
  return found;
end $$;
revoke all on function public.register_my_push_subscription(text,text,text,text),public.unregister_my_push_subscription(text),public.touch_my_push_subscription(text) from public,anon;
grant execute on function public.register_my_push_subscription(text,text,text,text),public.unregister_my_push_subscription(text),public.touch_my_push_subscription(text) to authenticated;

-- No endpoint/keys in delivery reports or user-visible logs.
create table public.notification_push_deliveries (
  notification_id uuid references public.notifications(id) on delete cascade,
  device_id uuid references public.push_devices(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  status text not null check(status in ('sending','sent','failed','inactive')),
  attempts integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key(notification_id,device_id)
);
alter table public.notification_push_deliveries enable row level security;
revoke all on public.notification_push_deliveries from public,anon,authenticated;
grant all on public.notification_push_deliveries to service_role;
create index notification_push_deliveries_profile_idx on public.notification_push_deliveries(profile_id);
create index notification_push_deliveries_device_idx on public.notification_push_deliveries(device_id);

create function public.get_notification_push_targets(p_notification_id uuid)
returns table(device_id uuid,profile_id uuid,endpoint text,p256dh text,auth text)
language sql stable security invoker set search_path = '' as $$
  select d.id,d.profile_id,d.endpoint,d.p256dh,d.auth
  from public.notifications n
  join public.notification_recipients r on r.notification_id=n.id
  join public.profiles p on p.id=r.profile_id and p.status='activo'
  join public.push_devices d on d.profile_id=p.id and d.active and d.endpoint is not null
  left join public.notification_preferences pref on pref.profile_id=p.id
  where n.id=p_notification_id and (n.expires_at is null or n.expires_at>now())
    and not exists(select 1 from public.notification_push_deliveries delivery
      where delivery.notification_id=n.id and delivery.device_id=d.id
        and (delivery.status<>'failed' or delivery.attempts>=3 or delivery.updated_at>now()-interval '60 seconds'))
    and exists(select 1 from public.app_settings where key='features' and value->'allowPush'='true'::jsonb)
    and case n.type::text
      when 'convenio' then coalesce(pref.agreements,true)
      when 'evento' then coalesce(pref.events,true)
      when 'tramite' then coalesce(pref.request_updates,true)
      else coalesce(pref.news,true) end
$$;

create function public.claim_notification_push(p_notification_id uuid,p_device_id uuid,p_profile_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  -- Recheck recipients, ownership, kill switch and preference at claim time.
  if not exists(select 1 from public.get_notification_push_targets(p_notification_id) t where t.device_id=p_device_id and t.profile_id=p_profile_id) then return false; end if;
  insert into public.notification_push_deliveries(notification_id,device_id,profile_id,status)
  values(p_notification_id,p_device_id,p_profile_id,'sending')
  on conflict(notification_id,device_id) do update set status='sending',attempts=public.notification_push_deliveries.attempts+1,updated_at=now()
  where public.notification_push_deliveries.status='failed' and public.notification_push_deliveries.attempts<3
    and public.notification_push_deliveries.profile_id=p_profile_id
    and public.notification_push_deliveries.updated_at<now()-interval '60 seconds';
  return found;
end $$;
revoke all on function public.get_notification_push_targets(uuid),public.claim_notification_push(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_notification_push_targets(uuid),public.claim_notification_push(uuid,uuid,uuid) to service_role;
