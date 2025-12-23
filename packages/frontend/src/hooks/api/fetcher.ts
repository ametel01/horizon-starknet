/**
 * Shared API fetcher for indexer endpoints
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Type-safe fetch wrapper for API routes
 */
export async function apiFetch<T>(
  path: string,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  const url = new URL(path, window.location.origin);

  // Add query params
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    const data: unknown = await response.json().catch(() => undefined);
    throw new ApiError(`API request failed: ${response.statusText}`, response.status, data);
  }

  return response.json() as Promise<T>;
}
