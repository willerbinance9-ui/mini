-- Weekly drop budget: up to 20 drops (4 per weekday × 5 days).

alter table public.user_drop_schedules
  drop constraint if exists user_drop_schedules_drop_count_check;

alter table public.user_drop_schedules
  add constraint user_drop_schedules_drop_count_check
  check (drop_count >= 1 and drop_count <= 20);

comment on table public.user_drop_schedules is
  'Admin weekly drop budget per user: AI distributes profit across up to 20 drops (4/day Mon–Fri).';
