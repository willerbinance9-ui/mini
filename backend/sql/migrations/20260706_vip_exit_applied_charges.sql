-- Store admin-selected charges applied on VIP exit approval.

alter table public.vip_exit_requests
  add column if not exists applied_penalty_usd numeric(18, 2),
  add column if not exists applied_gas_fees_usd numeric(18, 2),
  add column if not exists applied_commission_usd numeric(18, 2),
  add column if not exists applied_gas_reward_usd numeric(18, 2),
  add column if not exists applied_investment_extra_credit_usd numeric(18, 2),
  add column if not exists applied_net_revenue_usd numeric(18, 2),
  add column if not exists applied_net_total_usd numeric(18, 2);
