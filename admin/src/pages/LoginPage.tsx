import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../auth/context';
import { Button, Input, Spinner } from '../components/ui';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const { status, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Back to the page the guard sent us from (only paths inside the panel).
  const from = (location.state as { from?: string } | null)?.from;
  const target = from?.startsWith('/') && !from.startsWith('//') && from !== '/login' ? from : '/models';

  if (status === 'admin') return <Navigate to={target} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const next = {
      email: !email.trim()
        ? 'Introduce tu email.'
        : EMAIL.test(email.trim())
          ? null
          : 'Introduce un email válido.',
      password: password ? null : 'Introduce tu contraseña.',
    };
    setErrors(next);
    setFormError(null);
    if (next.email || next.password) return;
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setFormError(error);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={submit}
        noValidate
        className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8"
      >
        <div className="text-center text-xl font-extrabold tracking-wider text-brand">TAITIT · Panel</div>
        <p className="mt-1 mb-6 text-center text-sm text-muted">Acceso de administrador</p>
        {status === 'loading' && !loading ? (
          <Spinner label="Comprobando sesión…" />
        ) : (
          <div className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              value={email}
              error={errors.email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((x) => ({ ...x, email: null }));
              }}
            />
            <Input
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              value={password}
              error={errors.password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((x) => ({ ...x, password: null }));
              }}
            />
            {formError && (
              <p role="alert" className="text-sm text-danger">
                {formError}
              </p>
            )}
            <Button type="submit" loading={loading} className="w-full">
              Entrar
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
