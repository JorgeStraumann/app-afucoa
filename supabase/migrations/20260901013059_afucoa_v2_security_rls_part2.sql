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
create policy verification_tokens_no_direct_access on public.membership_verification_tokens for select to authenticated using (false);
create policy audit_admin_select on public.audit_log for select to authenticated using (public.is_admin());
create policy app_settings_admin_all on public.app_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy notification_campaigns_admin_all on public.notification_campaigns for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke update, delete on public.profiles from authenticated;
revoke insert, update, delete on public.membership_verification_tokens from authenticated;
revoke insert, update, delete on public.audit_log from authenticated;

grant select on public.profiles, public.agreements, public.agreement_locations, public.agreement_favorites,
  public.request_definitions, public.requests, public.request_events, public.request_files, public.request_drafts, public.request_messages,
  public.content_items, public.documents, public.document_versions, public.document_favorites,
  public.proposals, public.proposal_supports, public.proposal_moderation_events,
  public.notifications, public.notification_recipients, public.notification_preferences, public.push_devices,
  public.audit_log, public.app_settings, public.notification_campaigns to authenticated;

alter table public.password_recovery_codes enable row level security;
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
