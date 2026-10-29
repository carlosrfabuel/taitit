// Web: browsers have no secure enclave like SecureStore, so the session is kept in localStorage,
// which is what Supabase does by default in a browser. Same interface as secureSessionStorage.ts.

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    return window.localStorage.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    window.localStorage.setItem(key, value);
  },

  async removeItem(key: string): Promise<void> {
    window.localStorage.removeItem(key);
  },
};
