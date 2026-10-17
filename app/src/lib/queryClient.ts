import { AppState } from 'react-native';
import { QueryClient, focusManager } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 2 } },
});

// "Window focus" on a phone = the app coming back to the foreground: stale data refreshes then.
AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
