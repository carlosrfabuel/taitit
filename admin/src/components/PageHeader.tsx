import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Home } from 'lucide-react';

export type Crumb = { label: string; to?: string };

export function PageHeader({
  title,
  note,
  actions,
  crumbs,
  children,
}: {
  title: string;
  note?: string;
  /** Buttons shown on the right of the title. */
  actions?: ReactNode;
  /** Where the page sits (Home › Orders › #1006); Home is added in front. Not printed. */
  crumbs?: Crumb[];
  children?: ReactNode;
}) {
  return (
    <div className="mb-6">
      {crumbs && (
        <nav
          aria-label="Breadcrumb"
          className="mb-3 flex items-center gap-1.5 text-sm text-muted print:hidden"
        >
          <Link to="/" className="hover:text-ink" aria-label="Home">
            <Home className="size-4" aria-hidden />
          </Link>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <ChevronRight className="size-3.5" aria-hidden />
              {c.to ? (
                <Link to={c.to} className="hover:text-ink">
                  {c.label}
                </Link>
              ) : (
                <span className="text-ink">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl font-bold tracking-tight text-ink">{title}</h1>
          {note && <p className="mt-1.5 text-muted">{note}</p>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
