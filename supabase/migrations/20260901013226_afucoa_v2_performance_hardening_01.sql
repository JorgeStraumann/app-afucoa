drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles for select to authenticated
  using (auth_user_id = (select auth.uid()) or public.is_admin());

create index if not exists agreement_favorites_agreement_idx on public.agreement_favorites(agreement_id);
create index if not exists agreement_locations_agreement_idx on public.agreement_locations(agreement_id);
create index if not exists app_settings_updated_by_idx on public.app_settings(updated_by);
create index if not exists audit_log_actor_idx on public.audit_log(actor_profile_id);
create index if not exists content_items_created_by_idx on public.content_items(created_by);
create index if not exists document_versions_created_by_idx on public.document_versions(created_by);
create index if not exists membership_verification_tokens_profile_idx on public.membership_verification_tokens(profile_id);
create index if not exists notification_campaigns_created_by_idx on public.notification_campaigns(created_by);
create index if not exists proposal_moderation_actor_idx on public.proposal_moderation_events(actor_profile_id);
create index if not exists proposal_supports_profile_idx on public.proposal_supports(profile_id);
create index if not exists proposals_profile_idx on public.proposals(profile_id);
create index if not exists push_devices_profile_idx on public.push_devices(profile_id);
create index if not exists request_drafts_definition_idx on public.request_drafts(definition_id);
create index if not exists request_events_actor_idx on public.request_events(actor_profile_id);
create index if not exists request_files_request_idx on public.request_files(request_id);
create index if not exists request_files_uploaded_by_idx on public.request_files(uploaded_by);
create index if not exists request_messages_author_idx on public.request_messages(author_profile_id);
create index if not exists requests_assigned_to_idx on public.requests(assigned_to);
create index if not exists requests_definition_idx on public.requests(definition_id);
