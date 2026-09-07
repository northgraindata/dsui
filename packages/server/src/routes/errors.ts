/** Shared HTTP error mapping: unknown → 404, invalid → 422, else 400. */
export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Request could not be completed";
}

export function httpStatus(error: unknown): 400 | 404 | 422 {
  const message = errorMessage(error);
  return message.startsWith("Unknown") ||
    message.startsWith("Service not found")
    ? 404
    : message.includes("Invalid") || message.includes("required")
      ? 422
      : 400;
}
