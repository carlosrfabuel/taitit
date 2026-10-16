import { AuthError } from '@supabase/supabase-js';

// Spanish copy for Supabase Auth errors (codes: https://supabase.com/docs/guides/auth/debugging/error-codes).
const BY_CODE: Record<string, string> = {
  invalid_credentials: 'Email o contraseña incorrectos.',
  email_not_confirmed: 'Confirma tu email antes de iniciar sesión. Revisa tu bandeja de entrada.',
  weak_password: 'La contraseña es demasiado débil. Usa al menos 8 caracteres.',
  same_password: 'La nueva contraseña debe ser distinta de la actual.',
  email_address_invalid: 'Este email no es válido.',
  over_email_send_rate_limit: 'Demasiados emails enviados. Espera unos minutos e inténtalo de nuevo.',
  over_request_rate_limit: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  signup_disabled: 'El registro está desactivado temporalmente.',
  flow_state_expired: 'El enlace ha caducado. Solicita uno nuevo.',
  flow_state_not_found: 'El enlace no es válido o ya se usó. Solicita uno nuevo.',
  otp_expired: 'El enlace ha caducado. Solicita uno nuevo.',
  // PKCE: the link only works on the device where it was requested (or it was already used).
  pkce_code_verifier_not_found:
    'Abre el enlace en el mismo móvil desde el que lo solicitaste, o solicita uno nuevo.',
  session_not_found: 'Tu sesión ha caducado. Inicia sesión de nuevo.',
};

export function authErrorMessage(error: unknown): string {
  if (error instanceof AuthError) {
    if (error.code && BY_CODE[error.code]) return BY_CODE[error.code];
    // status 0 = request never reached the server.
    if (error.status === 0 || error.name === 'AuthRetryableFetchError') {
      return 'Sin conexión. Comprueba tu internet e inténtalo de nuevo.';
    }
  }
  return 'Ha ocurrido un error. Inténtalo de nuevo.';
}
