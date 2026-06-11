-- Direct chat between superadmin and aare.cc partner portal accounts.

create table if not exists public.partner_portal_messages (
  id uuid primary key default gen_random_uuid(),
  portal_account_id uuid not null references public.partner_portal_accounts(id) on delete cascade,
  sender text not null check (sender in ('partner', 'admin')),
  body text not null,
  admin_username text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_portal_messages_account_created
  on public.partner_portal_messages (portal_account_id, created_at desc);

create index if not exists idx_portal_messages_unread
  on public.partner_portal_messages (portal_account_id, sender)
  where read_at is null;

comment on table public.partner_portal_messages is
  'Direct chat threads between superadmin and partner portal accounts (one thread per account).';
