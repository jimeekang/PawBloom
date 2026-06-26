create extension if not exists pgcrypto;

create schema if not exists app_private;
revoke all on schema app_private from public;

create type public.pet_member_role as enum ('owner', 'caregiver', 'pet_sitter');
create type public.diary_entry_category as enum ('food', 'water', 'walk', 'stool', 'condition', 'memo');
create type public.dose_status as enum ('pending', 'completed', 'skipped', 'partial');
create type public.report_status as enum ('draft', 'confirmed', 'shared');
create type public.subscription_plan as enum ('free', 'plus', 'family');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  language text not null default 'en' check (language in ('en', 'ko')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  species text not null check (species in ('dog', 'cat', 'other')),
  breed text,
  birthdate date,
  weight_kg numeric(6, 2) check (weight_kg is null or weight_kg > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pet_members (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.pet_member_role not null,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  unique (pet_id, user_id)
);

create table public.conditions (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  name text not null,
  status text not null default 'active' check (status in ('active', 'resolved')),
  vet_instructions text,
  starts_on date not null default current_date,
  ends_on date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.care_plans (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  condition_id uuid references public.conditions(id) on delete set null,
  title text not null,
  instructions text,
  starts_on date not null default current_date,
  ends_on date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  condition_id uuid references public.conditions(id) on delete set null,
  name text not null,
  dosage_label text not null,
  vet_instructions text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.medication_schedules (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  local_time time not null,
  starts_on date not null default current_date,
  ends_on date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.medication_doses (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  schedule_id uuid references public.medication_schedules(id) on delete set null,
  medication_name text not null,
  scheduled_at timestamptz not null,
  status public.dose_status not null default 'pending',
  recorded_at timestamptz,
  reaction_note text,
  created_by uuid not null references auth.users(id),
  client_mutation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pet_id, client_mutation_id)
);

create table public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  category public.diary_entry_category not null,
  entry_date date not null default current_date,
  occurred_at timestamptz not null default now(),
  summary text not null,
  condition_score int check (condition_score between 1 and 5),
  client_mutation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pet_id, client_mutation_id)
);

create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  kind text not null check (kind in ('weight_kg', 'water_ml', 'food_grams')),
  value numeric(10, 2) not null,
  measured_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  diary_entry_id uuid references public.diary_entries(id) on delete set null,
  storage_path text not null unique,
  content_type text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.ai_briefs (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  range_days int not null check (range_days in (3, 7, 14)),
  payload jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.vet_reports (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  range_days int not null check (range_days in (3, 7, 14)),
  status public.report_status not null default 'draft',
  english_summary text not null,
  payload jsonb not null,
  confirmed_by_owner boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.report_share_tokens (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.vet_reports(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz
);

create table public.subscription_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan public.subscription_plan not null default 'free',
  source text not null default 'manual',
  active_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table public.sync_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_mutation_id uuid not null,
  aggregate text not null,
  operation text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (user_id, client_mutation_id)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  pet_id uuid references public.pets(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index pet_members_pet_id_idx on public.pet_members(pet_id);
create index pet_members_user_id_idx on public.pet_members(user_id);
create index diary_entries_pet_date_idx on public.diary_entries(pet_id, entry_date desc);
create index medication_doses_pet_scheduled_idx on public.medication_doses(pet_id, scheduled_at desc);
create index vet_reports_pet_created_idx on public.vet_reports(pet_id, created_at desc);
create index report_share_tokens_expires_idx on public.report_share_tokens(expires_at);

create or replace function app_private.is_pet_member(target_pet_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pet_members pm
    where pm.pet_id = target_pet_id
      and pm.user_id = target_user_id
      and (pm.starts_at is null or pm.starts_at <= now())
      and (pm.ends_at is null or pm.ends_at >= now())
  );
$$;

create or replace function app_private.has_pet_role(target_pet_id uuid, target_user_id uuid, allowed_roles public.pet_member_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pet_members pm
    where pm.pet_id = target_pet_id
      and pm.user_id = target_user_id
      and pm.role = any(allowed_roles)
      and (pm.starts_at is null or pm.starts_at <= now())
      and (pm.ends_at is null or pm.ends_at >= now())
  );
$$;

create or replace function app_private.add_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pet_members (pet_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (pet_id, user_id) do nothing;
  return new;
end;
$$;

create trigger pets_add_owner_membership
after insert on public.pets
for each row execute function app_private.add_owner_membership();

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.pets to authenticated;
grant select, insert, update, delete on public.pet_members to authenticated;
grant select, insert, update, delete on public.conditions to authenticated;
grant select, insert, update, delete on public.care_plans to authenticated;
grant select, insert, update, delete on public.medications to authenticated;
grant select, insert, update, delete on public.medication_schedules to authenticated;
grant select, insert, update, delete on public.medication_doses to authenticated;
grant select, insert, update, delete on public.diary_entries to authenticated;
grant select, insert, update, delete on public.measurements to authenticated;
grant select, insert, update, delete on public.media_assets to authenticated;
grant select, insert on public.ai_briefs to authenticated;
grant select, insert, update, delete on public.vet_reports to authenticated;
grant select, insert, update, delete on public.report_share_tokens to authenticated;
grant select, insert, update on public.subscription_entitlements to authenticated;
grant select, insert, update, delete on public.sync_outbox to authenticated;
grant select, insert on public.audit_events to authenticated;
grant execute on function app_private.is_pet_member(uuid, uuid) to authenticated;
grant execute on function app_private.has_pet_role(uuid, uuid, public.pet_member_role[]) to authenticated;

alter table public.profiles enable row level security;
alter table public.pets enable row level security;
alter table public.pet_members enable row level security;
alter table public.conditions enable row level security;
alter table public.care_plans enable row level security;
alter table public.medications enable row level security;
alter table public.medication_schedules enable row level security;
alter table public.medication_doses enable row level security;
alter table public.diary_entries enable row level security;
alter table public.measurements enable row level security;
alter table public.media_assets enable row level security;
alter table public.ai_briefs enable row level security;
alter table public.vet_reports enable row level security;
alter table public.report_share_tokens enable row level security;
alter table public.subscription_entitlements enable row level security;
alter table public.sync_outbox enable row level security;
alter table public.audit_events enable row level security;

create policy "profiles own select" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles own insert" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles own update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "pets members select" on public.pets for select to authenticated using (app_private.is_pet_member(id, (select auth.uid())));
create policy "pets owner insert" on public.pets for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "pets owners update" on public.pets for update to authenticated using (app_private.has_pet_role(id, (select auth.uid()), array['owner']::public.pet_member_role[])) with check (app_private.has_pet_role(id, (select auth.uid()), array['owner']::public.pet_member_role[]));
create policy "pets owners delete" on public.pets for delete to authenticated using (app_private.has_pet_role(id, (select auth.uid()), array['owner']::public.pet_member_role[]));

create policy "pet_members members select" on public.pet_members for select to authenticated using (app_private.is_pet_member(pet_id, (select auth.uid())));
create policy "pet_members owners insert" on public.pet_members for insert to authenticated with check (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner']::public.pet_member_role[]));
create policy "pet_members owners update" on public.pet_members for update to authenticated using (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner']::public.pet_member_role[])) with check (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner']::public.pet_member_role[]));
create policy "pet_members owners delete" on public.pet_members for delete to authenticated using (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner']::public.pet_member_role[]));

create policy "conditions member select" on public.conditions for select to authenticated using (app_private.is_pet_member(pet_id, (select auth.uid())));
create policy "conditions care team insert" on public.conditions for insert to authenticated with check (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver']::public.pet_member_role[]) and created_by = (select auth.uid()));
create policy "conditions care team update" on public.conditions for update to authenticated using (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver']::public.pet_member_role[])) with check (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver']::public.pet_member_role[]));
create policy "conditions owner delete" on public.conditions for delete to authenticated using (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner']::public.pet_member_role[]));

create policy "care_plans member select" on public.care_plans for select to authenticated using (app_private.is_pet_member(pet_id, (select auth.uid())));
create policy "care_plans care team insert" on public.care_plans for insert to authenticated with check (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver']::public.pet_member_role[]) and created_by = (select auth.uid()));
create policy "care_plans care team update" on public.care_plans for update to authenticated using (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver']::public.pet_member_role[])) with check (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver']::public.pet_member_role[]));
create policy "care_plans owner delete" on public.care_plans for delete to authenticated using (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner']::public.pet_member_role[]));

create policy "medications member select" on public.medications for select to authenticated using (app_private.is_pet_member(pet_id, (select auth.uid())));
create policy "medications care team insert" on public.medications for insert to authenticated with check (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver']::public.pet_member_role[]) and created_by = (select auth.uid()));
create policy "medications care team update" on public.medications for update to authenticated using (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver']::public.pet_member_role[])) with check (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver']::public.pet_member_role[]));
create policy "medications owner delete" on public.medications for delete to authenticated using (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner']::public.pet_member_role[]));

create policy "medication_schedules member select" on public.medication_schedules for select to authenticated using (app_private.is_pet_member(pet_id, (select auth.uid())));
create policy "medication_schedules care team insert" on public.medication_schedules for insert to authenticated with check (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver']::public.pet_member_role[]) and created_by = (select auth.uid()));
create policy "medication_schedules care team update" on public.medication_schedules for update to authenticated using (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver']::public.pet_member_role[])) with check (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver']::public.pet_member_role[]));
create policy "medication_schedules owner delete" on public.medication_schedules for delete to authenticated using (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner']::public.pet_member_role[]));

create policy "medication_doses member select" on public.medication_doses for select to authenticated using (app_private.is_pet_member(pet_id, (select auth.uid())));
create policy "medication_doses care team insert" on public.medication_doses for insert to authenticated with check (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver','pet_sitter']::public.pet_member_role[]) and created_by = (select auth.uid()));
create policy "medication_doses care team update" on public.medication_doses for update to authenticated using (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver','pet_sitter']::public.pet_member_role[])) with check (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver','pet_sitter']::public.pet_member_role[]));
create policy "medication_doses owner delete" on public.medication_doses for delete to authenticated using (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner']::public.pet_member_role[]));

create policy "diary_entries member select" on public.diary_entries for select to authenticated using (app_private.is_pet_member(pet_id, (select auth.uid())));
create policy "diary_entries care team insert" on public.diary_entries for insert to authenticated with check (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver','pet_sitter']::public.pet_member_role[]) and created_by = (select auth.uid()));
create policy "diary_entries care team update" on public.diary_entries for update to authenticated using (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver']::public.pet_member_role[])) with check (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver']::public.pet_member_role[]));
create policy "diary_entries owner delete" on public.diary_entries for delete to authenticated using (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner']::public.pet_member_role[]));

create policy "measurements member select" on public.measurements for select to authenticated using (app_private.is_pet_member(pet_id, (select auth.uid())));
create policy "measurements care team insert" on public.measurements for insert to authenticated with check (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver','pet_sitter']::public.pet_member_role[]) and created_by = (select auth.uid()));
create policy "measurements owner delete" on public.measurements for delete to authenticated using (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner']::public.pet_member_role[]));

create policy "media_assets member select" on public.media_assets for select to authenticated using (app_private.is_pet_member(pet_id, (select auth.uid())));
create policy "media_assets care team insert" on public.media_assets for insert to authenticated with check (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver','pet_sitter']::public.pet_member_role[]) and created_by = (select auth.uid()));
create policy "media_assets owner delete" on public.media_assets for delete to authenticated using (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner']::public.pet_member_role[]));

create policy "ai_briefs member select" on public.ai_briefs for select to authenticated using (app_private.is_pet_member(pet_id, (select auth.uid())));
create policy "ai_briefs owner caregiver insert" on public.ai_briefs for insert to authenticated with check (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver']::public.pet_member_role[]) and created_by = (select auth.uid()));

create policy "vet_reports member select" on public.vet_reports for select to authenticated using (app_private.is_pet_member(pet_id, (select auth.uid())));
create policy "vet_reports owner caregiver insert" on public.vet_reports for insert to authenticated with check (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver']::public.pet_member_role[]) and created_by = (select auth.uid()));
create policy "vet_reports owner caregiver update" on public.vet_reports for update to authenticated using (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver']::public.pet_member_role[])) with check (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver']::public.pet_member_role[]));
create policy "vet_reports owner delete" on public.vet_reports for delete to authenticated using (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner']::public.pet_member_role[]));

create policy "report_share_tokens report member select" on public.report_share_tokens for select to authenticated using (
  exists (
    select 1 from public.vet_reports vr
    where vr.id = report_id and app_private.is_pet_member(vr.pet_id, (select auth.uid()))
  )
);
create policy "report_share_tokens owner caregiver insert" on public.report_share_tokens for insert to authenticated with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.vet_reports vr
    where vr.id = report_id and app_private.has_pet_role(vr.pet_id, (select auth.uid()), array['owner','caregiver']::public.pet_member_role[])
  )
);
create policy "report_share_tokens owner delete" on public.report_share_tokens for delete to authenticated using (
  exists (
    select 1 from public.vet_reports vr
    where vr.id = report_id and app_private.has_pet_role(vr.pet_id, (select auth.uid()), array['owner']::public.pet_member_role[])
  )
);

create policy "subscription own select" on public.subscription_entitlements for select to authenticated using (user_id = (select auth.uid()));
create policy "subscription own insert" on public.subscription_entitlements for insert to authenticated with check (user_id = (select auth.uid()) and plan = 'free');
create policy "subscription own update" on public.subscription_entitlements for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "sync_outbox own select" on public.sync_outbox for select to authenticated using (user_id = (select auth.uid()));
create policy "sync_outbox own insert" on public.sync_outbox for insert to authenticated with check (user_id = (select auth.uid()));
create policy "sync_outbox own update" on public.sync_outbox for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "sync_outbox own delete" on public.sync_outbox for delete to authenticated using (user_id = (select auth.uid()));

create policy "audit own pet select" on public.audit_events for select to authenticated using (pet_id is null or app_private.is_pet_member(pet_id, (select auth.uid())));
create policy "audit own insert" on public.audit_events for insert to authenticated with check (actor_user_id = (select auth.uid()));

insert into storage.buckets (id, name, public)
values ('pet-media', 'pet-media', false)
on conflict (id) do update set public = false;

create policy "pet media member read" on storage.objects for select to authenticated using (
  bucket_id = 'pet-media'
  and app_private.is_pet_member(((storage.foldername(name))[1])::uuid, (select auth.uid()))
);

create policy "pet media care team insert" on storage.objects for insert to authenticated with check (
  bucket_id = 'pet-media'
  and app_private.has_pet_role(((storage.foldername(name))[1])::uuid, (select auth.uid()), array['owner','caregiver','pet_sitter']::public.pet_member_role[])
);

create policy "pet media care team update" on storage.objects for update to authenticated using (
  bucket_id = 'pet-media'
  and app_private.has_pet_role(((storage.foldername(name))[1])::uuid, (select auth.uid()), array['owner','caregiver']::public.pet_member_role[])
) with check (
  bucket_id = 'pet-media'
  and app_private.has_pet_role(((storage.foldername(name))[1])::uuid, (select auth.uid()), array['owner','caregiver']::public.pet_member_role[])
);

create policy "pet media owner delete" on storage.objects for delete to authenticated using (
  bucket_id = 'pet-media'
  and app_private.has_pet_role(((storage.foldername(name))[1])::uuid, (select auth.uid()), array['owner']::public.pet_member_role[])
);

