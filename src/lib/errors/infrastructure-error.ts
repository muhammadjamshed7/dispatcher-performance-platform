export function isInfrastructureError(error: unknown): boolean {
  if (error instanceof AggregateError) {
    return error.errors.some((nested) => isInfrastructureError(nested));
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const code = "code" in error ? String(error.code) : "";

  return (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "PGRST301" ||
    code === "PGRST000" ||
    message.includes("fetch failed") ||
    message.includes("connect econnrefused") ||
    message.includes("can't reach database") ||
    message.includes("database not reachable") ||
    message.includes("connection terminated") ||
    message.includes("password authentication failed") ||
    message.includes("getaddrinfo") ||
    message.includes("self-signed certificate") ||
    message.includes("timeout expired") ||
    message.includes("timeout exceeded when trying to connect") ||
    message.includes("connect timeout error") ||
    message.includes("session refresh timeout") ||
    message.includes("failed to connect") ||
    message.includes("network error")
  );
}
