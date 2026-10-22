import { useEffect } from 'react';

/**
 * Sets the page language while a page is open (the panel and the public pages are all English since
 * 2026-10-22; kept so a page can declare its language explicitly).
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
