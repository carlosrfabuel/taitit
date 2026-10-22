import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Button, Card, Spinner } from '../components/ui';
import { NOT_ADMIN_MESSAGE, useAuth } from './context';

// Wraps every panel route: guests go to /login, signed-in customers are shown a no-access screen.
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { status, email, signOut, retry } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Checking access…" />
      </div>
    );
  }
  if (status === 'signedOut') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (status === 'admin') return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm text-center">
        <p className="text-lg font-bold text-ink">
          {status === 'forbidden' ? NOT_ADMIN_MESSAGE : 'Could not check your access.'}
        </p>
        {email && <p className="mt-1 text-sm text-muted">{email}</p>}
        <div className="mt-5 flex justify-center gap-2">
          {status === 'error' && <Button onClick={retry}>Retry</Button>}
          <Button variant="secondary" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  );
}
