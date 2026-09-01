-- AFUCOA V2 — seguridad inicial para Supabase
-- Incremento 07
-- Ejecutar DESPUÉS de schema-v2.sql en un entorno de prueba.
-- Revisar políticas y datos antes de producción.

-- ---------------------------------------------------------------------------
-- 1. Vinculación Auth <-> perfil
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 2. RPCs seguras para el socio
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 3. QR verificable. Se almacena únicamente el hash del token.
-- ---------------------------------------------------------------------------

create or replace function public.create_membership_verification_token()
returns table(token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
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

  v_raw := encode(gen_random_bytes(24), 'hex');
  insert into public.membership_verification_tokens(profile_id, token_hash, expires_at)
  values(v_profile, encode(digest(v_raw, 'sha256'), 'hex'), v_expires);

  return query select v_raw, v_expires;
end;
$$;

create or replace function public.verify_membership_token(p_token text)
returns table(valid boolean, full_name text, member_number text, member_status public.member_status, expires_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select true,
         concat_ws(' ', p.first_name, p.last_name),
         p.member_number,
         p.status,
         t.expires_at
  from public.membership_verification_tokens t
  join public.profiles p on p.id = t.profile_id
  where t.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and t.revoked_at is null
    and t.expires_at > now()
    and p.status = 'activo'
  limit 1;
$$;

revoke all on function public.create_membership_verification_token() from public;
grant execute on function public.create_membership_verification_token() to authenticated;
revoke all on function public.verify_membership_token(text) from public;
grant execute on function public.verify_membership_token(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------

do $$
declare r record;
begin
  for r in select unnest(array[
    'profiles','agreements','agreement_locations','agreement_favorites',
    'request_definitions','requests','request_events','request_files','request_drafts','request_messages',
    'content_items','documents','document_versions','document_favorites',
    'proposals','proposal_supports','proposal_moderation_events',
    'notifications','notification_recipients','notification_preferences','push_devices',
    'membership_verification_tokens','audit_log','app_settings','notification_campaigns'
  ]) as table_name loop
    execute format('alter table public.%I enable row level security', r.table_name);
  end loop;
end $$;

-- Profiles: lectura propia o administrativa. La escritura directa del socio NO se habilita.
create policy profiles_select_self_or_admin on public.profiles for select to authenticated
  using (auth_user_id = auth.uid() or public.is_admin());
create policy profiles_admin_insert on public.profiles for insert to authenticated
  with check (public.is_admin());
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Convenios publicados para socios; administración completa para admins.
create policy agreements_select on public.agreements for select to authenticated
  using (public.is_admin() or (status = 'publicado' and (starts_at is null or starts_at <= current_date) and (ends_at is null or ends_at >= current_date)));
create policy agreements_admin_all on public.agreements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy agreement_locations_select on public.agreement_locations for select to authenticated
  using (public.is_admin() or exists(select 1 from public.agreements a where a.id = agreement_id and a.status = 'publicado'));
create policy agreement_locations_admin_all on public.agreement_locations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy agreement_favorites_own on public.agreement_favorites for all to authenticated
  using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id());

-- Definiciones de trámite.
create policy request_definitions_select on public.request_definitions for select to authenticated
  using (active or public.is_admin());
create policy request_definitions_admin_all on public.request_definitions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Solicitudes: socio ve las propias; creación normal vía RPC; administración completa.
create policy requests_select_own_or_admin on public.requests for select to authenticated
  using (profile_id = public.current_profile_id() or public.is_admin());
create policy requests_admin_update on public.requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy request_events_select on public.request_events for select to authenticated
  using (public.is_admin() or (visible_to_member and exists(select 1 from public.requests r where r.id = request_id and r.profile_id = public.current_profile_id())));
create policy request_events_admin_write on public.request_events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy request_files_select on public.request_files for select to authenticated
  using (public.is_admin() or exists(select 1 from public.requests r where r.id = request_id and r.profile_id = public.current_profile_id()));
create policy request_files_insert on public.request_files for insert to authenticated
  with check (uploaded_by = public.current_profile_id() and exists(select 1 from public.requests r where r.id = request_id and r.profile_id = public.current_profile_id()));
create policy request_files_admin_all on public.request_files for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy request_drafts_own on public.request_drafts for select to authenticated
  using (profile_id = public.current_profile_id());
create policy request_messages_select on public.request_messages for select to authenticated
  using (public.is_admin() or (visible_to_member and exists(select 1 from public.requests r where r.id = request_id and r.profile_id = public.current_profile_id())));
create policy request_messages_member_insert on public.request_messages for insert to authenticated
  with check (author_profile_id = public.current_profile_id() and exists(select 1 from public.requests r where r.id = request_id and r.profile_id = public.current_profile_id()));
create policy request_messages_admin_all on public.request_messages for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Contenido y documentos publicados.
create policy content_items_select on public.content_items for select to authenticated
  using (public.is_admin() or (status = 'publicado' and (published_at is null or published_at <= now())));
create policy content_items_admin_all on public.content_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy documents_select on public.documents for select to authenticated
  using (public.is_admin() or (status = 'publicado' and is_current));
create policy documents_admin_all on public.documents for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy document_versions_select on public.document_versions for select to authenticated
  using (public.is_admin() or exists(select 1 from public.documents d where d.id = document_id and d.status = 'publicado'));
create policy document_versions_admin_all on public.document_versions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy document_favorites_own on public.document_favorites for all to authenticated
  using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id());

-- Propuestas.
create policy proposals_select on public.proposals for select to authenticated
  using (public.is_admin() or profile_id = public.current_profile_id() or status in ('publicada','cerrada','respondida'));
create policy proposals_insert_own on public.proposals for insert to authenticated
  with check (profile_id = public.current_profile_id() and status = 'recibida');
create policy proposals_admin_update on public.proposals for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy proposal_supports_select_own on public.proposal_supports for select to authenticated
  using (profile_id = public.current_profile_id() or public.is_admin());
create policy proposal_supports_insert_own on public.proposal_supports for insert to authenticated
  with check (profile_id = public.current_profile_id() and exists(select 1 from public.proposals p where p.id = proposal_id and p.status = 'publicada'));
create policy proposal_supports_delete_own on public.proposal_supports for delete to authenticated
  using (profile_id = public.current_profile_id() or public.is_admin());
create policy proposal_moderation_admin on public.proposal_moderation_events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Notificaciones y dispositivos.
create policy notifications_select_recipient_or_admin on public.notifications for select to authenticated
  using (public.is_admin() or exists(select 1 from public.notification_recipients nr where nr.notification_id = id and nr.profile_id = public.current_profile_id()));
create policy notifications_admin_all on public.notifications for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy notification_recipients_own_select on public.notification_recipients for select to authenticated
  using (profile_id = public.current_profile_id() or public.is_admin());
create policy notification_recipients_admin_all on public.notification_recipients for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy notification_preferences_own on public.notification_preferences for all to authenticated
  using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id());
create policy push_devices_own on public.push_devices for all to authenticated
  using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id());

-- Los tokens QR jamás se leen directamente. Se usan exclusivamente vía RPC.
create policy verification_tokens_no_direct_access on public.membership_verification_tokens for select to authenticated using (false);

-- Administración sensible.
create policy audit_admin_select on public.audit_log for select to authenticated using (public.is_admin());
create policy app_settings_admin_all on public.app_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy notification_campaigns_admin_all on public.notification_campaigns for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. Privilegios mínimos. Las mutaciones especiales del socio se hacen vía RPC.
-- ---------------------------------------------------------------------------

revoke update, delete on public.profiles from authenticated;
revoke insert, update, delete on public.membership_verification_tokens from authenticated;
revoke insert, update, delete on public.audit_log from authenticated;

grant select on public.profiles, public.agreements, public.agreement_locations, public.agreement_favorites,
  public.request_definitions, public.requests, public.request_events, public.request_files, public.request_drafts, public.request_messages,
  public.content_items, public.documents, public.document_versions, public.document_favorites,
  public.proposals, public.proposal_supports, public.proposal_moderation_events,
  public.notifications, public.notification_recipients, public.notification_preferences, public.push_devices,
  public.audit_log, public.app_settings, public.notification_campaigns to authenticated;

-- Nota: las políticas de Storage para PDFs, adjuntos e imágenes se definen en el
-- incremento dedicado a Storage. No crear buckets públicos para documentación sensible.

-- Incremento 09 ------------------------------------------------------------
alter table public.password_recovery_codes enable row level security;
-- Sin acceso directo desde anon/authenticated. Solo Edge Functions con service role.
create policy password_recovery_no_direct_select on public.password_recovery_codes for select using (false);
revoke all on public.password_recovery_codes from anon, authenticated;

create or replace function public.create_my_proposal(p_title text, p_description text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_profile uuid := public.current_profile_id(); v_id uuid;
begin
  if v_profile is null then raise exception 'not_authenticated'; end if;
  if length(trim(coalesce(p_title,''))) < 5 or length(trim(coalesce(p_description,''))) < 15 then raise exception 'invalid_proposal'; end if;
  insert into public.proposals(profile_id,title,description,status) values(v_profile,trim(p_title),trim(p_description),'recibida') returning id into v_id;
  return v_id;
end; $$;

create or replace function public.support_proposal(p_proposal_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_profile uuid := public.current_profile_id();
begin
  if v_profile is null then raise exception 'not_authenticated'; end if;
  if not exists(select 1 from public.proposals where id=p_proposal_id and status='publicada') then raise exception 'proposal_not_open'; end if;
  insert into public.proposal_supports(proposal_id,profile_id) values(p_proposal_id,v_profile) on conflict do nothing;
  return found;
end; $$;
revoke all on function public.create_my_proposal(text,text) from public;
revoke all on function public.support_proposal(uuid) from public;
grant execute on function public.create_my_proposal(text,text) to authenticated;
grant execute on function public.support_proposal(uuid) to authenticated;
