alter table public.profiles
  add constraint profiles_auth_user_fk
  foreign key (auth_user_id) references auth.users(id) on delete set null;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id from public.profiles p where p.auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('admin','superadmin'), false);
$$;

revoke all on function public.current_profile_id() from public;
revoke all on function public.current_user_role() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;

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
   where auth_user_id = auth.uid();
  return found;
end;
$$;

create or replace function public.save_my_request_draft(
  p_definition_id uuid,
  p_payload jsonb,
  p_current_step integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid := public.current_profile_id();
  v_id uuid;
begin
  if v_profile is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.request_definitions d where d.id = p_definition_id and d.active) then
    raise exception 'invalid_request_definition';
  end if;
  insert into public.request_drafts(profile_id, definition_id, payload, current_step)
  values(v_profile, p_definition_id, coalesce(p_payload, '{}'::jsonb), greatest(coalesce(p_current_step,0),0))
  on conflict(profile_id, definition_id)
  do update set payload = excluded.payload, current_step = excluded.current_step, updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.submit_my_request(p_definition_id uuid, p_payload jsonb)
returns table(id uuid, request_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid := public.current_profile_id();
  v_request public.requests%rowtype;
begin
  if v_profile is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.request_definitions d where d.id = p_definition_id and d.active) then
    raise exception 'invalid_request_definition';
  end if;
  insert into public.requests(profile_id, definition_id, status, payload, submitted_at)
  values(v_profile, p_definition_id, 'recibida', coalesce(p_payload, '{}'::jsonb), now())
  returning * into v_request;
  insert into public.request_events(request_id, actor_profile_id, event_type, message, visible_to_member)
  values(v_request.id, v_profile, 'submitted', 'Solicitud recibida por AFUCOA', true);
  delete from public.request_drafts where profile_id = v_profile and definition_id = p_definition_id;
  return query select v_request.id, v_request.request_number;
end;
$$;

create or replace function public.mark_my_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_recipients nr
     set read_at = coalesce(nr.read_at, now())
   where nr.notification_id = p_notification_id
     and nr.profile_id = public.current_profile_id();
  return found;
end;
$$;

revoke all on function public.get_my_profile() from public;
revoke all on function public.update_my_contact(text,text) from public;
revoke all on function public.save_my_request_draft(uuid,jsonb,integer) from public;
revoke all on function public.submit_my_request(uuid,jsonb) from public;
revoke all on function public.mark_my_notification_read(uuid) from public;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.update_my_contact(text,text) to authenticated;
grant execute on function public.save_my_request_draft(uuid,jsonb,integer) to authenticated;
grant execute on function public.submit_my_request(uuid,jsonb) to authenticated;
grant execute on function public.mark_my_notification_read(uuid) to authenticated;

create or replace function public.create_membership_verification_token()
returns table(token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile uuid := public.current_profile_id();
  v_raw text;
  v_expires timestamptz := now() + interval '5 minutes';
begin
  if v_profile is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_profile and p.status = 'activo') then
    raise exception 'membership_not_active';
  end if;
  update public.membership_verification_tokens
     set revoked_at = now()
   where profile_id = v_profile and revoked_at is null and expires_at > now();
  v_raw := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.membership_verification_tokens(profile_id, token_hash, expires_at)
  values(v_profile, encode(extensions.digest(v_raw, 'sha256'), 'hex'), v_expires);
  return query select v_raw, v_expires;
end;
$$;

create or replace function public.verify_membership_token(p_token text)
returns table(valid boolean, full_name text, member_number text, member_status public.member_status, expires_at timestamptz)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select true,
         concat_ws(' ', p.first_name, p.last_name),
         p.member_number,
         p.status,
         t.expires_at
  from public.membership_verification_tokens t
  join public.profiles p on p.id = t.profile_id
  where t.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and t.revoked_at is null
    and t.expires_at > now()
    and p.status = 'activo'
  limit 1;
$$;

revoke all on function public.create_membership_verification_token() from public;
grant execute on function public.create_membership_verification_token() to authenticated;
revoke all on function public.verify_membership_token(text) from public;
grant execute on function public.verify_membership_token(text) to anon, authenticated;
