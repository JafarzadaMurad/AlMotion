import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ApiClient } from '@/infrastructure/api/api-client';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { Check, X, ExternalLink, Copy } from 'lucide-react';

interface AdminSettingsResponse {
  stripe_secret_key: string | null;
  stripe_secret_key_set: boolean;
  stripe_publishable_key: string | null;
  stripe_publishable_key_set: boolean;
  stripe_webhook_secret: string | null;
  stripe_webhook_secret_set: boolean;
}

interface Plan {
  id: number;
  name: string;
  price_monthly: string;
  stripe_price_id: string | null;
  is_default: boolean;
}

export const Route = createFileRoute('/admin/payments')({
  beforeLoad: () => {
    const user = useAuthStore.getState().user;
    if (!user?.is_admin) throw new Error('Admin access required');
  },
  component: PaymentsPage,
});

function PaymentsPage() {
  const [settings, setSettings] = useState<AdminSettingsResponse | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [stripeSecret, setStripeSecret] = useState('');
  const [stripePublishable, setStripePublishable] = useState('');
  const [stripeWebhook, setStripeWebhook] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        ApiClient.get<AdminSettingsResponse>('/admin/settings'),
        ApiClient.get<Plan[]>('/admin/plans'),
      ]);
      setSettings(s);
      setPlans(p);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const webhookUrl = `${window.location.origin}/api/stripe/webhook`;

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = {};
      if (stripeSecret) payload.stripe_secret_key = stripeSecret;
      if (stripePublishable) payload.stripe_publishable_key = stripePublishable;
      if (stripeWebhook) payload.stripe_webhook_secret = stripeWebhook;
      await ApiClient.put('/admin/settings', payload);
      setStripeSecret('');
      setStripePublishable('');
      setStripeWebhook('');
      setMessage('Stripe configuration saved.');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setMessage('Webhook URL copied to clipboard.');
  };

  const allKeysSet =
    settings?.stripe_secret_key_set &&
    settings?.stripe_publishable_key_set &&
    settings?.stripe_webhook_secret_set;

  const paidPlans = plans.filter((p) => parseFloat(p.price_monthly) > 0);
  const plansMissingPrice = paidPlans.filter((p) => !p.stripe_price_id);

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-zinc-400">Loading…</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="mb-1 text-2xl font-bold text-white">Payments</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Stripe configuration and billing status. Test mode keys begin with{' '}
        <code className="font-mono text-zinc-300">sk_test_</code> and{' '}
        <code className="font-mono text-zinc-300">pk_test_</code>; live keys
        start with <code className="font-mono text-zinc-300">sk_live_</code>.
      </p>

      <div className="max-w-3xl space-y-6">
        {message && (
          <div className="rounded-lg border border-green-800 bg-green-950 p-3 text-sm text-green-300">
            {message}
          </div>
        )}

        {/* Connection status */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Connection status
          </h2>
          <ul className="space-y-2 text-sm">
            <StatusRow
              label="Secret key"
              ok={!!settings?.stripe_secret_key_set}
              hint={settings?.stripe_secret_key ?? undefined}
            />
            <StatusRow
              label="Publishable key"
              ok={!!settings?.stripe_publishable_key_set}
              hint={settings?.stripe_publishable_key ?? undefined}
            />
            <StatusRow
              label="Webhook signing secret"
              ok={!!settings?.stripe_webhook_secret_set}
              hint={settings?.stripe_webhook_secret ?? undefined}
            />
            <StatusRow
              label={`Paid plans with Stripe price ID (${paidPlans.length - plansMissingPrice.length}/${paidPlans.length})`}
              ok={paidPlans.length > 0 && plansMissingPrice.length === 0}
              hint={
                plansMissingPrice.length > 0
                  ? `Missing: ${plansMissingPrice.map((p) => p.name).join(', ')}`
                  : undefined
              }
            />
          </ul>
          {allKeysSet && plansMissingPrice.length === 0 && paidPlans.length > 0 && (
            <p className="mt-3 text-xs text-green-400">
              Stripe is fully configured. Billing is live.
            </p>
          )}
        </div>

        {/* Webhook URL */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">
            Webhook endpoint
          </h2>
          <p className="mb-3 text-sm text-zinc-400">
            Add this URL in Stripe Dashboard → Developers → Webhooks. Subscribe
            to <code className="font-mono text-xs">checkout.session.completed</code>,
            <code className="font-mono text-xs"> customer.subscription.created</code>,
            <code className="font-mono text-xs"> customer.subscription.updated</code>,
            <code className="font-mono text-xs"> customer.subscription.deleted</code>.
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2">
            <code className="flex-1 font-mono text-sm text-zinc-200">{webhookUrl}</code>
            <button
              onClick={copyWebhookUrl}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-white"
              title="Copy"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Keys editor */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">API keys</h2>
          <p className="mb-4 text-sm text-zinc-400">
            Get them from{' '}
            <a
              href="https://dashboard.stripe.com/test/apikeys"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-blue-400 hover:underline"
            >
              dashboard.stripe.com/apikeys
              <ExternalLink className="h-3 w-3" />
            </a>
            . Leave a field blank to keep the existing value.
          </p>

          <div className="space-y-4">
            <KeyField
              label="Secret key"
              placeholder={settings?.stripe_secret_key_set ? 'Enter new key to replace…' : 'sk_test_…'}
              currentMasked={settings?.stripe_secret_key}
              isSet={!!settings?.stripe_secret_key_set}
              value={stripeSecret}
              onChange={setStripeSecret}
              type="password"
            />
            <KeyField
              label="Publishable key"
              placeholder={settings?.stripe_publishable_key_set ? 'Enter new key to replace…' : 'pk_test_…'}
              currentMasked={settings?.stripe_publishable_key}
              isSet={!!settings?.stripe_publishable_key_set}
              value={stripePublishable}
              onChange={setStripePublishable}
              type="text"
            />
            <KeyField
              label="Webhook signing secret"
              placeholder={settings?.stripe_webhook_secret_set ? 'Enter new key to replace…' : 'whsec_…'}
              currentMasked={settings?.stripe_webhook_secret}
              isSet={!!settings?.stripe_webhook_secret_set}
              value={stripeWebhook}
              onChange={setStripeWebhook}
              type="password"
              hint="From the webhook endpoint details page in Stripe Dashboard."
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving || (!stripeSecret && !stripePublishable && !stripeWebhook)}
            className="mt-6 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Stripe keys'}
          </button>
        </div>

        {/* Plans mapping */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">
            Plan ↔ Stripe price mapping
          </h2>
          <p className="mb-4 text-sm text-zinc-400">
            Paid plans need a Stripe price ID to be purchasable. Edit each
            plan to paste the <code className="font-mono text-xs">price_…</code>{' '}
            from Stripe Dashboard → Products.
          </p>
          <div className="overflow-hidden rounded-lg border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-800/50 text-left text-xs uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="px-4 py-2">Plan</th>
                  <th className="px-4 py-2">Price</th>
                  <th className="px-4 py-2">Stripe price ID</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} className="border-t border-zinc-800">
                    <td className="px-4 py-2 text-white">
                      {p.name}
                      {p.is_default && (
                        <span className="ml-2 rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300">
                          default
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-zinc-300">
                      ${p.price_monthly}/mo
                    </td>
                    <td className="px-4 py-2">
                      {p.stripe_price_id ? (
                        <code className="font-mono text-xs text-green-300">
                          {p.stripe_price_id}
                        </code>
                      ) : parseFloat(p.price_monthly) === 0 ? (
                        <span className="text-xs text-zinc-500">
                          not required (free)
                        </span>
                      ) : (
                        <span className="text-xs text-red-400">missing</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  ok,
  hint,
}: {
  label: string;
  ok: boolean;
  hint?: string;
}) {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
      ) : (
        <X className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
      )}
      <div className="flex-1">
        <span className="text-zinc-200">{label}</span>
        {hint && (
          <div className="mt-0.5 font-mono text-xs text-zinc-500">{hint}</div>
        )}
      </div>
    </li>
  );
}

function KeyField({
  label,
  placeholder,
  currentMasked,
  isSet,
  value,
  onChange,
  type,
  hint,
}: {
  label: string;
  placeholder: string;
  currentMasked: string | null | undefined;
  isSet: boolean;
  value: string;
  onChange: (v: string) => void;
  type: 'text' | 'password';
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </label>
      {isSet && (
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded bg-green-900 px-2 py-1 text-xs text-green-300">
            Set
          </span>
          <span className="font-mono text-sm text-zinc-400">{currentMasked}</span>
        </div>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
      />
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}
