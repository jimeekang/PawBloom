alter table public.medication_schedules add column if not exists recurrence_interval_days integer not null default 1;
alter table public.medication_schedules add constraint medication_schedules_recurrence_interval_positive check (recurrence_interval_days >= 1);

alter table public.medication_doses add column if not exists dose_date date;

update public.medication_doses
set dose_date = (scheduled_at at time zone 'Australia/Sydney')::date
where dose_date is null;

alter table public.medication_doses alter column dose_date set not null;

create unique index if not exists medication_doses_schedule_date_unique
  on public.medication_doses(pet_id, schedule_id, dose_date)
  where schedule_id is not null;
