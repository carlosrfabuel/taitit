import { useEffect } from 'react';

/**
 * The panel is in Spanish (`<html lang="es">`); the public pages for app users are in English. Marks
 * the page as English while it is open, so browsers don't offer to translate it from Spanish.
 */
export function useDocumentLang(lang: string) {
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [lang]);
}
