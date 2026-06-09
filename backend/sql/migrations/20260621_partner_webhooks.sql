-- Partner outbound webhooks (deposit credited, withdrawal finished).

alter table public.partners
  add column if not exists webhook_url text,
  add column if not exists webhook_secret text,
  add column if not exists webhook_enabled boolean not null default false,
  add column if not exists webhook_events text[] not null default array['deposit.credited', 'withdrawal.finished']::text[];

create table if not exists public.partner_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  event_type text not null,
  source_id text not null,
  payload jsonb not null,
  response_status int,
  response_body text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (partner_id, event_type, source_id)
);

create index if not exists idx_partner_webhook_deliveries_partner_id
  on public.partner_webhook_deliveries(partner_id, created_at desc);

comment on column public.partners.webhook_url is 'HTTPS endpoint for partner event callbacks.';
comment on column public.partners.webhook_secret is 'HMAC secret for X-Ema-Signature verification.';

-- Allow partners to configure webhooks on existing API keys.
update public.partner_api_keys
set scopes = (
  select array_agg(distinct s)
  from unnest(coalesce(scopes, array[]::text[]) || array['webhooks']::text[]) as s
)
where revoked_at is null;

alter table public.partner_api_keys
  alter column scopes set default array[
    'users', 'compliance', 'airfarming', 'wallet', 'deposits', 'withdrawals', 'vip', 'webhooks'
  ]::text[];
