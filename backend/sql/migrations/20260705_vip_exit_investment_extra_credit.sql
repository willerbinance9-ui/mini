-- Investment extra credit on VIP exit requests.

alter table public.vip_exit_requests
  add column if not exists investment_extra_credit_usd numeric(18, 2) not null default 0
    check (investment_extra_credit_usd >= 0);
