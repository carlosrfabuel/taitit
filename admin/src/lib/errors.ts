type ErrorLike =
  { code?: string; message?: string; name?: string; statusCode?: string | number } | null | undefined;

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

/** Codes returned by the database publishing check (publish_rules migration). */
export const PUBLISH_PROBLEM_LABEL: Record<string, string> = {
  no_base_image: 'Falta la imagen base.',
  base_size_unknown: 'Vuelve a subir la imagen base (no se conoce su tamaño).',
  no_zones: 'Añade al menos una zona.',
  zone_without_layer: 'Hay zonas sin capa.',
  layer_size_mismatch: 'Alguna capa no mide lo mismo que la imagen base.',
  zone_without_default_color: 'Hay zonas sin color por defecto.',
};

export const problemLabel = (code: string) => PUBLISH_PROBLEM_LABEL[code] ?? code;

/** Problem codes inside a "Model cannot be published: a, b" error from the database, or null. */
export function publishProblemsIn(error: ErrorLike): string[] | null {
  const m = error?.message?.match(/Model cannot be published: (.+)$/);
  return m ? m[1]!.split(',').map((c) => c.trim()) : null;
}

/** Spanish message for a database (PostgREST) or Storage error. */
export function dbMessage(error: ErrorLike): string {
  const message = error?.message ?? '';
  const problems = publishProblemsIn(error);
  if (problems)
    return `El modelo publicado no puede quedar incompleto: ${problems.map(problemLabel).join(' ')} Despublícalo primero o corrígelo.`;
  if (error?.code === '23505' && message.includes('model_zones_unique_name'))
    return 'Ya hay una zona con ese nombre en este modelo.';
  if (error?.code === '23505') return 'Ya existe un modelo con ese nombre.';
  if (message.includes('at most 4 customizable zones')) return 'Un modelo puede tener como máximo 4 zonas.';
  if (message.includes('Default swatch material must match'))
    return 'El color por defecto debe ser del mismo material que la zona.';
  if (error?.code === '23514' && message.includes('models_published_needs_image'))
    return 'Para publicar, el modelo necesita la imagen base.';
  if (error?.code === '23514') return 'Algún campo no es válido o es demasiado largo.';
  if (error?.code === '42501' || /row-level security|unauthorized/i.test(message))
    return 'No tienes permiso para esta acción.';
  if (error?.code === 'not_found') return 'Ya no existe: puede que se haya eliminado.';
  if (/payload too large|maximum allowed size|exceeded/i.test(message))
    return 'El archivo es demasiado grande.';
  if (/mime type|invalid_mime/i.test(message)) return 'Formato de archivo no permitido.';
  if (isNetworkError(error)) return 'No se pudo conectar. Revisa tu conexión.';
  return 'No se pudo guardar. Inténtalo de nuevo.';
}

function isNetworkError(error: ErrorLike) {
  const text = `${error?.name ?? ''} ${error?.message ?? ''}`;
  return /fetch|network|AuthRetryableFetchError/i.test(text);
}
