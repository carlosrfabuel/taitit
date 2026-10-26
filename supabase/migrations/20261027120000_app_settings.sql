-- Settings TAITIT changes from the admin panel (2026-10-26, Carlos: "si lo podemos cambiar nosotros,
-- mejor"): the WhatsApp number orders are shared to, and the address the order emails go to (tests
-- on admin@ until orders@ is active). One row. Admins read and change it; the app only needs the
-- WhatsApp number, through app_whatsapp_number(), so the order email isn't readable by customers.
create table public.app_settings (
  id boolean primary key default true check (id),
  -- Digits only, with the country code (wa.me format); empty = WhatsApp asks which chat.
  whatsapp_number text not null default '' check (whatsapp_number ~ '^[0-9]{0,15}$'),
  order_email text not null default 'admin@taititeyewear.com'
    check (char_length(order_email) <= 254 and order_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id, whatsapp_number, order_email)
values (true, '34647942967', 'admin@taititeyewear.com');

alter table public.app_settings enable row level security;

create policy "app_settings: admin reads" on public.app_settings
  for select to authenticated using ((select private.is_admin()));
create policy "app_settings: admin updates" on public.app_settings
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

grant select on public.app_settings to authenticated;
grant update (whatsapp_number, order_email) on public.app_settings to authenticated;

create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

-- The WhatsApp number for the app's "share order" link (any signed-in user; '' when not set).
create function public.app_whatsapp_number()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select whatsapp_number from public.app_settings where id), '');
$$;

revoke execute on function public.app_whatsapp_number() from public, anon;
grant execute on function public.app_whatsapp_number() to authenticated;
