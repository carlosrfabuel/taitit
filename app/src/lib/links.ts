import * as WebBrowser from 'expo-web-browser';

/** TAITIT's privacy policy (public page on the admin site; also given to the app stores). */
export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL || 'https://taitit-admin.vercel.app/privacy';

/** How to delete an account (public page on the admin site; also given to Google Play). */
export const ACCOUNT_DELETION_URL =
  process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL || 'https://taitit-admin.vercel.app/account-deletion';

/** TAITIT's support address (Carlos, 2026-10-20: the one given to the app stores). */
export const SUPPORT_EMAIL = 'admin@taititeyewear.com';

/** Opens the privacy policy in an in-app browser (the customer comes back with one tap). */
export const openPrivacyPolicy = () => void WebBrowser.openBrowserAsync(PRIVACY_URL);
