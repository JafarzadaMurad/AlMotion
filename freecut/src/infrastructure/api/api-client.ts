// Relative URL goes through Vite's dev-server proxy (vite.config.ts forwards
// `/api/v1/*` → backend `/api/*`). Using a relative base means the request is
// issued against the same origin as the page, so we don't depend on the user's
// machine being able to reach the backend port directly (VSCode only forwards
// the frontend port, not the backend port).
const API_BASE_URL = '/api/v1';

interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

export class ApiClient {
  private static getToken(): string | null {
    try {
      const stored = localStorage.getItem('auth-storage');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.state?.token ?? null;
      }
    } catch {
      // ignore parse errors
    }
    return null;
  }

  static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });

    if (response.status === 401) {
      // Token expired or invalid — clear auth state
      localStorage.removeItem('auth-storage');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        message: `HTTP ${response.status}`,
      }));
      throw error;
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  static get<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  static post<T>(endpoint: string, data?: unknown) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  static put<T>(endpoint: string, data?: unknown) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  static delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  static async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    const token = this.getToken();

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        message: `HTTP ${response.status}`,
      }));
      throw error;
    }

    return response.json();
  }
}
