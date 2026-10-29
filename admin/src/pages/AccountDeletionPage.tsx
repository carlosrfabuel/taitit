// Public page: how to delete a TAITIT tool account (Google Play asks for a web link that works
// without the app). English, like the app. What is deleted and kept matches delete_my_account()
// and the privacy policy (accounting records are kept).

import { useDocumentLang } from '../lib/useDocumentLang';

const EMAIL = 'admin@taititeyewear.com';

export function AccountDeletionPage() {
  useDocumentLang('en');
  return (
    <main className="min-h-screen bg-bg px-4 py-10 sm:px-6">
      <article className="mx-auto flex w-full max-w-2xl flex-col gap-6 rounded-2xl border border-line bg-surface p-6 sm:p-10">
        <header className="flex flex-col gap-3">
          <img src="/logo-full.svg" alt="TAITIT, tailored handcrafted eyewear" className="w-36 self-start" />
          <h1 className="text-3xl font-extrabold text-ink">Delete your account</h1>
          <p className="text-sm text-muted">TAITIT tool · ANATASA DESIGN SL</p>
        </header>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-extrabold text-ink">In the app</h2>
          <ol className="list-decimal space-y-1 pl-5 text-ink">
            <li>Open TAITIT tool and sign in.</li>
            <li>Go to Account and tap “Delete account”.</li>
            <li>Enter your password and tap “Delete my account”.</li>
          </ol>
          <p className="text-ink">The account is deleted at once.</p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-extrabold text-ink">Without the app</h2>
          <p className="text-ink">
            Send an email to <span className="font-semibold">{EMAIL}</span> from the email address of your
            account, asking to delete it. We delete it within 30 days and confirm by email.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-extrabold text-ink">What is deleted</h2>
          <ul className="list-disc space-y-1 pl-5 text-ink">
            <li>Your account and sign-in</li>
            <li>Your business details</li>
            <li>Your saved designs</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-extrabold text-ink">What is kept</h2>
          <p className="text-ink">
            Orders you have already sent stay with TAITIT, with the name and email they were sent with,
            because accounting and tax records must be kept (6 years). See the{' '}
            <a className="font-semibold text-brand underline" href="/privacy">
              privacy policy
            </a>
            .
          </p>
          <p className="text-ink">
            Spare part requests you have already sent (with their photos) also stay, so TAITIT can finish
            handling them.
          </p>
        </section>
      </article>
    </main>
  );
}
