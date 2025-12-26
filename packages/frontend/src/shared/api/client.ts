/**
 * Centralized API Client
 *
 * Provides a type-safe, consistent interface for all API calls with:
 * - Automatic error handling
 * - Query parameter serialization
 */

// Re-export ApiError for convenience
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /**
   * Check if this is a client error (4xx)
   */
  isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /**
   * Check if this is a server error (5xx)
   */
  isServerError(): boolean {
    return this.status >= 500;
  }

  /**
   * Check if this is a not found error (404)
   */
  isNotFound(): boolean {
    return this.status === 404;
  }
}

interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
}

class ApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout ?? 30000;
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(
    path: string,
    params: Record<string, string | number | boolean | undefined> | null
  ): string {
    // Handle SSR where window is not available
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const url = new URL(`${this.baseUrl}${path}`, origin);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * Execute a request
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    path: string,
    params: Record<string, string | number | boolean | undefined> | null,
    body: unknown
  ): Promise<T> {
    const url = this.buildUrl(path, params);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.timeout);

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      };

      if (body !== null) {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);

      clearTimeout(timeoutId);

      if (!response.ok) {
        const data: unknown = await response.json().catch(() => undefined);
        throw new ApiError(
          `API request failed: ${String(response.status)} ${response.statusText}`,
          response.status,
          data
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        throw error;
      }

      // Handle abort/timeout
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError(`Request timeout after ${String(this.timeout)}ms`, 408);
      }

      // Handle network errors
      throw new ApiError(error instanceof Error ? error.message : 'Network error', 0);
    }
  }

  /**
   * GET request
   */
  async get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    return this.request<T>('GET', path, params ?? null, null);
  }

  /**
   * POST request
   */
  async post<T>(
    path: string,
    body?: unknown,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    return this.request<T>('POST', path, params ?? null, body ?? null);
  }

  /**
   * PUT request
   */
  async put<T>(
    path: string,
    body?: unknown,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    return this.request<T>('PUT', path, params ?? null, body ?? null);
  }

  /**
   * DELETE request
   */
  async delete<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    return this.request<T>('DELETE', path, params ?? null, null);
  }

  /**
   * PATCH request
   */
  async patch<T>(
    path: string,
    body?: unknown,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    return this.request<T>('PATCH', path, params ?? null, body ?? null);
  }
}

// Create and export the default API client instance
export const api = new ApiClient({
  baseUrl: '/api',
  timeout: 30000,
});

// Export the class for custom instances
export { ApiClient };
