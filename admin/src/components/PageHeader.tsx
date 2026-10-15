import type { ReactNode } from 'react';

export function PageHeader({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-extrabold text-ink">{title}</h1>
      {note && <p className="mt-1 text-muted">{note}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
