import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { useAuth } from '@/auth/AuthProvider';
import { parseSelection, selectionKey, type Selection } from '@/designs/designs';
import { QUANTITY_MAX } from './orders';

// The order being put together (Carlos, 2026-10-26: several different frames in one order). Each
// frame is a model with its colors and a quantity; "Add to cart" in the customizer adds one (the same
// model in the same colors adds 1 to that frame instead), the order screen sends them all at once and
// can reopen a frame in the customizer to change its colors. Kept on the phone per account, so it
// survives closing the app.

export type CartLine = { id: string; modelId: string; selection: Selection; quantity: number };

/** Frames in one order (database limit). */
export const CART_MAX = 50;

/** What "Add to cart" did: a new frame, one more of a frame already there, or nothing (a limit). */
export type AddResult = 'added' | 'more' | 'too_many_frames' | 'too_many_of_one';

const sameFrame = (a: { modelId: string; selection: Selection }, modelId: string, key: string) =>
  a.modelId === modelId && selectionKey(a.selection) === key;

type CartValue = {
  lines: CartLine[];
  /** Frames in total (quantities added up). */
  frames: number;
  add: (modelId: string, selection: Selection) => AddResult;
  /** New colors for a frame; if that makes it the same as another frame, the two become one. */
  update: (id: string, selection: Selection) => 'updated' | 'merged';
  setQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  /** Empties the order (after sending it). */
  clear: () => void;
};

const CartContext = createContext<CartValue | null>(null);

const storageKey = (userId: string) => `taitit.cart.${userId}`;

function parseLines(raw: string | null): CartLine[] {
  try {
    const value: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (l): l is CartLine =>
          !!l && typeof l.id === 'string' && typeof l.modelId === 'string' && Number.isInteger(l.quantity),
      )
      .slice(0, CART_MAX)
      .map((l) => ({
        id: l.id,
        modelId: l.modelId,
        selection: parseSelection(l.selection),
        quantity: Math.min(QUANTITY_MAX, Math.max(1, l.quantity)),
      }));
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const userId = useAuth().session?.user.id ?? null;
  // The lines and whose they are: another account (or none) never sees them.
  const [state, setState] = useState<{ userId: string | null; lines: CartLine[] }>({
    userId: null,
    lines: [],
  });

  // Whose saved frames are loaded, and changes made before that (applied on top once loaded): a change
  // made while the saved frames are still loading must never replace them with a shorter list.
  const loadedFor = useRef<string | null>(null);
  const pending = useRef<((lines: CartLine[]) => CartLine[])[]>([]);

  useEffect(() => {
    let alive = true;
    loadedFor.current = null;
    pending.current = [];
    // Signed out: `lines` below already hides the previous account's frames.
    if (!userId) return;
    const loaded = (saved: CartLine[]) => {
      if (!alive) return;
      const waiting = pending.current;
      pending.current = [];
      const lines = waiting.reduce((ls, next) => next(ls), saved);
      if (waiting.length) AsyncStorage.setItem(storageKey(userId), JSON.stringify(lines)).catch(() => {});
      loadedFor.current = userId;
      setState({ userId, lines });
    };
    AsyncStorage.getItem(storageKey(userId)).then(
      (raw) => loaded(parseLines(raw)),
      () => loaded([]),
    );
    return () => {
      alive = false;
    };
  }, [userId]);

  const lines = useMemo(() => (state.userId === userId ? state.lines : []), [state, userId]);

  const change = useCallback(
    (next: (lines: CartLine[]) => CartLine[]) => {
      if (!userId) return;
      if (loadedFor.current !== userId) {
        pending.current.push(next);
        return;
      }
      setState((s) => {
        const updated = next(s.userId === userId ? s.lines : []);
        AsyncStorage.setItem(storageKey(userId), JSON.stringify(updated)).catch(() => {});
        return { userId, lines: updated };
      });
    },
    [userId],
  );

  const add = useCallback(
    (modelId: string, selection: Selection): AddResult => {
      const key = selectionKey(selection);
      const same = lines.find((l) => sameFrame(l, modelId, key));
      if (same?.quantity === QUANTITY_MAX) return 'too_many_of_one';
      if (!same && lines.length >= CART_MAX) return 'too_many_frames';
      // Decided again on the latest lines: a second tap before the re-render joins the first frame.
      change((ls) => {
        const now = ls.find((l) => sameFrame(l, modelId, key));
        if (now)
          return ls.map((l) =>
            l.id === now.id ? { ...l, quantity: Math.min(QUANTITY_MAX, l.quantity + 1) } : l,
          );
        if (ls.length >= CART_MAX) return ls;
        return [...ls, { id: randomUUID(), modelId, selection, quantity: 1 }];
      });
      return same ? 'more' : 'added';
    },
    [change, lines],
  );
  const update = useCallback(
    (id: string, selection: Selection) => {
      const line = lines.find((l) => l.id === id);
      const key = selectionKey(selection);
      const same = line && lines.find((l) => l.id !== id && sameFrame(l, line.modelId, key));
      if (same) {
        // Kept where the other frame is; quantities added up (within the limit per frame).
        change((ls) =>
          ls
            .filter((l) => l.id !== id)
            .map((l) =>
              l.id === same.id ? { ...l, quantity: Math.min(QUANTITY_MAX, l.quantity + line.quantity) } : l,
            ),
        );
        return 'merged';
      }
      change((ls) => ls.map((l) => (l.id === id ? { ...l, selection } : l)));
      return 'updated';
    },
    [change, lines],
  );
  const setQuantity = useCallback(
    (id: string, quantity: number) =>
      change((ls) =>
        ls.map((l) => (l.id === id ? { ...l, quantity: Math.min(QUANTITY_MAX, Math.max(1, quantity)) } : l)),
      ),
    [change],
  );
  const remove = useCallback((id: string) => change((ls) => ls.filter((l) => l.id !== id)), [change]);
  const clear = useCallback(() => change(() => []), [change]);

  const value = useMemo(
    () => ({
      lines,
      frames: lines.reduce((n, l) => n + l.quantity, 0),
      add,
      update,
      setQuantity,
      remove,
      clear,
    }),
    [lines, add, update, setQuantity, remove, clear],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside CartProvider');
  return value;
}
