alter function public.next_request_number() set search_path = public;
alter function public.set_updated_at() set search_path = public;

revoke execute on function public.current_profile_id() from anon;
revoke execute on function public.current_user_role() from anon;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.get_my_profile() from anon;
revoke execute on function public.update_my_contact(text,text) from anon;
revoke execute on function public.save_my_request_draft(uuid,jsonb,integer) from anon;
revoke execute on function public.submit_my_request(uuid,jsonb) from anon;
revoke execute on function public.mark_my_notification_read(uuid) from anon;
revoke execute on function public.create_membership_verification_token() from anon;
revoke execute on function public.create_my_proposal(text,text) from anon;
revoke execute on function public.support_proposal(uuid) from anon;
revoke execute on function public.register_my_request_file(uuid,text,text,text) from anon;

-- La verificación de un QR es deliberadamente pública y devuelve datos mínimos.
grant execute on function public.verify_membership_token(text) to anon, authenticated;
