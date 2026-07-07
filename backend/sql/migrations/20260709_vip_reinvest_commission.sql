-- Allow VIP reinvest commission in the platform revenue ledger.

alter table public.platform_revenue_events
  drop constraint if exists platform_revenue_events_event_type_check;

alter table public.platform_revenue_events
  add constraint platform_revenue_events_event_type_check
  check (event_type in (
    'airfarming_drop',
    'withdrawal',
    'vip_accrual',
    'vip_loan_commission',
    'vip_reinvest_commission'
  ));
