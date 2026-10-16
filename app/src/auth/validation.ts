// Client-side checks so obvious mistakes are caught before a network round-trip.
// The server still validates everything.

export const PASSWORD_MIN = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Introduce tu email.';
  if (!EMAIL_RE.test(email.trim())) return 'Introduce un email válido.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Introduce una contraseña.';
  if (password.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  return null;
}

export function validateName(name: string): string | null {
  if (!name.trim()) return 'Introduce tu nombre.';
  if (name.trim().length > 120) return 'El nombre es demasiado largo.';
  return null;
}
