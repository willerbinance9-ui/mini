-- Audit log for VIP earnings reinvested into principal (superadmin visibility).

create table if not exists public.vip_reinvest_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  investment_id uuid not null references public.vip_investments(id) on delete cascade,
  amount_usd numeric(18, 2) not null check (amount_usd > 0),
  previous_principal_usd numeric(18, 2) not null default 0 check (previous_principal_usd >= 0),
  new_principal_usd numeric(18, 2) not null default 0 check (new_principal_usd >= 0),
  lock_reset boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_vip_reinvest_events_user on public.vip_reinvest_events (user_id, created_at desc);
create index if not exists idx_vip_reinvest_events_created on public.vip_reinvest_events (created_at desc);

comment on table public.vip_reinvest_events is
  'VIP members who reinvested earned revenue into principal without exiting.';
