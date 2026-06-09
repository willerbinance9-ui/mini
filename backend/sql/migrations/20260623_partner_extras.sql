-- Partner applications workflow, partner commission on revenue events, public status.

alter table public.partner_applications
  add column if not exists partner_id uuid references public.partners(id) on delete set null;

alter table public.partner_applications
  add column if not exists admin_notes text;

alter table public.platform_revenue_events
  add column if not exists partner_id uuid references public.partners(id) on delete set null;

alter table public.platform_revenue_events
  add column if not exists partner_commission_amount numeric(18, 2) check (partner_commission_amount is null or partner_commission_amount >= 0);

create index if not exists idx_platform_revenue_partner_id
  on public.platform_revenue_events (partner_id, event_at desc)
  where partner_id is not null;

create index if not exists idx_partner_applications_partner_id
  on public.partner_applications (partner_id)
  where partner_id is not null;
