import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/features/auth/stores/auth-store';

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallback,
});

/**
 * Receives the Sanctum token from Laravel's Google OAuth callback.
 *
 * The backend redirects to /auth/callback#token=<token>. We use a hash fragment
 * (not a query string) so the token never leaves the browser — it's not sent in
 * subsequent requests and won't show up in server access logs.
 */
function AuthCallback() {
  const navigate = useNavigate();
  const loginWithToken = useAuthStore((s) => s.loginWithToken);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      // Hash is "#token=..."; some browsers strip the leading "#".
      const hash = window.location.hash.replace(/^#/, '');
      const params = new URLSearchParams(hash);
      const token = params.get('token');

      // Also surface any ?error=... the backend may have appended on the path.
      const searchParams = new URLSearchParams(window.location.search);
      const backendError = searchParams.get('error');

      if (backendError) {
        setError(`Google login failed: ${backendError}`);
        return;
      }
      if (!token) {
        setError('No token received from Google sign-in.');
        return;
      }

      try {
        await loginWithToken(token);
        // Clear the token from the URL bar before navigating onward.
        window.history.replaceState({}, '', '/auth/callback');
        navigate({ to: '/projects' });
      } catch {
        setError('Failed to complete sign-in. Please try again.');
      }
    };

    run();
  }, [loginWithToken, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
        {error ? (
          <>
            <h1 className="text-lg font-semibold text-red-400">Sign-in problem</h1>
            <p className="mt-2 text-sm text-zinc-400">{error}</p>
            <button
              type="button"
              onClick={() => navigate({ to: '/login' })}
              className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Back to login
            </button>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-white">Signing you in…</h1>
            <p className="mt-2 text-sm text-zinc-400">Just a moment.</p>
          </>
        )}
      </div>
    </div>
  );
}
