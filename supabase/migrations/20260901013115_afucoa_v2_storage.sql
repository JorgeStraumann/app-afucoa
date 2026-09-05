insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('request-files','request-files',false,10485760,array['application/pdf','image/jpeg','image/png']),
  ('documents-private','documents-private',false,20971520,array['application/pdf']),
  ('public-media','public-media',true,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy request_files_storage_select
on storage.objects for select to authenticated
using (
  bucket_id = 'request-files'
  and exists (
    select 1 from public.requests r
    where r.id::text = (storage.foldername(name))[1]
      and (r.profile_id = public.current_profile_id() or public.is_admin())
  )
);
create policy request_files_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'request-files'
  and exists (
    select 1 from public.requests r
    where r.id::text = (storage.foldername(name))[1]
      and (r.profile_id = public.current_profile_id() or public.is_admin())
  )
);
create policy request_files_storage_delete_admin
on storage.objects for delete to authenticated
using (bucket_id = 'request-files' and public.is_admin());

create policy documents_private_select
on storage.objects for select to authenticated
using (
  bucket_id = 'documents-private'
  and exists (
    select 1 from public.documents d
    where d.storage_path = name
      and (public.is_admin() or (d.status = 'publicado' and d.is_current))
  )
);
create policy documents_private_admin_insert
on storage.objects for insert to authenticated
with check (bucket_id = 'documents-private' and public.is_admin());
create policy documents_private_admin_update
on storage.objects for update to authenticated
using (bucket_id = 'documents-private' and public.is_admin())
with check (bucket_id = 'documents-private' and public.is_admin());
create policy documents_private_admin_delete
on storage.objects for delete to authenticated
using (bucket_id = 'documents-private' and public.is_admin());

create policy public_media_read
on storage.objects for select to anon, authenticated
using (bucket_id = 'public-media');
create policy public_media_admin_insert
on storage.objects for insert to authenticated
with check (bucket_id = 'public-media' and public.is_admin());
create policy public_media_admin_update
on storage.objects for update to authenticated
using (bucket_id = 'public-media' and public.is_admin())
with check (bucket_id = 'public-media' and public.is_admin());
create policy public_media_admin_delete
on storage.objects for delete to authenticated
using (bucket_id = 'public-media' and public.is_admin());

create or replace function public.register_my_request_file(
  p_request_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text default null
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
  if not exists(select 1 from public.requests r where r.id = p_request_id and r.profile_id = v_profile) then
    raise exception 'request_not_owned';
  end if;
  if split_part(p_storage_path, '/', 1) <> p_request_id::text then
    raise exception 'invalid_storage_path';
  end if;
  insert into public.request_files(request_id, uploaded_by, storage_path, file_name, mime_type)
  values(p_request_id, v_profile, p_storage_path, left(p_file_name,255), p_mime_type)
  returning id into v_id;
  insert into public.request_events(request_id, actor_profile_id, event_type, message, visible_to_member)
  values(p_request_id, v_profile, 'file_added', 'Documento adjuntado por el socio', true);
  return v_id;
end;
$$;
revoke all on function public.register_my_request_file(uuid,text,text,text) from public;
grant execute on function public.register_my_request_file(uuid,text,text,text) to authenticated;
