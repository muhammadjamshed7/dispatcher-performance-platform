export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; details?: unknown };

export class ApiClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

function getLoginPathFromWindowPath(pathname: string): string {
  if (pathname.startsWith("/admin")) {
    return "/admin/login?expired=1";
  }

  if (pathname.startsWith("/team-lead")) {
    return "/team-lead/login?expired=1";
  }

  if (pathname.startsWith("/dispatcher")) {
    return "/dispatcher/login?expired=1";
  }

  return "/session-expired";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shouldRetryOnUnauthorized(path: string): boolean {
  return (
    !path.startsWith("/api/auth/login") &&
    !path.startsWith("/api/auth/logout") &&
    !path.startsWith("/api/auth/me") &&
    !path.startsWith("/api/public/")
  );
}

async function hasActiveSession(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/me", {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return false;
    }

    const payload = (await response.json()) as ApiResponse<unknown>;
    return payload.ok && payload.data != null;
  } catch {
    return false;
  }
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiClientError(
      response.ok ? "Unexpected response from server." : "Request failed.",
      response.status,
    );
  }

  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.ok) {
    throw new ApiClientError(
      payload.ok ? "Request failed." : payload.error,
      response.status,
    );
  }

  return payload.data;
}

function redirectToLogin(): never {
  window.location.assign(getLoginPathFromWindowPath(window.location.pathname));
  throw new ApiClientError("Session expired. Redirecting to sign in.", 401);
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const retryDelaysMs = [0, 300, 800];
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt < retryDelaysMs.length; attempt++) {
    if (attempt > 0) {
      await sleep(retryDelaysMs[attempt]);
    }

    const response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      credentials: "include",
    });

    lastResponse = response;

    if (response.status !== 401) {
      return parseApiResponse<T>(response);
    }

    if (!shouldRetryOnUnauthorized(path)) {
      return parseApiResponse<T>(response);
    }

    const sessionAlive = await hasActiveSession();
    if (!sessionAlive) {
      if (typeof window !== "undefined") {
        redirectToLogin();
      }

      return parseApiResponse<T>(response);
    }
  }

  if (
    lastResponse?.status === 401 &&
    typeof window !== "undefined" &&
    shouldRetryOnUnauthorized(path)
  ) {
    const sessionAlive = await hasActiveSession();
    if (!sessionAlive) {
      redirectToLogin();
    }
  }

  if (!lastResponse) {
    throw new ApiClientError("Request failed.", 0);
  }

  return parseApiResponse<T>(lastResponse);
}
