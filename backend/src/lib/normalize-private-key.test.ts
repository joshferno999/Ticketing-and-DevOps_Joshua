import { describe, expect, it } from "vitest";
import { normalizePrivateKey } from "./normalize-private-key.js";

const PEM = `-----BEGIN RSA PRIVATE KEY-----
line2
-----END RSA PRIVATE KEY-----`;

describe("normalizePrivateKey", () => {
  it("accepts multiline PEM", () => {
    expect(normalizePrivateKey(PEM)).toBe(PEM);
  });

  it("expands literal \\n escapes", () => {
    const oneLine = "-----BEGIN RSA PRIVATE KEY-----\\nline2\\n-----END RSA PRIVATE KEY-----";
    expect(normalizePrivateKey(oneLine)).toBe(PEM);
  });

  it("rejects truncated keys", () => {
    expect(() => normalizePrivateKey("-----BEGIN RSA PRIVATE KEY-----")).toThrow(/truncated/i);
  });
});
