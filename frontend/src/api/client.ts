export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<TResponse>(
  path: string,
  init?: RequestInit,
): Promise<TResponse> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  // 204 No Content — return undefined
  if (response.status === 204) {
    return undefined as unknown as TResponse;
  }

  const text = await response.text();
  const json = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const code = json?.error ?? "unknown_error";
    const message = json?.message ?? response.statusText;
    throw new ApiError(response.status, code, message);
  }

  return json as TResponse;
}
