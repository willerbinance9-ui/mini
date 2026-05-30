-- Clear all in-app notices / announcements (Supabase SQL editor).
-- Does NOT reset mobile dismiss flags (AsyncStorage on device).

begin;

delete from public.app_notifications;

delete from public.app_announcements;

commit;

-- Verify:
-- select count(*) from public.app_notifications;
-- select count(*) from public.app_announcements;
