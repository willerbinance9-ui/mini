-- Add manual approval state for matured airfarming drop payouts.

alter table if exists public.airfarming_drops
  drop constraint if exists airfarming_drops_status_check;

alter table if exists public.airfarming_drops
  add constraint airfarming_drops_status_check
  check (status in ('scheduled', 'pending_approval', 'paid', 'missed'));
