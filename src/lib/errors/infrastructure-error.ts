function readStringProperty(
  value: Record<string, unknown>,
  key: string,
): string {
  const property = value[key];
  return typeof property === "string" ? property : "";
}

function hasInfrastructureMessage(message: string): boolean {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("fetch failed") ||
    normalized.includes("connect econnrefused") ||
    normalized.includes("can't reach database") ||
    normalized.includes("database not reachable") ||
    normalized.includes("connection terminated") ||
    normalized.includes("password authentication failed") ||
    normalized.includes("getaddrinfo") ||
    normalized.includes("self-signed certificate") ||
    normalized.includes("timeout expired") ||
    normalized.includes("timeout exceeded when trying to connect") ||
    normalized.includes("connect timeout error") ||
    normalized.includes("session refresh timeout") ||
    normalized.includes("failed to connect") ||
    normalized.includes("network error")
  );
}

function hasInfrastructureCode(code: string): boolean {
  return (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "PGRST301" ||
    code === "PGRST000"
  );
}

export function isInfrastructureError(error: unknown): boolean {
  if (error instanceof AggregateError) {
    return error.errors.some((nested) => isInfrastructureError(nested));
  }

  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as Record<string, unknown>;
  const code = readStringProperty(record, "code");

  if (hasInfrastructureCode(code)) {
    return true;
  }

  const searchableMessage = [
    readStringProperty(record, "name"),
    readStringProperty(record, "message"),
    readStringProperty(record, "details"),
    readStringProperty(record, "hint"),
  ].join("\n");

  if (hasInfrastructureMessage(searchableMessage)) {
    return true;
  }

  if ("cause" in record && isInfrastructureError(record.cause)) {
    return true;
  }

  if (Array.isArray(record.errors)) {
    return record.errors.some((nested) => isInfrastructureError(nested));
  }

  return false;
}
