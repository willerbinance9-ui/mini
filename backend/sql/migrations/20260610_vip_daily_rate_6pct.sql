-- VIP Farmers daily accrual rate: 9% → 6% (application uses VIP_DAILY_RATE in db.js).

comment on table public.vip_accruals is
  'Daily VIP Farmers payout log (6% of principal per UTC day).';
