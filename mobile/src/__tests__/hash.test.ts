import { computeSyncHash } from "@/utils/hash";
import * as Crypto from "expo-crypto";

describe("computeSyncHash", () => {
  it("calls digestStringAsync with SHA256 and concatenated input", async () => {
    await computeSyncHash("My Title", "My Content");

    expect(Crypto.digestStringAsync).toHaveBeenCalledWith(
      Crypto.CryptoDigestAlgorithm.SHA256,
      "My TitleMy Content"
    );
  });

  it("returns the hash string", async () => {
    const result = await computeSyncHash("Title", "Content");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("produces different hashes for different inputs", async () => {
    const hash1 = await computeSyncHash("A", "B");
    const hash2 = await computeSyncHash("C", "D");
    expect(hash1).not.toBe(hash2);
  });
});
