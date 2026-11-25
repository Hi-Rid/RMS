import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

describe("lib/crypto.ts", () => {
  it("encrypts and decrypts secrets symmetrically with random IVs", () => {
    const secret = "AIzaSyExampleKey1234567890_rmsTest";
    const encA = encryptSecret(secret);
    const encB = encryptSecret(secret);

    expect(encA).not.toBe(secret);
    expect(encB).not.toBe(secret);
    expect(encA).not.toBe(encB);
    expect(encA.split(".").length).toBe(3);

    expect(decryptSecret(encA)).toBe(secret);
    expect(decryptSecret(encB)).toBe(secret);
  });

  it("returns null on tampered ciphertext, tampered auth tag, or malformed payloads", () => {
    const enc = encryptSecret("top-secret-key-value");
    const [iv, tag, data] = enc.split(".");

    const dataBuf = Buffer.from(data, "base64url");
    dataBuf[0] ^= 0xff;
    const tamperedData = `${iv}.${tag}.${dataBuf.toString("base64url")}`;

    const tagBuf = Buffer.from(tag, "base64url");
    tagBuf[0] ^= 0xff;
    const tamperedTag = `${iv}.${tagBuf.toString("base64url")}.${data}`;

    expect(decryptSecret(tamperedData)).toBeNull();
    expect(decryptSecret(tamperedTag)).toBeNull();
    expect(decryptSecret(null)).toBeNull();
    expect(decryptSecret(undefined)).toBeNull();
    expect(decryptSecret("invalid-format")).toBeNull();
  });
});
