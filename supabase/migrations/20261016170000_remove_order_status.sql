-- Client decision (2026-10-16): orders have no status. The app is used by opticians and sales reps,
-- never by end customers, so there is nothing to track after an order is sent.
--
-- Removes the status column, its timestamp, index and trigger, and the admin's permission to update
-- orders (status was the only column it could change). Orders are now read-only once created,
-- which matches the immutable order snapshot.

drop policy "orders: admin updates status" on public.orders;
revoke update (status) on public.orders from authenticated;

drop trigger orders_status_touch on public.orders;
drop function public.touch_order_status();
drop index public.orders_status_idx;

alter table public.orders
  drop column status,
  drop column status_updated_at;

drop type public.order_status;
