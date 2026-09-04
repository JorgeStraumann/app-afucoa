-- AFUCOA V2 — modelo inicial de datos
-- Diseñado para Supabase/PostgreSQL. Seguridad/RLS se añadirá en la fase específica de hardening.

create extension if not exists pgcrypto;

create type public.user_role as enum ('socio','admin','superadmin');
create type public.member_status as enum ('activo','inactivo','pendiente','baja');
create type public.request_status as enum ('borrador','recibida','en_revision','requiere_informacion','en_gestion','resuelta','cancelada');
create type public.content_status as enum ('borrador','programado','publicado','archivado');
create type public.proposal_status as enum ('recibida','en_evaluacion','publicada','cerrada','respondida');
create type public.notification_type as enum ('institucional','tramite','convenio','propuesta','documento','evento','sistema');

create table public.profiles (
  id uuid primary key,
  role public.user_role not null default 'socio',
  first_name text not null,
  last_name text not null,
  document_number text unique,
  member_number text unique,
  email text,
  phone text,
  department text,
  photo_url text,
  status public.member_status not null default 'pendiente',
  joined_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  category text not null,
  short_benefit text not null,
  description text,
  conditions text,
  access_instructions text,
  contact_info text,
  website_url text,
  image_url text,
  logo_url text,
  starts_at date,
  ends_at date,
  is_featured boolean not null default false,
  is_new boolean not null default false,
  status public.content_status not null default 'borrador',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agreement_locations (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  name text,
  address text not null,
  latitude numeric(9,6),
  longitude numeric(9,6),
  phone text
);

create table public.agreement_favorites (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, agreement_id)
);

create table public.request_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  category text,
  estimated_days integer,
  fields jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  request_number text unique not null,
  profile_id uuid not null references public.profiles(id),
  definition_id uuid references public.request_definitions(id),
  status public.request_status not null default 'borrador',
  payload jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id),
  event_type text not null,
  message text,
  visible_to_member boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.request_files (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  uploaded_by uuid references public.profiles(id),
  storage_path text not null,
  file_name text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('noticia','comunicado','evento','aviso')),
  title text not null,
  summary text,
  body text,
  image_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  priority integer not null default 0,
  status public.content_status not null default 'borrador',
  published_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  description text,
  version text,
  storage_path text not null,
  effective_from date,
  is_current boolean not null default true,
  status public.content_status not null default 'borrador',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  title text not null,
  description text not null,
  status public.proposal_status not null default 'recibida',
  response text,
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.proposal_supports (
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (proposal_id, profile_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  type public.notification_type not null,
  title text not null,
  body text not null,
  target_path text,
  created_at timestamptz not null default now()
);

create table public.notification_recipients (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz,
  primary key (notification_id, profile_id)
);

create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token text unique not null,
  platform text,
  last_seen_at timestamptz not null default now(),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.membership_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_profile_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index requests_profile_status_idx on public.requests(profile_id, status);
create index content_status_published_idx on public.content_items(status, published_at desc);
create index agreements_status_category_idx on public.agreements(status, category);
create index notifications_created_idx on public.notifications(created_at desc);
create index audit_entity_idx on public.audit_log(entity_type, entity_id, created_at desc);

-- Incremento 02: integridad, numeración y campos preparados para administración.
alter table public.profiles add column if not exists auth_user_id uuid unique;
alter table public.profiles add column if not exists sector text;
alter table public.agreements add column if not exists access_action text not null default 'carnet' check (access_action in ('carnet','tramite','sitio','contacto','sucursal'));
alter table public.agreements add column if not exists sort_order integer not null default 0;
alter table public.request_definitions add column if not exists instructions text;
alter table public.request_definitions add column if not exists requires_review boolean not null default true;
alter table public.requests add column if not exists assigned_to uuid references public.profiles(id);
alter table public.notifications add column if not exists priority integer not null default 0;
alter table public.notifications add column if not exists expires_at timestamptz;

create sequence if not exists public.request_number_seq start 1;
create or replace function public.next_request_number()
returns text
language sql
as $$
  select 'AF-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.request_number_seq')::text, 5, '0');
$$;

alter table public.requests alter column request_number set default public.next_request_number();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger agreements_set_updated_at before update on public.agreements for each row execute function public.set_updated_at();
create trigger request_definitions_set_updated_at before update on public.request_definitions for each row execute function public.set_updated_at();
create trigger requests_set_updated_at before update on public.requests for each row execute function public.set_updated_at();
create trigger content_items_set_updated_at before update on public.content_items for each row execute function public.set_updated_at();
create trigger documents_set_updated_at before update on public.documents for each row execute function public.set_updated_at();
create trigger proposals_set_updated_at before update on public.proposals for each row execute function public.set_updated_at();

create index if not exists profiles_document_idx on public.profiles(document_number);
create index if not exists profiles_member_number_idx on public.profiles(member_number);
create index if not exists request_events_request_created_idx on public.request_events(request_id, created_at);
create index if not exists proposal_status_created_idx on public.proposals(status, created_at desc);
create index if not exists notification_recipients_profile_read_idx on public.notification_recipients(profile_id, read_at);

-- NOTA: Auth, RLS, funciones SECURITY DEFINER y políticas de Storage se implementan
-- en la fase de seguridad. No ejecutar este esquema en producción sin esa fase.

-- Incremento 03: motor de trámites más estructurado y conversación contextual.
create table if not exists public.request_drafts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  definition_id uuid not null references public.request_definitions(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  current_step integer not null default 0,
  updated_at timestamptz not null default now(),
  unique(profile_id, definition_id)
);

create table if not exists public.request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  author_profile_id uuid references public.profiles(id),
  body text not null,
  visible_to_member boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.request_definitions add column if not exists version integer not null default 1;
alter table public.request_definitions add column if not exists submit_label text not null default 'Enviar solicitud';
alter table public.request_definitions add column if not exists allow_attachments boolean not null default true;
alter table public.content_items add column if not exists pinned boolean not null default false;
alter table public.content_items add column if not exists audience jsonb not null default '{"type":"all_members"}'::jsonb;

create index if not exists request_drafts_profile_idx on public.request_drafts(profile_id, updated_at desc);
create index if not exists request_messages_request_idx on public.request_messages(request_id, created_at);
create index if not exists content_kind_status_idx on public.content_items(kind, status, published_at desc);

-- Nota de arquitectura: request_definitions.fields seguirá siendo JSONB en esta fase para permitir
-- un constructor visual de formularios sin desplegar nuevas tablas por cada trámite. Si el producto
-- necesita consultas analíticas campo por campo, se evaluará normalizar respuestas seleccionadas.

-- Incremento 04 -------------------------------------------------------------
-- Favoritos y versionado documental. Las políticas RLS se definirán en la
-- fase de seguridad antes de habilitar este esquema en producción.
create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version text not null,
  storage_path text not null,
  effective_from date,
  is_current boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(document_id, version)
);

create table if not exists public.document_favorites (
  document_id uuid not null references public.documents(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(document_id, profile_id)
);

create table if not exists public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  agreements boolean not null default true,
  news boolean not null default true,
  events boolean not null default true,
  request_updates boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.proposal_moderation_events (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id),
  from_status public.proposal_status,
  to_status public.proposal_status not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_document_versions_document on public.document_versions(document_id, is_current);
create index if not exists idx_document_favorites_profile on public.document_favorites(profile_id);
create index if not exists idx_proposal_moderation_proposal on public.proposal_moderation_events(proposal_id, created_at desc);

-- Incremento 06 ------------------------------------------------------------
-- Configuración administrativa y campañas de notificación.
-- IMPORTANTE: estas tablas también deberán quedar protegidas por RLS antes de producción.
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience jsonb not null default '{"type":"all_members"}'::jsonb,
  channel text not null default 'push_and_center' check (channel in ('push_and_center','center_only')),
  target jsonb,
  status public.content_status not null default 'borrador',
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger notification_campaigns_set_updated_at before update on public.notification_campaigns for each row execute function public.set_updated_at();
create index if not exists notification_campaigns_status_idx on public.notification_campaigns(status, scheduled_at desc);
create index if not exists audit_created_idx on public.audit_log(created_at desc);

-- Incremento 09 ------------------------------------------------------------
-- Recuperación de acceso y preparación de migración.
create table if not exists public.password_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  auth_user_id uuid,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  invalidated_at timestamptz,
  attempts integer not null default 0,
  max_attempts integer not null default 5 check (max_attempts between 1 and 10),
  delivery_status text not null default 'pending' check (delivery_status in ('pending','sent','failed')),
  request_ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists password_recovery_profile_idx on public.password_recovery_codes(profile_id, created_at desc);
create index if not exists password_recovery_active_profile_idx on public.password_recovery_codes(profile_id, created_at desc) where consumed_at is null and invalidated_at is null;

create table if not exists public.password_recovery_rate_limits (
  scope text not null,
  subject_hash text not null,
  window_started_at timestamptz not null default now(),
  hit_count integer not null default 0,
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (scope, subject_hash)
);
create index if not exists password_recovery_rate_limits_updated_idx on public.password_recovery_rate_limits(updated_at);

alter table public.profiles add column if not exists migration_source text;
alter table public.profiles add column if not exists migration_external_id text;
create unique index if not exists profiles_migration_external_unique on public.profiles(migration_source, migration_external_id) where migration_external_id is not null;
