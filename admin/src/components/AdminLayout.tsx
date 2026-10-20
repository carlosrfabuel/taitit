import { NavLink, Outlet } from 'react-router';
import { LogOut } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { countPending, customerKeys } from '../lib/customers';
import { useAuth } from '../auth/context';
import { ThumbnailRefresher } from './ThumbnailRefresher';

const NAV = [
  { to: '/models', label: 'Modelos' },
  { to: '/palettes', label: 'Paletas' },
  { to: '/orders', label: 'Pedidos' },
  { to: '/customers', label: 'Clientes' },
  ...(import.meta.env.DEV ? [{ to: '/dev/ui-kit', label: 'UI kit (dev)' }] : []),
];

export function AdminLayout() {
  const { email, signOut } = useAuth();
  // Accounts waiting for approval, shown next to Clientes (refreshed every minute).
  const pendingQuery = useQuery({
    queryKey: customerKeys.pending,
    queryFn: countPending,
    refetchInterval: 60_000,
  });
  const pending = pendingQuery.data ?? 0;
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-surface p-4 print:hidden">
        <div className="mb-8 px-2 text-lg font-extrabold tracking-wider text-brand">TAITIT</div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-semibold ${
                  isActive ? 'bg-selected text-on-selected' : 'text-ink hover:bg-bg'
                }`
              }
            >
              {n.label}
              {n.to === '/customers' && pending > 0 && (
                <span
                  className="ml-2 rounded-full bg-danger px-1.5 py-0.5 text-xs font-bold text-white"
                  aria-label={`${pending} pendientes`}
                >
                  {pending}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-line pt-4">
          <p className="truncate px-2 text-xs text-muted" title={email ?? undefined}>
            {email}
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-ink hover:bg-bg"
          >
            <LogOut className="size-4" aria-hidden />
            Cerrar sesión
          </button>
        </div>
      </aside>
      <ThumbnailRefresher />
      <main className="min-w-0 flex-1 p-8 print:p-0">
        <Outlet />
      </main>
    </div>
  );
}
