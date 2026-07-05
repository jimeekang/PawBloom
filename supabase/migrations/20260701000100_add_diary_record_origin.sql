alter table public.diary_entries
  add column if not exists record_origin text not null default 'diary';

alter table public.diary_entries
  add constraint diary_entries_record_origin_check
  check (record_origin in ('diary', 'checklist'));
