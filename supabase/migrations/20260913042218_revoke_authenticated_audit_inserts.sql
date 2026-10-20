-- Audit rows describe privileged server-side membership changes. Clients may
-- read rows permitted by RLS, but must not be able to manufacture audit
-- history with caller-controlled event types, metadata, or timestamps.
revoke insert on table public.audit_events from anon, authenticated;

-- Remove the dormant client policy as well, so a later table-grant change
-- cannot silently reopen direct audit writes.
drop policy if exists "audit own insert" on public.audit_events;
