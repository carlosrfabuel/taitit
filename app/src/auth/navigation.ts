import { router } from 'expo-router';

// Leaves the auth modal, or goes to the catalog if it was opened directly (e.g. from a link).
export function closeAuth() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
