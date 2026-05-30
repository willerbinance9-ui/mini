-- P2P trade dispute metadata

alter table public.p2p_trades
  add column if not exists disputed_at timestamptz,
  add column if not exists disputed_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists dispute_note text not null default '';
