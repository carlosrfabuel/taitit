-- Day 20: customers delete their own account from the app (App Store and Google Play require it).
-- Deleting the auth user uses the existing rule (Day 3, MILESTONE_PLAN 3): the profile, saved designs
-- and sessions go; orders stay for TAITIT's accounting with the name/email copy and no user (the
-- privacy policy keeps accounting data 6 years); order images stay with their orders.
-- Admin accounts can't delete themselves here (another admin removes them), so the panel can't be
-- left without its last admin by a tap in the app.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  my_role public.user_role;
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;
  select role into my_role from public.profiles where id = uid;
  if my_role = 'admin' then
    raise exception 'admin_account' using errcode = 'insufficient_privilege';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
