import { router, useNavigation } from 'expo-router';
import { useCallback } from 'react';

/**
 * Leaves the sign-in / sign-up modal as a whole (whatever screens were opened inside it, e.g.
 * "Create account" → "Go to sign in"), back to where it was opened from; or the catalog when it was
 * opened directly (e.g. from a link).
 */
export function useCloseAuth() {
  const navigation = useNavigation();
  return useCallback(() => {
    // The auth screens are their own stack inside the root stack: going back in the parent closes
    // the whole modal, not just the last auth screen.
    // Opened directly (nothing under the modal): go to the catalog. (router.canGoBack() would also
    // count the screens inside the modal and only step back to the previous auth screen.)
    const parent = navigation.getParent();
    if (parent?.canGoBack()) parent.goBack();
    else router.replace('/');
  }, [navigation]);
}
