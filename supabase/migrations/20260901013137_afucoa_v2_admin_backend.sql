grant insert, update on public.profiles to authenticated;
grant insert, update, delete on public.agreements, public.agreement_locations to authenticated;
grant update on public.requests to authenticated;
grant insert on public.request_events, public.request_messages to authenticated;
grant insert, update, delete on public.content_items to authenticated;
grant insert, update, delete on public.documents, public.document_versions to authenticated;
grant update on public.proposals to authenticated;
grant insert on public.proposal_moderation_events to authenticated;
grant insert, update, delete on public.notifications, public.notification_recipients, public.notification_campaigns to authenticated;
grant insert, update, delete on public.app_settings to authenticated;

create schema if not exists private;

create or replace function private.audit_admin_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_entity_id text;
  v_metadata jsonb;
begin
  select p.id into v_actor
  from public.profiles p
  where p.auth_user_id = auth.uid()
  limit 1;
  if v_actor is null then return coalesce(new, old); end if;
  if not exists (select 1 from public.profiles p where p.id = v_actor and p.role in ('admin','superadmin')) then return coalesce(new, old); end if;
  v_entity_id := coalesce(
    case when tg_op <> 'DELETE' then to_jsonb(new)->>'id' end,
    case when tg_op <> 'INSERT' then to_jsonb(old)->>'id' end,
    case when tg_op <> 'DELETE' then to_jsonb(new)->>'request_number' end,
    case when tg_op <> 'INSERT' then to_jsonb(old)->>'request_number' end
  );
  v_metadata := jsonb_build_object('operation', tg_op, 'table', tg_table_name);
  if tg_op = 'UPDATE' then
    v_metadata := v_metadata || jsonb_build_object(
      'changed_fields', (
        select coalesce(jsonb_agg(k), '[]'::jsonb)
        from jsonb_object_keys(to_jsonb(new)) k
        where to_jsonb(new)->k is distinct from to_jsonb(old)->k
          and k not in ('updated_at','password','token','token_hash')
      )
    );
  end if;
  insert into public.audit_log(actor_profile_id, action, entity_type, entity_id, metadata)
  values(v_actor, lower(tg_op) || '_' || tg_table_name, tg_table_name, v_entity_id, v_metadata);
  return coalesce(new, old);
end;
$$;
revoke all on function private.audit_admin_mutation() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['profiles','agreements','agreement_locations','requests','request_events','request_messages','content_items','documents','document_versions','proposals','proposal_moderation_events','notifications','notification_recipients','notification_campaigns','app_settings']
  loop
    execute format('drop trigger if exists audit_admin_%I on public.%I', t, t);
    execute format('create trigger audit_admin_%I after insert or update or delete on public.%I for each row execute function private.audit_admin_mutation()', t, t);
  end loop;
end $$;

create or replace function public.admin_update_request(
  p_request_id uuid,
  p_status public.request_status default null,
  p_assigned_to uuid default null,
  p_set_assignee boolean default false,
  p_note text default null,
  p_visible_to_member boolean default true
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  update public.requests
  set status = coalesce(p_status, status),
      assigned_to = case when p_set_assignee then p_assigned_to else assigned_to end,
      resolved_at = case when p_status = 'resuelta' then now() when p_status is not null and p_status <> 'resuelta' then null else resolved_at end,
      updated_at = now()
  where id = p_request_id;
  if not found then raise exception 'request_not_found'; end if;
  if nullif(trim(coalesce(p_note,'')), '') is not null or p_status is not null then
    insert into public.request_events(request_id, actor_profile_id, event_type, message, visible_to_member)
    values(p_request_id, public.current_profile_id(), 'admin_update', coalesce(nullif(trim(p_note), ''), 'Estado actualizado'), p_visible_to_member);
  end if;
  return true;
end;
$$;
revoke all on function public.admin_update_request(uuid,public.request_status,uuid,boolean,text,boolean) from public, anon;
grant execute on function public.admin_update_request(uuid,public.request_status,uuid,boolean,text,boolean) to authenticated;

create or replace function public.admin_moderate_proposal(
  p_proposal_id uuid,
  p_status public.proposal_status,
  p_note text default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare v_old public.proposal_status;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  select status into v_old from public.proposals where id = p_proposal_id for update;
  if v_old is null then raise exception 'proposal_not_found'; end if;
  update public.proposals
  set status = p_status,
      response = case when p_status = 'respondida' and nullif(trim(coalesce(p_note,'')), '') is not null then trim(p_note) else response end,
      published_at = case when p_status = 'publicada' and published_at is null then now() else published_at end,
      closed_at = case when p_status in ('cerrada','respondida') then now() else closed_at end,
      updated_at = now()
  where id = p_proposal_id;
  insert into public.proposal_moderation_events(proposal_id, actor_profile_id, from_status, to_status, note)
  values(p_proposal_id, public.current_profile_id(), v_old, p_status, nullif(trim(coalesce(p_note,'')),''));
  return true;
end;
$$;
revoke all on function public.admin_moderate_proposal(uuid,public.proposal_status,text) from public, anon;
grant execute on function public.admin_moderate_proposal(uuid,public.proposal_status,text) to authenticated;
