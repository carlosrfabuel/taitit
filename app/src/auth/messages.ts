import { AuthError } from '@supabase/supabase-js';

// Messages for Supabase Auth errors (codes: https://supabase.com/docs/guides/auth/debugging/error-codes).
const BY_CODE: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  email_not_confirmed: 'Confirm your email before signing in. Check your inbox.',
  weak_password: 'This password is too weak. Use at least 8 characters.',
  same_password: 'The new password must be different from the current one.',
  email_address_invalid: 'This email address is not valid.',
  over_email_send_rate_limit: 'Too many emails sent. Wait a few minutes and try again.',
  over_request_rate_limit: 'Too many attempts. Wait a few minutes and try again.',
  signup_disabled: 'Sign-up is temporarily disabled.',
  flow_state_expired: 'This link has expired. Request a new one.',
  flow_state_not_found: 'This link is not valid or was already used. Request a new one.',
  otp_expired: 'This link has expired. Request a new one.',
  // PKCE: the link only works on the device where it was requested (or it was already used).
  pkce_code_verifier_not_found:
    'Open the link on the same phone you requested it from, or request a new one.',
  session_not_found: 'Your session has expired. Please sign in again.',
};

export function authErrorMessage(error: unknown): string {
  if (error instanceof AuthError) {
    if (error.code && BY_CODE[error.code]) return BY_CODE[error.code];
    // status 0 = request never reached the server.
    if (error.status === 0 || error.name === 'AuthRetryableFetchError') {
      return 'No connection. Check your internet and try again.';
    }
  }
  return 'Something went wrong. Please try again.';
}

/**
 * Message for an error that arrives in an email link (?error_code=…&error_description=…). The
 * description is never shown: anyone can craft a link, so only known codes map to our own text.
 */
export function linkErrorMessage(errorCode: string | undefined): string {
  return (errorCode && BY_CODE[errorCode]) || 'This link is not valid or has expired. Request a new one.';
}
