-- AarAi chat assistant: allow 'ai' sender on portal messages and track human handoff.

alter table public.partner_portal_messages
  drop constraint if exists partner_portal_messages_sender_check;

alter table public.partner_portal_messages
  add constraint partner_portal_messages_sender_check
  check (sender in ('partner', 'admin', 'ai'));

alter table public.partner_portal_accounts
  add column if not exists chat_human_requested_at timestamptz;

comment on column public.partner_portal_accounts.chat_human_requested_at is
  'When set, AarAi stops auto-replying and the thread is handled by a human admin.';
