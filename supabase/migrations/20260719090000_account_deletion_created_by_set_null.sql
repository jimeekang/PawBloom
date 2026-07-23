-- Account deletion: anonymize the creator, keep the record.
--
-- The delete-account edge function deletes the auth user with
-- auth.admin.deleteUser after cascading away the user's OWNED pets. But RLS lets
-- caregiver / pet_sitter members create rows (diary_entries, medication_doses,
-- measurements, media_assets, conditions, care_plans, medications,
-- medication_schedules, ai_briefs, vet_reports, report_share_tokens,
-- pet_routines) on pets they do NOT own. Those rows live under another owner's
-- pet, so they survive the owner-side cascade and still reference the deleting
-- user via `created_by uuid not null references auth.users(id)` with no
-- on-delete action. That FK makes auth.admin.deleteUser raise a foreign-key
-- violation, so a contributor could NEVER delete their account.
--
-- Controller decision: the pet owner's health ledger must not lose entries when
-- a contributor leaves. So we keep every record and null out the creator link on
-- user deletion: drop NOT NULL on created_by and switch each FK to ON DELETE SET
-- NULL. FKs that already cascade or set null (profiles.id, pets.owner_id,
-- pet_members.user_id, subscription_entitlements.user_id, sync_outbox.user_id,
-- audit_events.actor_user_id) are intentionally left untouched.

alter table public.conditions alter column created_by drop not null;
alter table public.conditions drop constraint if exists conditions_created_by_fkey;
alter table public.conditions add constraint conditions_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.care_plans alter column created_by drop not null;
alter table public.care_plans drop constraint if exists care_plans_created_by_fkey;
alter table public.care_plans add constraint care_plans_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.medications alter column created_by drop not null;
alter table public.medications drop constraint if exists medications_created_by_fkey;
alter table public.medications add constraint medications_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.medication_schedules alter column created_by drop not null;
alter table public.medication_schedules drop constraint if exists medication_schedules_created_by_fkey;
alter table public.medication_schedules add constraint medication_schedules_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.medication_doses alter column created_by drop not null;
alter table public.medication_doses drop constraint if exists medication_doses_created_by_fkey;
alter table public.medication_doses add constraint medication_doses_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.diary_entries alter column created_by drop not null;
alter table public.diary_entries drop constraint if exists diary_entries_created_by_fkey;
alter table public.diary_entries add constraint diary_entries_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.measurements alter column created_by drop not null;
alter table public.measurements drop constraint if exists measurements_created_by_fkey;
alter table public.measurements add constraint measurements_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.media_assets alter column created_by drop not null;
alter table public.media_assets drop constraint if exists media_assets_created_by_fkey;
alter table public.media_assets add constraint media_assets_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.ai_briefs alter column created_by drop not null;
alter table public.ai_briefs drop constraint if exists ai_briefs_created_by_fkey;
alter table public.ai_briefs add constraint ai_briefs_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.vet_reports alter column created_by drop not null;
alter table public.vet_reports drop constraint if exists vet_reports_created_by_fkey;
alter table public.vet_reports add constraint vet_reports_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.report_share_tokens alter column created_by drop not null;
alter table public.report_share_tokens drop constraint if exists report_share_tokens_created_by_fkey;
alter table public.report_share_tokens add constraint report_share_tokens_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.pet_routines alter column created_by drop not null;
alter table public.pet_routines drop constraint if exists pet_routines_created_by_fkey;
alter table public.pet_routines add constraint pet_routines_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

-- PostgreSQL does not index foreign-key columns automatically. Account deletion
-- updates every surviving creator reference, so keep those lookups indexed to
-- avoid full-table scans and unnecessarily long locks during auth user removal.
create index if not exists conditions_created_by_idx on public.conditions (created_by);
create index if not exists care_plans_created_by_idx on public.care_plans (created_by);
create index if not exists medications_created_by_idx on public.medications (created_by);
create index if not exists medication_schedules_created_by_idx on public.medication_schedules (created_by);
create index if not exists medication_doses_created_by_idx on public.medication_doses (created_by);
create index if not exists diary_entries_created_by_idx on public.diary_entries (created_by);
create index if not exists measurements_created_by_idx on public.measurements (created_by);
create index if not exists media_assets_created_by_idx on public.media_assets (created_by);
create index if not exists ai_briefs_created_by_idx on public.ai_briefs (created_by);
create index if not exists vet_reports_created_by_idx on public.vet_reports (created_by);
create index if not exists report_share_tokens_created_by_idx on public.report_share_tokens (created_by);
create index if not exists pet_routines_created_by_idx on public.pet_routines (created_by);

-- Nullable attribution is reserved for auth-user deletion. Direct clients may
-- update care data, but must never rewrite or erase the original creator.
revoke update on public.medication_doses from authenticated;
grant update (
  medication_name,
  scheduled_at,
  status,
  recorded_at,
  reaction_note,
  client_mutation_id,
  updated_at
) on public.medication_doses to authenticated;

revoke update on public.pet_routines from authenticated;
grant update (routine, updated_at) on public.pet_routines to authenticated;
