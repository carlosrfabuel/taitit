-- Day 20: TAITIT deletes a customer's account on request (the public /account-deletion page says
-- customers can ask by email; Google Play wants deletion possible without the app). Same rule as
-- delete_my_account(): profile, designs and sessions go, orders stay with the name/email copy.
-- Admins only; never their own account and never another admin's (those stay a deliberate step).

create function public.delete_customer_account(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role public.user_role;
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = 'insufficient_privilege';
  end if;
  if p_user = auth.uid() then
    raise exception 'own_account' using errcode = 'check_violation';
  end if;
  select role into target_role from public.profiles where id = p_user;
  if not found then
    raise exception 'account_not_found' using errcode = 'no_data_found';
  end if;
  if target_role = 'admin' then
    raise exception 'admin_account' using errcode = 'check_violation';
  end if;
  delete from auth.users where id = p_user;
end;
$$;

revoke execute on function public.delete_customer_account(uuid) from public, anon;
grant execute on function public.delete_customer_account(uuid) to authenticated;
