/** Normalize PEM private keys from .env, Secrets Manager JSON, or literal \\n escapes. */
export function normalizePrivateKey(raw: string): string {
  const trimmed = raw.trim().replace(/^["']|["']$/g, "");
  const withNewlines = trimmed.includes("\\n") ? trimmed.replace(/\\n/g, "\n") : trimmed;

  if (
    withNewlines.includes("BEGIN") &&
    (withNewlines.includes("END RSA PRIVATE KEY") || withNewlines.includes("END PRIVATE KEY"))
  ) {
    return withNewlines;
  }

  throw new Error(
    "GITHUB_APP_PRIVATE_KEY is invalid or truncated. Store the full PEM in Secrets Manager (multi-line or with \\n between lines)."
  );
}
