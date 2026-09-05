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

create policy profiles_select_self_or_admin on public.profiles for select to authenticated
  using (auth_user_id = auth.uid() or public.is_admin());
create policy profiles_admin_insert on public.profiles for insert to authenticated
  with check (public.is_admin());
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

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

create policy request_definitions_select on public.request_definitions for select to authenticated
  using (active or public.is_admin());
create policy request_definitions_admin_all on public.request_definitions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

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
