import * as WebBrowser from 'expo-web-browser';

/** TAITIT's privacy policy (public page on the admin site; also given to the app stores). */
export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL || 'https://taitit-admin.vercel.app/privacy';

/** Opens the privacy policy in an in-app browser (the customer comes back with one tap). */
export const openPrivacyPolicy = () => void WebBrowser.openBrowserAsync(PRIVACY_URL);
