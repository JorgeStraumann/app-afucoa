-- Explicit activation is still blocked by allowPush=false in the frontend and
-- server. A matching browser subscription may only be re-owned safely so a
-- shared browser never remains linked to the account that logged out.
create or replace function public.register_my_push_subscription(p_endpoint text,p_p256dh text,p_auth text,p_platform text default 'web')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_profile uuid := public.current_profile_id(); v_id uuid;
begin
  if auth.uid() is null or v_profile is null then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.app_settings where key='features' and value->'allowPush'='true'::jsonb) and not exists(select 1 from public.push_devices where endpoint=p_endpoint and p256dh=p_p256dh and auth=p_auth) then raise exception 'push_disabled'; end if;
  if p_endpoint is null or length(p_endpoint)>2048 or p_endpoint !~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com|[a-z0-9-]+[.]notify[.]windows[.]com)/[^[:space:]#]+$'
    or p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{87}={0,1}$'
    or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{22}={0,2}$' then raise exception 'invalid_subscription'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_profile::text,9183));
  perform pg_advisory_xact_lock(hashtextextended(p_endpoint,9182));
  -- An endpoint alone is insufficient to take ownership: both encryption keys must match.
  if exists(select 1 from public.push_devices where endpoint=p_endpoint and (p256dh<>p_p256dh or auth<>p_auth)) then raise exception 'subscription_conflict'; end if;
  if not exists(select 1 from public.push_devices where endpoint=p_endpoint and profile_id=v_profile and active) and
     (select count(*) from public.push_devices where profile_id=v_profile and endpoint is not null and active)>=20 then raise exception 'device_limit'; end if;
  insert into public.push_devices(profile_id,endpoint,p256dh,auth,platform,active,last_seen_at)
  values(v_profile,p_endpoint,p_p256dh,p_auth,left(coalesce(p_platform,'web'),40),true,now())
  on conflict(endpoint) do update set profile_id=excluded.profile_id,active=true,last_seen_at=now(),platform=excluded.platform
  returning id into v_id;
  return v_id;
end $$;
