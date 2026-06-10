export class ForbiddenError extends Error {
  readonly statusCode = 403;

  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  readonly statusCode = 404;

  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class BadRequestError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

export function getErrorStatusCode(error: unknown): number | undefined {
  if (
    error instanceof ForbiddenError
    || error instanceof NotFoundError
    || error instanceof BadRequestError
  ) {
    return error.statusCode;
  }

  return undefined;
}

export function getErrorMessage(error: unknown, fallback = "Request failed") {
  return error instanceof Error ? error.message : fallback;
}
