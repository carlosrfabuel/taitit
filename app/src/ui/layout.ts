import { Platform, useWindowDimensions } from 'react-native';
import { tokens } from '@taitit/shared';

// The web version on a computer (Carlos, 2026-10-28: computers only, Chrome and Safari). There the app
// is a centered page, and screens lay out for that page; phones never take this path.

/** From this window width the web shows the desktop layouts. */
export const DESKTOP_MIN_WIDTH = 1024;
/** The page on a computer: centered, at most this wide. */
export const PAGE_MAX_WIDTH = 1200;
/** Forms and lists (sign in, cart, orders, account) on a computer: centered, at most this wide. */
export const READING_WIDTH = 760;

const isDesktop = (width: number) => Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH;

/** True on the web on a computer-sized window. */
export function useDesktop(): boolean {
  return isDesktop(useWindowDimensions().width);
}

/** The width a screen lays out in: the window on phones, the centered page on a computer. */
export function usePageWidth(): number {
  const { width } = useWindowDimensions();
  return isDesktop(width) ? Math.min(width, PAGE_MAX_WIDTH) : width;
}

/** The width of a form or list column: the window on phones, the reading width on a computer. */
export function useReadingWidth(): number {
  const { width } = useWindowDimensions();
  return isDesktop(width) ? Math.min(width, READING_WIDTH) : width;
}

/** A list's or form's content on a computer: the reading width, centered. */
export const readingColumn = { width: '100%', maxWidth: READING_WIDTH, alignSelf: 'center' } as const;

/**
 * A footer's buttons on a computer: as wide as the content above them (the reading column less the
 * content's own side padding), centered.
 */
export const readingFooter = {
  width: '100%',
  maxWidth: READING_WIDTH - tokens.spacing.xl * 2,
  alignSelf: 'center',
} as const;

/**
 * Web: text inputs without the browser's focus ring (the field's own border shows the focus). The
 * ring's style must be off too: a width of 0 alone leaves Chrome's ring in place.
 */
export const webNoOutline =
  Platform.OS === 'web'
    ? ({ outlineWidth: 0, outlineStyle: 'none' } as unknown as Record<string, never>)
    : {};
