-- Track portal partner activity for the admin online/last-seen view.

alter table public.partner_portal_accounts
  add column if not exists last_seen_at timestamptz;

create index if not exists idx_partner_portal_accounts_last_seen
  on public.partner_portal_accounts (last_seen_at desc)
  where last_seen_at is not null;

comment on column public.partner_portal_accounts.last_seen_at is
  'Updated on every authenticated portal request (throttled); admin shows online when within 2 minutes.';
