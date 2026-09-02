alter table public.profiles
  alter column id set default gen_random_uuid();
