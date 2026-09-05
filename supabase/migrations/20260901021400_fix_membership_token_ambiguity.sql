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
  if not exists (
    select 1
      from public.profiles p
     where p.id = v_profile
       and p.status = 'activo'
  ) then
    raise exception 'membership_not_active';
  end if;

  update public.membership_verification_tokens as mt
     set revoked_at = now()
   where mt.profile_id = v_profile
     and mt.revoked_at is null
     and mt.expires_at > now();

  v_raw := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.membership_verification_tokens(profile_id, token_hash, expires_at)
  values(v_profile, encode(extensions.digest(v_raw, 'sha256'), 'hex'), v_expires);
  return query select v_raw, v_expires;
end;
$$;

revoke all on function public.create_membership_verification_token() from public, anon;
grant execute on function public.create_membership_verification_token() to authenticated;
