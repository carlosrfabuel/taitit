import { NavLink, Outlet } from 'react-router';

const NAV = [
  { to: '/models', label: 'Modelos' },
  { to: '/palettes', label: 'Paletas' },
  { to: '/orders', label: 'Pedidos' },
];

export function AdminLayout() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-line bg-surface p-4">
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
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
