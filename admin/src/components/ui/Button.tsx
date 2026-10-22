import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  // The TAITIT green gradient, as in the app (app/src/ui/BrandGradient: #3D8457 → #2F6B47 → #173D2A).
  primary:
    'bg-linear-to-br from-[#3D8457] via-brand to-[#173D2A] text-white border-transparent hover:opacity-90',
  secondary: 'bg-surface text-brand border-brand hover:bg-bg',
  ghost: 'bg-transparent text-brand border-transparent hover:bg-bg',
  danger: 'bg-surface text-danger border-danger hover:bg-red-50',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'md' | 'sm';
  icon?: ReactNode;
  loading?: boolean;
  /** A trailing arrow (→) for the page's main forward action. */
  arrow?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  arrow = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] font-semibold transition
        disabled:cursor-not-allowed disabled:opacity-45
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
        ${size === 'sm' ? 'h-8 px-3.5 text-sm' : 'h-10 px-5 text-sm'} ${VARIANTS[variant]} ${className}`}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
      {arrow && !loading ? <ArrowRight className="size-4" aria-hidden /> : null}
    </button>
  );
}
