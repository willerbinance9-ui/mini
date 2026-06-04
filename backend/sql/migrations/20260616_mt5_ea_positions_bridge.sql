-- MT5 EA bridge: positions snapshot on account + close-position commands.

alter table public.mt5_accounts add column if not exists ea_positions_snapshot jsonb not null default '[]'::jsonb;
alter table public.mt5_accounts add column if not exists ea_snapshot_at timestamptz;

alter table public.mt5_ea_commands add column if not exists command_type text not null default 'market';
alter table public.mt5_ea_commands add column if not exists position_ticket bigint;

alter table public.mt5_ea_commands drop constraint if exists mt5_ea_commands_side_check;
alter table public.mt5_ea_commands add constraint mt5_ea_commands_side_check
  check (side in ('buy', 'sell', 'close'));

alter table public.mt5_ea_commands drop constraint if exists mt5_ea_commands_volume_check;
alter table public.mt5_ea_commands add constraint mt5_ea_commands_volume_check check (volume >= 0);
