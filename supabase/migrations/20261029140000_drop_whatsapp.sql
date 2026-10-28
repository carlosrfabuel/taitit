-- Printing replaces sending the order by WhatsApp (Carlos, 2026-10-27: "no se va a usar"), so the
-- WhatsApp number in Settings goes. The app version installed before this asks for the number when
-- WhatsApp is tapped; without it, WhatsApp opens and lets the optician choose the chat (no error).

drop function public.app_whatsapp_number();
alter table public.app_settings drop column whatsapp_number;
