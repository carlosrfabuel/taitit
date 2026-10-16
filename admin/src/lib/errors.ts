type ErrorLike = { code?: string; message?: string; name?: string } | null | undefined;

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email o contraseña incorrectos.',
  email_not_confirmed: 'Confirma tu email antes de entrar.',
  over_request_rate_limit: 'Demasiados intentos. Espera un momento y vuelve a probar.',
  user_banned: 'Esta cuenta está bloqueada.',
};

/** Spanish message for a Supabase Auth error. */
export function authMessage(error: ErrorLike): string {
  if (error?.code && AUTH_MESSAGES[error.code]) return AUTH_MESSAGES[error.code]!;
  if (isNetworkError(error)) return 'No se pudo conectar. Revisa tu conexión.';
  return 'No se pudo iniciar sesión. Inténtalo de nuevo.';
}

/** Spanish message for a database (PostgREST) error. */
export function dbMessage(error: ErrorLike): string {
  const message = error?.message ?? '';
  if (error?.code === '23505') return 'Ya existe un modelo con ese nombre.';
  if (error?.code === '23514' && message.includes('models_published_needs_image'))
    return 'Para publicar, el modelo necesita la imagen base.';
  if (error?.code === '23514') return 'Algún campo no es válido o es demasiado largo.';
  if (error?.code === '42501') return 'No tienes permiso para esta acción.';
  if (isNetworkError(error)) return 'No se pudo conectar. Revisa tu conexión.';
  return 'No se pudo guardar. Inténtalo de nuevo.';
}

function isNetworkError(error: ErrorLike) {
  const text = `${error?.name ?? ''} ${error?.message ?? ''}`;
  return /fetch|network|AuthRetryableFetchError/i.test(text);
}
