import 'react-native-get-random-values';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import * as SecureStore from 'expo-secure-store';

// Supabase sessions can exceed SecureStore's ~2 KB value limit, so (as Supabase recommends)
// the session is AES-encrypted into AsyncStorage and only the 256-bit key lives in SecureStore.
//
// Each write uses a fresh key stored under a new id, and the AsyncStorage value records that id
// ("<keyId>:<ciphertext>"). The previous key is deleted only after the new value is saved, so a crash
// or two overlapping writes can never leave a value paired with the wrong key.

const randomHex = (bytes: number) => aesjs.utils.hex.fromBytes(crypto.getRandomValues(new Uint8Array(bytes)));
// SecureStore keys allow [A-Za-z0-9._-]; Supabase's storage key already fits.
const secureKeyName = (key: string, keyId: string) => `${key}.${keyId}`;
const parse = (stored: string) => {
  const sep = stored.indexOf(':');
  return sep > 0 ? { keyId: stored.slice(0, sep), cipherHex: stored.slice(sep + 1) } : null;
};

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const stored = await AsyncStorage.getItem(key);
    const parsed = stored ? parse(stored) : null;
    if (!parsed) return null;
    try {
      const keyHex = await SecureStore.getItemAsync(secureKeyName(key, parsed.keyId));
      if (!keyHex) return null;
      const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(keyHex), new aesjs.Counter(1));
      return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(parsed.cipherHex)));
    } catch {
      // Unreadable value: treat as signed out.
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    const previous = await AsyncStorage.getItem(key);
    const keyId = randomHex(8);
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const cipherHex = aesjs.utils.hex.fromBytes(cipher.encrypt(aesjs.utils.utf8.toBytes(value)));

    await SecureStore.setItemAsync(secureKeyName(key, keyId), aesjs.utils.hex.fromBytes(encryptionKey));
    await AsyncStorage.setItem(key, `${keyId}:${cipherHex}`);

    const old = previous ? parse(previous) : null;
    if (old && old.keyId !== keyId) await SecureStore.deleteItemAsync(secureKeyName(key, old.keyId));
  },

  async removeItem(key: string): Promise<void> {
    const stored = await AsyncStorage.getItem(key);
    await AsyncStorage.removeItem(key);
    const parsed = stored ? parse(stored) : null;
    if (parsed) await SecureStore.deleteItemAsync(secureKeyName(key, parsed.keyId));
  },
};
