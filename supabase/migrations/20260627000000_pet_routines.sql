create table public.pet_routines (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  routine jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pet_id)
);

grant select, insert, update, delete on public.pet_routines to authenticated;

alter table public.pet_routines enable row level security;

create policy "pet_routines member select" on public.pet_routines for select to authenticated using (app_private.is_pet_member(pet_id, (select auth.uid())));
create policy "pet_routines care team insert" on public.pet_routines for insert to authenticated with check (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver']::public.pet_member_role[]) and created_by = (select auth.uid()));
create policy "pet_routines care team update" on public.pet_routines for update to authenticated using (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver']::public.pet_member_role[])) with check (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner','caregiver']::public.pet_member_role[]));
create policy "pet_routines owner delete" on public.pet_routines for delete to authenticated using (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner']::public.pet_member_role[]));
