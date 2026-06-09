-- Partnership / API access applications from Aare public form.

create table if not exists public.partner_applications (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'approved', 'rejected')),
  full_name text not null,
  email citext not null,
  country text not null,
  phone text not null,
  occupation text not null,
  income_per_year numeric(18, 2) not null check (income_per_year >= 0),
  intended_investment numeric(18, 2) not null check (intended_investment > 0),
  withdraw_frequency text not null check (withdraw_frequency in ('week', 'month', 'trimester')),
  withdraw_amount numeric(18, 2),
  invested_before boolean not null default false,
  previous_investment_amount numeric(18, 2),
  previous_return_amount numeric(18, 2),
  previous_duration text,
  investment_history_notes text,
  payment_preference text not null check (payment_preference in ('fiat', 'crypto')),
  bank_details jsonb,
  crypto_address text,
  crypto_network text,
  has_api_knowledge boolean not null default false,
  api_plan text check (api_plan is null or api_plan in ('hire', 'self')),
  terms_accepted_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_partner_applications_email on public.partner_applications (email);
create index if not exists idx_partner_applications_status_created on public.partner_applications (status, created_at desc);
