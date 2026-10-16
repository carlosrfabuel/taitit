// Client-side checks so obvious mistakes are caught before a network round-trip.
// The server still validates everything.

export const PASSWORD_MIN = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Enter your email.';
  if (!EMAIL_RE.test(email.trim())) return 'Enter a valid email address.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Enter a password.';
  if (password.length < PASSWORD_MIN) return `The password must be at least ${PASSWORD_MIN} characters.`;
  return null;
}

export function validateName(name: string): string | null {
  if (!name.trim()) return 'Enter your name.';
  if (name.trim().length > 120) return 'This name is too long.';
  return null;
}
