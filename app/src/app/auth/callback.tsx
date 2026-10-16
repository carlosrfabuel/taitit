import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState, Loader, Screen, useToast } from '@/ui';

// Supabase confirms the email before redirecting here with ?code=…, so if only the code exchange
// fails (link opened on another device, already used, or replaced by a newer email), the account
// is confirmed: the user just has to sign in.
const CONFIRMED_BUT_NOT_SIGNED_IN = new Set([
  'pkce_code_verifier_not_found',
  'flow_state_not_found',
  'flow_state_expired',
]);

type State = { kind: 'working' } | { kind: 'confirmed' } | { kind: 'error'; message: string };

// Target of the sign-up confirmation email link: exchanges ?code=… for a session.
export default function AuthCallbackScreen() {
  const { code, error_description } = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const { exchangeCode } = useAuth();
  const toast = useToast();
  // Outcome remembered per code: a newer link opened while this screen is showing must be handled
  // on its own, never shown with the previous link's result.
  const [result, setResult] = useState<{ code: string; state: State } | null>(null);
  const started = useRef<string | null>(null);

  useEffect(() => {
    if (!code || error_description || started.current === code) return;
    started.current = code; // each code can be used once
    exchangeCode(code).then((res) => {
      if (!res.error) {
        toast('Email confirmado. ¡Bienvenido!', 'success');
        router.replace('/');
      } else if (res.errorCode && CONFIRMED_BUT_NOT_SIGNED_IN.has(res.errorCode)) {
        setResult({ code, state: { kind: 'confirmed' } });
      } else {
        setResult({ code, state: { kind: 'error', message: res.error } });
      }
    });
  }, [code, error_description, exchangeCode, toast]);

  // Redirect errors (e.g. expired link) arrive as error_description; then the email is NOT confirmed.
  const state: State = error_description
    ? { kind: 'error', message: error_description }
    : !code
      ? { kind: 'error', message: 'Enlace incompleto.' }
      : result?.code === code
        ? result.state
        : { kind: 'working' };

  if (state.kind === 'working') return <Loader message="Confirmando tu cuenta…" />;

  if (state.kind === 'confirmed') {
    return (
      <Screen>
        <EmptyState
          icon="checkmark-circle-outline"
          title="Email confirmado"
          message="Tu cuenta está confirmada. Inicia sesión con tu email y contraseña."
          actionLabel="Iniciar sesión"
          onAction={() => router.replace('/sign-in')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <EmptyState
        icon="alert-circle-outline"
        title="No se pudo confirmar"
        message={state.message}
        actionLabel="Ir a iniciar sesión"
        onAction={() => router.replace('/sign-in')}
      />
    </Screen>
  );
}
