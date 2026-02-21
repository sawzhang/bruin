import * as Crypto from "expo-crypto";

/**
 * Compute SHA-256 hash of title + content for sync comparison.
 * Must match the Rust implementation: sha256(title_bytes + content_bytes) as lowercase hex.
 */
export async function computeSyncHash(
  title: string,
  content: string
): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    title + content
  );
}
