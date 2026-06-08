-- Admin withdrawal queue: priority flags (no payout) + superadmin visibility.

create table if not exists public.admin_withdrawal_queue_meta (
  source text not null check (source in ('cash_wallet', 'nowpayments', 'local_money')),
  withdrawal_id uuid not null,
  admin_priority boolean not null default false,
  admin_pushed_at timestamptz,
  admin_pushed_by text,
  updated_at timestamptz not null default now(),
  primary key (source, withdrawal_id)
);

create index if not exists idx_admin_withdrawal_queue_meta_pushed
  on public.admin_withdrawal_queue_meta (admin_pushed_at desc nulls last)
  where admin_priority = true;
