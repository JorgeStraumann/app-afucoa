-- AFUCOA V2: admin/superadmin privileges require a verified MFA session.
-- get_my_profile/current_user_role intentionally remain available at AAL1 so
-- the client can identify privileged accounts and route them to the MFA gate.

create or replace function public.is_privileged_aal2()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role in ('admin', 'superadmin')
       from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.status = 'activo'
      limit 1),
    false
  )
  and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

create or replace function public.require_privileged_aal2()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  select p.role into v_role
    from public.profiles p
   where p.auth_user_id = auth.uid()
     and p.status = 'activo'
   limit 1;

  if v_role is null or v_role not in ('admin', 'superadmin') then
    raise exception 'not_authorized';
  end if;

  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required';
  end if;
end;
$$;

-- Existing RLS, Storage policies and SECURITY DEFINER admin branches already
-- call is_admin(). Replacing this central guard makes every such path require
-- both an active privileged role and AAL2 without duplicating policy logic.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_privileged_aal2();
$$;

revoke all on function public.is_privileged_aal2() from public, anon;
revoke all on function public.require_privileged_aal2() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_privileged_aal2() to authenticated;
grant execute on function public.require_privileged_aal2() to authenticated;
grant execute on function public.is_admin() to authenticated;

comment on function public.is_privileged_aal2() is
  'True only for active admin/superadmin sessions whose JWT aal claim is aal2.';
comment on function public.require_privileged_aal2() is
  'Raises not_authorized for non-privileged accounts and mfa_required for privileged AAL1 sessions.';
