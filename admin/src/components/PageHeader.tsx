import type { ReactNode } from 'react';

export function PageHeader({
  title,
  note,
  actions,
  children,
}: {
  title: string;
  note?: string;
  /** Buttons shown on the right of the title. */
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">{title}</h1>
          {note && <p className="mt-1 text-muted">{note}</p>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
