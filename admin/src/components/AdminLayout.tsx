import { NavLink, Outlet } from 'react-router';
import { LogOut } from 'lucide-react';
import { useAuth } from '../auth/context';
import { ThumbnailRefresher } from './ThumbnailRefresher';

const NAV = [
  { to: '/models', label: 'Modelos' },
  { to: '/palettes', label: 'Paletas' },
  { to: '/orders', label: 'Pedidos' },
  ...(import.meta.env.DEV ? [{ to: '/dev/ui-kit', label: 'UI kit (dev)' }] : []),
];

export function AdminLayout() {
  const { email, signOut } = useAuth();
  return (
    <div className="flex min-h-screen">
      {/* Fixed to the window height (sticky): the account and sign-out stay visible on long pages. */}
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col self-start overflow-y-auto border-r border-line bg-surface p-4">
        <div className="mb-8 px-2 text-lg font-extrabold tracking-wider text-brand">TAITIT</div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-semibold ${
                  isActive ? 'bg-brand text-white' : 'text-ink hover:bg-bg'
                }`
              }
            >
              {n.label}
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
      <main className="min-w-0 flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
