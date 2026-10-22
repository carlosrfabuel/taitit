type ErrorLike =
  { code?: string; message?: string; name?: string; statusCode?: string | number } | null | undefined;

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  email_not_confirmed: 'Confirm your email before signing in.',
  over_request_rate_limit: 'Too many attempts. Wait a moment and try again.',
  user_banned: 'This account is blocked.',
};

/** User-facing message for a Supabase Auth error. */
export function authMessage(error: ErrorLike): string {
  if (error?.code && AUTH_MESSAGES[error.code]) return AUTH_MESSAGES[error.code]!;
  if (isNetworkError(error)) return 'Could not connect. Check your connection.';
  return 'Could not sign in. Please try again.';
}

/** Codes returned by the database publishing check (publish_rules migration). */
export const PUBLISH_PROBLEM_LABEL: Record<string, string> = {
  no_base_image: 'The base image is missing.',
  base_size_unknown: 'Upload the base image again (its size is unknown).',
  no_zones: 'Add at least one zone.',
  zone_without_layer: 'Some zones have no layer.',
  layer_size_mismatch: 'A layer is not the same size as the base image.',
  pattern_size_mismatch: 'A tortoiseshell pattern is not the same size as the base image.',
  zone_without_default_color: 'Some zones have no default color.',
  default_color_inactive: 'Some zones have a deactivated default color.',
};

export const problemLabel = (code: string) => PUBLISH_PROBLEM_LABEL[code] ?? code;

/** Problem codes inside a "Model cannot be published: a, b" error from the database, or null. */
export function publishProblemsIn(error: ErrorLike): string[] | null {
  const m = error?.message?.match(/Model cannot be published: (.+)$/);
  return m ? m[1]!.split(',').map((c) => c.trim()) : null;
}

/** User-facing message for a database (PostgREST) or Storage error. */
export function dbMessage(error: ErrorLike): string {
  const message = error?.message ?? '';
  const problems = publishProblemsIn(error);
  if (problems)
    return `A published model cannot be left incomplete: ${problems.map(problemLabel).join(' ')} Unpublish it first or fix it.`;
  if (error?.code === '23505' && message.includes('swatches_ref_key'))
    return 'A color of this material with this reference already exists.';
  if (message.includes('own_account')) return 'You cannot change the status of your own account.';
  if (message.includes('account_not_found')) return 'This account no longer exists.';
  if (message.includes('admin_account')) return 'Admin accounts cannot be deleted from here.';
  if (error?.code === '23505' && message.includes('model_zones_one_role'))
    return 'This model already has a zone with that role.';
  if (message.includes('model_zones_role_material'))
    return 'The main metal must be metal and the tips must be acetate.';
  if (error?.code === '23505' && message.includes('model_zones_unique_name'))
    return 'This model already has a zone with that name.';
  if (error?.code === '23505') return 'A model with that name already exists.';
  if (message.includes('at most 4 customizable zones')) return 'A model can have at most 4 zones.';
  if (message.includes('Default swatch material must match'))
    return 'The default color must be of the same material as the zone.';
  if (message.includes('swatch_material_in_use'))
    return 'This color is the default color of a zone: its material cannot be changed.';
  if (error?.code === '23514' && message.includes('models_published_needs_image'))
    return 'To publish, the model needs the base image.';
  if (error?.code === '23514') return 'A field is not valid or is too long.';
  if (error?.code === '42501' || /row-level security|unauthorized/i.test(message))
    return 'You do not have permission for this action.';
  if (error?.code === 'not_found') return 'It no longer exists: it may have been deleted.';
  if (/payload too large|maximum allowed size|exceeded/i.test(message)) return 'The file is too large.';
  if (/mime type|invalid_mime/i.test(message)) return 'File format not allowed.';
  if (isNetworkError(error)) return 'Could not connect. Check your connection.';
  return 'Could not save. Please try again.';
}

/** User-facing message for an error while loading or downloading (not saving). */
export function readMessage(error: ErrorLike): string {
  if (isNetworkError(error)) return 'Could not connect. Check your connection.';
  if (/not found|object not found/i.test(error?.message ?? ''))
    return 'It no longer exists: it may have been deleted.';
  return 'Could not load. Please try again.';
}

function isNetworkError(error: ErrorLike) {
  const text = `${error?.name ?? ''} ${error?.message ?? ''}`;
  return /fetch|network|AuthRetryableFetchError/i.test(text);
}
