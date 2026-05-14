export interface User {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
  plan_id: number | null;
  plan: Plan | null;
  storage_used: number;
  tokens_used_this_month: number;
  tokens_reset_at: string | null;
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
}

export interface Plan {
  id: number;
  name: string;
  slug: string;
  max_projects: number;
  max_storage_mb: number;
  max_ai_tokens_monthly: number;
  price_monthly: string;
  is_default: boolean;
  features: Record<string, unknown> | null;
  users_count?: number;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}
