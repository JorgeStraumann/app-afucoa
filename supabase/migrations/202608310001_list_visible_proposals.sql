create or replace function public.list_visible_proposals()
returns table (
  id uuid,
  profile_id uuid,
  title text,
  description text,
  status public.proposal_status,
  response text,
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz,
  support_count bigint,
  mine boolean,
  supported boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         p.profile_id,
         p.title,
         p.description,
         p.status,
         p.response,
         p.published_at,
         p.closed_at,
         p.created_at,
         count(ps.profile_id)::bigint as support_count,
         p.profile_id = public.current_profile_id() as mine,
         bool_or(ps.profile_id = public.current_profile_id()) as supported
    from public.proposals p
    left join public.proposal_supports ps on ps.proposal_id = p.id
   where public.current_profile_id() is not null
     and (
       public.is_admin()
       or p.profile_id = public.current_profile_id()
       or p.status in ('publicada', 'cerrada', 'respondida')
     )
   group by p.id
   order by p.created_at desc;
$$;

revoke all on function public.list_visible_proposals() from public, anon;
grant execute on function public.list_visible_proposals() to authenticated;
