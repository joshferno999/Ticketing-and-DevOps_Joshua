import { ForbiddenError } from "../../lib/errors";

type AsanaApiError = Error & {
  status?: number;
  response?: {
    text?: string;
    body?: { errors?: Array<{ error?: string }> };
  };
};

export function isAsanaWriteAccessFailure(error: unknown): boolean {
  const asanaError = error as AsanaApiError;
  if (asanaError?.status !== 403) {
    return false;
  }

  const bodyErrors = asanaError.response?.body?.errors;
  if (Array.isArray(bodyErrors) && bodyErrors.some((entry) => entry.error === "write_access_failure")) {
    return true;
  }

  const responseText = asanaError.response?.text;
  if (typeof responseText === "string" && responseText.includes("write_access_failure")) {
    return true;
  }

  return false;
}

export function toAsanaTaskWriteForbiddenError(): ForbiddenError {
  return new ForbiddenError(
    "Your Asana account cannot edit this task. Complete it in Asana with an account that has edit access, or ask the teammate who imported this board to move the card."
  );
}
