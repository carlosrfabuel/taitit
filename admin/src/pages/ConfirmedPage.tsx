import { CheckCircle2, CircleAlert } from 'lucide-react';

// Public landing page of the sign-up confirmation email (the app's emailRedirectTo). Supabase marks
// the email as confirmed when the link is opened, before redirecting here, so this page only shows
// the result: the app (waiting screen) notices the confirmation by itself. Expired or used links
// arrive with an error in the URL (query or #fragment). English: it is for opticians, like the app.
function linkError(): string | null {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const code = params.get('error_code') ?? hash.get('error_code');
  const error = params.get('error') ?? hash.get('error');
  if (!code && !error) return null;
  if (code === 'otp_expired') return 'This confirmation link has expired or was already used.';
  return 'This confirmation link is not valid any more.';
}

export function ConfirmedPage() {
  const error = linkError();
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center">
        <div className="mb-4 text-lg font-extrabold tracking-wider text-brand">TAITIT</div>
        {error ? (
          <>
            <CircleAlert className="mx-auto mb-3 size-12 text-danger" aria-hidden />
            <h1 className="mb-2 text-2xl font-extrabold text-ink">Link not valid</h1>
            <p className="text-muted">{error}</p>
            <p className="mt-3 text-muted">
              If you already confirmed your email, just sign in in the TAITIT app. Otherwise open the app and
              tap “Resend email” to get a new link.
            </p>
          </>
        ) : (
          <>
            <CheckCircle2 className="mx-auto mb-3 size-12 text-success" aria-hidden />
            <h1 className="mb-2 text-2xl font-extrabold text-ink">Email confirmed</h1>
            <p className="text-muted">
              Your email address is confirmed. Go back to the TAITIT app to continue.
            </p>
            <p className="mt-3 text-sm text-muted">
              TAITIT reviews new accounts before they can send orders. Meanwhile you can browse the collection
              and save designs.
            </p>
          </>
        )}
        <p className="mt-6 text-xs text-muted">You can close this page.</p>
      </div>
    </main>
  );
}
