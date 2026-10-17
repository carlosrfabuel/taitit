import { CryptoDigestAlgorithm, digest } from 'expo-crypto';

// Supabase Auth hashes the PKCE code verifier with crypto.subtle.digest('SHA-256'). React Native has
// no WebCrypto, so without this it falls back to the weaker "plain" method (and logs a warning).
// Only digest is provided: it is all supabase-js needs. getRandomValues comes from
// react-native-get-random-values.
type SubtleDigest = { digest: (algorithm: AlgorithmIdentifier, data: BufferSource) => Promise<ArrayBuffer> };
const g = globalThis as unknown as { crypto?: { subtle?: SubtleDigest } };

if (!g.crypto?.subtle) {
  g.crypto ??= {};
  g.crypto.subtle = {
    digest(algorithm, data) {
      const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
      if (name.toUpperCase() !== 'SHA-256') {
        return Promise.reject(new Error(`crypto.subtle.digest: only SHA-256 is available (got ${name})`));
      }
      return digest(CryptoDigestAlgorithm.SHA256, data);
    },
  };
}
