import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { ApiClient } from '@/infrastructure/api/api-client';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/billing')({
  component: BillingPage,
});

interface Plan {
  id: number;
  name: string;
  slug: string;
  price_monthly: string;
  max_projects: number;
  max_storage_mb: number;
  max_ai_tokens_monthly: number;
  stripe_price_id: string | null;
}

function BillingPage() {
  const user = useAuthStore((s) => s.user);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const list = await ApiClient.get<Plan[]>('/plans').catch(() => [] as Plan[]);
        setPlans(list);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // After Stripe Checkout the success_url has ?session_id=... — sync the subscription
  // state so the local plan_id updates immediately, without waiting on a webhook.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (!sessionId) return;

    const sync = async () => {
      setActionLoading('sync');
      try {
        await ApiClient.post('/stripe/sync', { session_id: sessionId });
        await fetchMe();
        // Clean the URL so refreshing doesn't re-sync.
        window.history.replaceState({}, '', '/billing');
      } catch (err) {
        setError((err as { message?: string })?.message ?? 'Failed to sync subscription.');
      } finally {
        setActionLoading(null);
      }
    };
    sync();
  }, [fetchMe]);

  const handleUpgrade = async (planId: number) => {
    setActionLoading(`checkout-${planId}`);
    setError(null);
    try {
      const { url } = await ApiClient.post<{ url: string }>('/stripe/checkout', { plan_id: planId });
      window.location.href = url;
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Could not start checkout.');
      setActionLoading(null);
    }
  };

  const handleManage = async () => {
    setActionLoading('portal');
    setError(null);
    try {
      const { url } = await ApiClient.post<{ url: string }>('/stripe/portal', {});
      window.location.href = url;
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Could not open billing portal.');
      setActionLoading(null);
    }
  };

  const currentPlanId = user?.plan_id;
  const hasSubscription = !!(user as any)?.stripe_subscription_id;

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-bold text-white">Billing</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Current plan: <span className="font-semibold text-white">{user?.plan?.name ?? 'Free'}</span>
        {(user as any)?.subscription_status && (
          <> · status: <span className="font-mono text-xs">{(user as any).subscription_status}</span></>
        )}
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {hasSubscription && (
        <div className="mt-6">
          <Button onClick={handleManage} disabled={actionLoading === 'portal'} variant="secondary">
            {actionLoading === 'portal' ? 'Opening…' : 'Manage subscription'}
          </Button>
          <p className="mt-2 text-xs text-zinc-500">
            Opens Stripe&apos;s billing portal to update payment method, view invoices, or cancel.
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading && <p className="col-span-full text-zinc-400">Loading plans…</p>}
        {!loading && plans.length === 0 && (
          <p className="col-span-full text-zinc-400">No plans available.</p>
        )}
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const isFree = !plan.stripe_price_id || Number(plan.price_monthly) === 0;
          return (
            <div
              key={plan.id}
              className={`rounded-xl border p-6 ${
                isCurrent
                  ? 'border-purple-600 bg-purple-950/20'
                  : 'border-zinc-800 bg-zinc-900'
              }`}
            >
              <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
              <p className="mt-1 text-2xl font-bold text-white">
                ${plan.price_monthly}
                <span className="text-sm font-normal text-zinc-400">/mo</span>
              </p>

              <ul className="mt-4 space-y-1 text-sm text-zinc-300">
                <li>· {plan.max_projects} projects</li>
                <li>· {(plan.max_storage_mb / 1024).toFixed(plan.max_storage_mb >= 1024 ? 1 : 2)} GB storage</li>
                <li>· {(plan.max_ai_tokens_monthly / 1000).toLocaleString()}k AI tokens/mo</li>
              </ul>

              <div className="mt-6">
                {isCurrent ? (
                  <Button disabled className="w-full" variant="secondary">Current plan</Button>
                ) : isFree ? (
                  <Button disabled className="w-full" variant="ghost">Free tier</Button>
                ) : (
                  <Button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={actionLoading === `checkout-${plan.id}` || !plan.stripe_price_id}
                    className="w-full"
                  >
                    {actionLoading === `checkout-${plan.id}` ? 'Opening checkout…' : 'Upgrade'}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-xs text-zinc-600">
        Powered by Stripe. Payments are processed on Stripe&apos;s secure servers.
      </p>
    </div>
  );
}
