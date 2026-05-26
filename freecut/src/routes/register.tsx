import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { ApiClient } from '@/infrastructure/api/api-client';
import { Check, Lock } from 'lucide-react';

export const Route = createFileRoute('/register')({
  component: RegisterPage,
});

interface PublicPlan {
  id: number;
  name: string;
  slug: string;
  price_monthly: string;
  trial_days: number | null;
  max_projects: number;
  max_storage_mb: number;
  max_ai_tokens_monthly: number;
  is_default: boolean;
  stripe_price_id: string | null;
}

function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');

  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  useEffect(() => {
    ApiClient.get<PublicPlan[]>('/plans/public')
      .then((data) => {
        setPlans(data);
        const defaultFree =
          data.find((p) => p.is_default && parseFloat(p.price_monthly) === 0) ??
          data.find((p) => parseFloat(p.price_monthly) === 0);
        if (defaultFree) setSelectedPlanId(defaultFree.id);
      })
      .finally(() => setPlansLoading(false));
  }, []);

  const isFree = (p: PublicPlan) => parseFloat(p.price_monthly) === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register({
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
        plan_id: selectedPlanId ?? undefined,
      });
      navigate({ to: '/projects' });
    } catch {
      // error is already set in store
    }
  };

  return (
    <div className="flex min-h-screen items-start justify-center bg-zinc-950 p-4 py-12">
      <div className="w-full max-w-5xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">alMotion</h1>
          <p className="mt-2 text-sm text-zinc-400">Create your account</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          {/* Plan selection — paid plans are visible but disabled; you upgrade
              after signup via /billing. */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-white">
              Choose your starting plan
            </h2>
            {plansLoading ? (
              <div className="text-sm text-zinc-400">Loading plans…</div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {plans.map((p) => {
                  const free = isFree(p);
                  const selected = selectedPlanId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => free && setSelectedPlanId(p.id)}
                      disabled={!free}
                      className={`relative rounded-xl border p-5 text-left transition ${
                        selected
                          ? 'border-blue-500 bg-blue-950/30 ring-1 ring-blue-500'
                          : free
                            ? 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                            : 'cursor-not-allowed border-zinc-800 bg-zinc-900/60 opacity-70'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <h3 className="text-lg font-semibold text-white">
                          {p.name}
                        </h3>
                        {selected && (
                          <Check className="h-5 w-5 text-blue-400" />
                        )}
                        {!free && <Lock className="h-4 w-4 text-zinc-500" />}
                      </div>

                      <p className="mt-2 text-2xl font-bold text-white">
                        ${p.price_monthly}
                        <span className="text-sm font-normal text-zinc-400">
                          /mo
                        </span>
                      </p>

                      {free && p.trial_days && p.trial_days > 0 && (
                        <p className="mt-1 text-xs text-amber-400">
                          {p.trial_days}-day free trial
                        </p>
                      )}
                      {free && (!p.trial_days || p.trial_days === 0) && (
                        <p className="mt-1 text-xs text-green-400">
                          Free forever
                        </p>
                      )}

                      <ul className="mt-3 space-y-1 text-sm text-zinc-300">
                        <li>· {p.max_projects} projects</li>
                        <li>
                          ·{' '}
                          {p.max_storage_mb >= 1024
                            ? `${(p.max_storage_mb / 1024).toFixed(1)} GB`
                            : `${p.max_storage_mb} MB`}{' '}
                          storage
                        </li>
                        <li>
                          · {(p.max_ai_tokens_monthly / 1000).toLocaleString()}k
                          AI tokens/mo
                        </li>
                      </ul>

                      {!free && (
                        <p className="mt-3 text-xs text-zinc-500">
                          Upgrade from Billing after signup.
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Account form */}
          <form
            onSubmit={handleSubmit}
            className="h-fit space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6"
          >
            <h2 className="text-lg font-semibold text-white">Your account</h2>

            {error && (
              <div className="rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-300">
                {error}
                <button
                  type="button"
                  onClick={clearError}
                  className="ml-2 text-red-400 hover:text-red-200"
                >
                  ×
                </button>
              </div>
            )}

            <div>
              <label
                htmlFor="name"
                className="mb-1 block text-sm font-medium text-zinc-300"
              >
                Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Your name"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-zinc-300"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-zinc-300"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label
                htmlFor="passwordConfirmation"
                className="mb-1 block text-sm font-medium text-zinc-300"
              >
                Confirm Password
              </label>
              <input
                id="passwordConfirmation"
                type="password"
                required
                minLength={8}
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || selectedPlanId === null}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>

            <p className="text-center text-sm text-zinc-400">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-400 hover:text-blue-300">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
