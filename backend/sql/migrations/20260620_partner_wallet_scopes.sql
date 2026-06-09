-- Extend partner API key scopes for wallet, deposits, withdrawals, and VIP.

alter table public.partner_api_keys
  alter column scopes set default array[
    'users', 'compliance', 'airfarming', 'wallet', 'deposits', 'withdrawals', 'vip', 'webhooks'
  ]::text[];

update public.partner_api_keys
set scopes = (
  select array_agg(distinct s)
  from unnest(
    coalesce(scopes, array[]::text[]) ||
    array['wallet', 'deposits', 'withdrawals', 'vip', 'webhooks']::text[]
  ) as s
)
where revoked_at is null;
