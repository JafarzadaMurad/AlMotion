import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ApiClient } from '@/infrastructure/api/api-client';
import type {
  User,
  AuthResponse,
  LoginCredentials,
  RegisterCredentials,
} from '../types/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  /** Adopt an externally minted Sanctum token (e.g. from Google OAuth callback). */
  loginWithToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  clearError: () => void;
  isAuthenticated: () => boolean;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const response = await ApiClient.post<AuthResponse>(
            '/auth/login',
            credentials
          );
          set({
            user: response.user,
            token: response.token,
            isLoading: false,
          });
        } catch (err: unknown) {
          const message =
            (err as { message?: string })?.message ?? 'Login failed';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      register: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const response = await ApiClient.post<AuthResponse>(
            '/auth/register',
            credentials
          );
          set({
            user: response.user,
            token: response.token,
            isLoading: false,
          });
        } catch (err: unknown) {
          const message =
            (err as { message?: string })?.message ?? 'Registration failed';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      logout: async () => {
        try {
          await ApiClient.post('/auth/logout');
        } catch {
          // ignore errors on logout
        }
        set({ user: null, token: null, error: null });
      },

      fetchMe: async () => {
        if (!get().token) return;
        set({ isLoading: true });
        try {
          const user = await ApiClient.get<User>('/auth/me');
          set({ user, isLoading: false });
        } catch {
          set({ user: null, token: null, isLoading: false });
        }
      },

      loginWithToken: async (token) => {
        // Persist the token first so ApiClient.getToken() picks it up for /auth/me.
        set({ token, isLoading: true, error: null });
        try {
          const user = await ApiClient.get<User>('/auth/me');
          set({ user, isLoading: false });
        } catch (err: unknown) {
          set({ user: null, token: null, isLoading: false, error: (err as { message?: string })?.message ?? 'Failed to load profile' });
          throw err;
        }
      },

      clearError: () => set({ error: null }),

      isAuthenticated: () => !!get().token && !!get().user,

      isAdmin: () => !!get().user?.is_admin,
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
      }),
    }
  )
);
