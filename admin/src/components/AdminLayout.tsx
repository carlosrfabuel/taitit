import { NavLink, Outlet } from 'react-router';
import { Glasses, House, LogOut, Palette, Receipt, Shapes, Users, type LucideIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { countPending, customerKeys } from '../lib/customers';
import { countOrdersSince, orderKeys, ordersSeenAt } from '../lib/orders';
import { useAuth } from '../auth/context';
import { ThumbnailRefresher } from './ThumbnailRefresher';

const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Home', icon: House },
  { to: '/models', label: 'Models', icon: Glasses },
  { to: '/palettes', label: 'Palettes', icon: Palette },
  { to: '/orders', label: 'Orders', icon: Receipt },
  { to: '/customers', label: 'Customers', icon: Users },
  ...(import.meta.env.DEV ? [{ to: '/dev/ui-kit', label: 'UI kit (dev)', icon: Shapes }] : []),
];

/** The admin's initials, from the part of the email before the @ (e.g. "carlos.f" → "CF"). */
const initials = (email: string | null) => {
  const parts = (email ?? '')
    .split('@')[0]!
    .split(/[._-]+/)
    .filter(Boolean);
  return ((parts[0]?.[0] ?? 'A') + (parts[1]?.[0] ?? '')).toUpperCase();
};

export function AdminLayout() {
  const { email, signOut } = useAuth();
  // Accounts waiting for approval, shown next to Customers (refreshed every minute).
  const pendingQuery = useQuery({
    queryKey: customerKeys.pending,
    queryFn: countPending,
    refetchInterval: 60_000,
  });
  const pending = pendingQuery.data ?? 0;
  // Orders sent since this browser last opened Orders, shown next to Orders.
  const seen = useQuery({ queryKey: orderKeys.seen, queryFn: ordersSeenAt, staleTime: Infinity });
  const seenAt = seen.data ?? null;
  const freshQuery = useQuery({
    queryKey: orderKeys.since(seenAt ?? ''),
    queryFn: () => countOrdersSince(seenAt!),
    enabled: !!seenAt,
    refetchInterval: 60_000,
  });
  const fresh = seenAt ? (freshQuery.data ?? 0) : 0;
  const badge = (to: string) =>
    to === '/customers' && pending > 0
      ? { n: pending, label: `${pending} pending`, tone: 'bg-danger text-white' }
      : to === '/orders' && fresh > 0
        ? {
            n: fresh,
            label: `${fresh} new ${fresh === 1 ? 'order' : 'orders'}`,
            tone: 'bg-highlight text-on-highlight',
          }
        : null;
  return (
    <div className="flex min-h-screen">
      {/* Deep green sidebar (as the app's start screen): white logo, icons, the selected item as a pill. */}
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-forest px-4 py-6 text-white print:hidden">
        <div className="mb-10 px-2">
          <img src="/logo-full-white.svg" alt="TAITIT, tailored handcrafted eyewear" className="w-40" />
          <p className="mt-2 text-xs font-medium tracking-wide text-white/60">Admin workspace</p>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => {
            const b = badge(n.to);
            const Icon = n.icon;
            return (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition ${
                    isActive
                      ? 'bg-selected text-on-selected'
                      : 'text-white/85 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon className="size-5" aria-hidden />
                <span className="flex-1">{n.label}</span>
                {b && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${b.tone}`}
                    aria-label={b.label}
                  >
                    {b.n}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center gap-3 border-t border-forest-line px-2 pt-4">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold"
            aria-hidden
          >
            {initials(email)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Admin</p>
            <p className="truncate text-xs text-white/60" title={email ?? undefined}>
              {email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="size-5" aria-hidden />
          </button>
        </div>
      </aside>
      <ThumbnailRefresher />
      <main className="min-w-0 flex-1 px-10 py-8 print:p-0">
        <Outlet />
      </main>
    </div>
  );
}
