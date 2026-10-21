import type { ReactNode } from 'react';
import { useDocumentLang } from '../lib/useDocumentLang';

// Public privacy policy (linked from the app's sign-up and account screens, and the app stores).
// Text from TAITIT (Carlos, 2026-10-20), unchanged except: the data controller email had a typo
// (".co"; ".com" everywhere else), two leftover section numbers ("III.", "section VII") of the
// original document were removed, and the AEPD link uses its current domain (aepd.es; the text had
// the old agpd.es). English, like the app.

const EMAIL = 'admin@taititeyewear.com';

function Section({ title, question, children }: { title: string; question: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-extrabold text-ink">{title}</h2>
      <p className="font-semibold text-ink">{question}</p>
      <div className="flex flex-col gap-2 text-ink">{children}</div>
    </section>
  );
}

const List = ({ items }: { items: string[] }) => (
  <ul className="list-disc space-y-1 pl-5">
    {items.map((i) => (
      <li key={i}>{i}</li>
    ))}
  </ul>
);

export function PrivacyPage() {
  useDocumentLang('en');
  return (
    <main className="min-h-screen bg-bg px-4 py-10 sm:px-6">
      <article className="mx-auto flex w-full max-w-2xl flex-col gap-8 rounded-2xl border border-line bg-surface p-6 sm:p-10">
        <header className="flex flex-col gap-3">
          <img src="/logo.svg" alt="TAITIT" className="h-7 w-auto self-start" />
          <h1 className="text-3xl font-extrabold text-ink">Privacy policy</h1>
          <p className="text-sm text-muted">Taitit tool · Last updated 20 October 2026</p>
        </header>

        <Section title="Data controller" question="Who is responsible for processing your data?">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted">Company name</dt>
            <dd>ANATASA DESIGN SL</dd>
            <dt className="text-muted">VAT number</dt>
            <dd>B88371679</dd>
            <dt className="text-muted">Address</dt>
            <dd>Avda de las Provincias, 18, 28941 Fuenlabrada</dd>
            <dt className="text-muted">Phone</dt>
            <dd>+34 684 053 791</dd>
            <dt className="text-muted">Email</dt>
            <dd>{EMAIL}</dd>
          </dl>
        </Section>

        <Section title="Purpose" question="Why do we process your personal data?">
          <p>At ANATASA DESIGN SL, we process your information for the following purposes:</p>
          <List
            items={[
              'To maintain the commercial relationship and provide the contracted services',
              'To send commercial information related to our sector',
              'To prepare a customized quote based on your needs',
              'To manage email communications with interested parties',
              'To conduct recruitment processes',
              'To ensure the security of our premises (video surveillance)',
              'To manage employees and human resources',
            ]}
          />
        </Section>

        <Section title="Retention" question="How long will we keep your data?">
          <p>
            Your personal data will be stored for as long as the commercial relationship remains active.
            However, to ensure maximum transparency, we detail below the general retention periods:
          </p>
          <List
            items={[
              'Accounting, tax and labor: 6 years',
              'Employment-related records: 10 years',
              'Recruitment: 2 years from receipt of your CV',
              'Video surveillance: 30 days, unless an incident or crime is recorded',
            ]}
          />
          <p>
            Even after our relationship ends, we may retain your data to continue sending newsletters related
            to our products and services. You may opt out or exercise your rights at any time through the most
            convenient channel for you.
          </p>
          <p>We also periodically review our systems to delete data that is no longer legally required.</p>
        </Section>

        <Section title="Legal basis" question="What is the legal basis for processing your data?">
          <p>Depending on the purpose, your data is processed on the following legal grounds:</p>
          <dl className="flex flex-col gap-2">
            {[
              [
                'Managing the commercial relationship',
                'Performance of a contract (Art. 6.1.b GDPR); data subject’s consent (Art. 6.1.a GDPR)',
              ],
              [
                'Sending commercial communications',
                'Consent (Art. 6.1.a GDPR and Art. 20 LSSICE); legitimate interest (Art. 6.1.f GDPR)',
              ],
              [
                'Providing a personalized quote',
                'Pre-contractual or contractual relationship (Art. 6.1.b GDPR)',
              ],
              [
                'Managing email communications',
                'Consent (Art. 6.1.a GDPR); legitimate interest (Art. 6.1.f GDPR)',
              ],
              ['Recruitment', 'Consent (Art. 6.1.a GDPR)'],
              ['Security (video surveillance)', 'Legitimate interest (Art. 6.1.f GDPR)'],
              ['Human resources management', 'Performance of a contract (Art. 6.1.b GDPR)'],
            ].map(([purpose, basis]) => (
              <div key={purpose}>
                <dt className="font-semibold">{purpose}</dt>
                <dd className="text-muted">{basis}</dd>
              </div>
            ))}
          </dl>
          <p>
            All data requested is necessary to provide our service. Any data marked with an asterisk (*) is
            mandatory.
          </p>
          <p>Without this information, ANATASA DESIGN SL cannot provide the requested services.</p>
        </Section>

        <Section title="Your rights" question="What are your data protection rights?">
          <p>
            You may exercise the following rights by contacting us at Avenida de las Provincias, 18 – Local
            16, 28941 Fuenlabrada or via email at {EMAIL}:
          </p>
          <List
            items={[
              'Right to access your personal data',
              'Right to rectification or deletion',
              'Right to restrict processing',
              'Right to object to processing',
              'Right to data portability',
            ]}
          />
          <p>
            You also have the right to file a complaint with the Spanish Data Protection Agency (AEPD). See
            “Supervisory authority” below for more details.
          </p>
        </Section>

        <Section title="Recipients" question="Will your data be shared?">
          <p>
            Your data will not be shared with third-party companies. We also do not transfer your data
            internationally to third countries.
          </p>
        </Section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-extrabold text-ink">Supervisory authority</h2>
          <p className="text-ink">
            At ANATASA DESIGN SL we are fully committed to data protection. If you believe your rights have
            been violated, you may file a complaint with the Agencia Española de Protección de Datos (AEPD) at
            C/ Jorge Juan, 6, 28001 Madrid. More information available at{' '}
            <a
              className="font-semibold text-brand underline"
              href="https://www.aepd.es"
              target="_blank"
              rel="noreferrer"
            >
              www.aepd.es
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
