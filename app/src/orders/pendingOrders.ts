import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

// One order key per content (same user, model and lines) until that order succeeds, kept on the
// phone. A confirmation whose answer was lost (timeout, app closed) is retried with the same key,
// even from a new summary screen or after a restart, so the server returns the order already
// placed instead of creating a second one. Changed content gets a new key, a new image and a new
// order. After a success the entry is removed: ordering the same design again is a new order.

const STORAGE_KEY = 'taitit.pendingOrders';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

type Entry = { key: string; at: number };
type Store = Record<string, Entry>;

let memory: Store | null = null;
let loading: Promise<Store> | null = null; // one read of the phone's storage, shared by all callers

function load(): Promise<Store> {
  if (memory) return Promise.resolve(memory);
  loading ??= (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      memory = raw ? (JSON.parse(raw) as Store) : {};
    } catch {
      memory = {}; // storage unavailable: still safe within this run of the app
    }
    return memory;
  })();
  return loading;
}

async function save(store: Store) {
  memory = store;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // keeps working from memory
  }
}

/** The key to place this content with: the pending one if any, otherwise a new one (remembered). */
export async function orderKeyFor(content: string, now = Date.now()): Promise<string> {
  const store = await load();
  const fresh: Store = {};
  for (const [k, e] of Object.entries(store)) if (now - e.at < MAX_AGE) fresh[k] = e;
  const existing = fresh[content];
  if (existing) return existing.key;
  const key = randomUUID();
  fresh[content] = { key, at: now };
  await save(fresh);
  return key;
}

/** The order for this content went through: the next one is a new order. */
export async function orderPlaced(content: string): Promise<void> {
  const store = await load();
  if (!store[content]) return;
  const { [content]: _done, ...rest } = store;
  await save(rest);
}
