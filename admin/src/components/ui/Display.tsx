import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { ORDER_STATUS_LABEL, tokens, type OrderStatus } from '@taitit/shared';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>{children}</div>;
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className="inline-block rounded-full px-3 py-0.5 text-xs font-semibold text-white"
      style={{ backgroundColor: tokens.statusColors[status] }}
    >
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 p-6 text-muted">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 p-10 text-center">
      {icon && (
        <div className="mb-2 flex size-14 items-center justify-center rounded-full bg-bg text-muted">
          {icon}
        </div>
      )}
      <p className="text-lg font-bold text-ink">{title}</p>
      {message && <p className="max-w-sm text-sm text-muted">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Color sample for palette lists; checkerboard shows translucency, texture replaces the color. */
export function Swatch({
  hex,
  alpha,
  textureUrl,
  size = 28,
  title,
}: {
  hex: string;
  alpha?: number | null;
  textureUrl?: string | null;
  size?: number;
  title: string;
}) {
  return (
    <span
      title={title}
      aria-label={title}
      role="img"
      className="relative inline-block overflow-hidden rounded-full border border-black/15"
      style={{
        width: size,
        height: size,
        backgroundImage:
          alpha != null ? 'conic-gradient(#d5d5d0 25%, #fff 0 50%, #d5d5d0 0 75%, #fff 0)' : undefined,
        backgroundSize: alpha != null ? '50% 50%' : undefined,
      }}
    >
      {textureUrl ? (
        <img src={textureUrl} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <span className="absolute inset-0" style={{ backgroundColor: hex, opacity: alpha ?? 1 }} />
      )}
    </span>
  );
}
