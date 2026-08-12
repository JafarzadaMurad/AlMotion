import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiClient } from '@/infrastructure/api/api-client';

/**
 * Providers, their models, their prices and what they have cost — one page.
 *
 * Keys, models and pricing used to be three separate concerns across the admin
 * UI, and the gap between them is where money leaks: a model advertised with
 * no price bills at fallback rates nobody chose, and nothing said so. Here
 * each provider is one card and an unpriced model is called out on it.
 */

interface PricingRow {
  id: number;
  provider: string;
  model: string;
  kind: string;
  input_cost_per_1m: number;
  output_cost_per_1m: number;
  cached_cost_per_1m: number;
  margin_multiplier: number;
  is_active: boolean;
}

interface ProviderCard {
  name: string;
  label: string;
  blurb: string;
  key_setting: string;
  key_set: boolean;
  docs_url: string | null;
  models: string[];
  models_without_pricing: string[];
  pricing: PricingRow[];
}

interface HubResponse {
  providers: ProviderCard[];
  credits_per_usd: number;
  anthropic_mode: string;
}

interface UsageRow {
  provider: string;
  model: string;
  calls: number;
  tokens: number;
  cost_usd: number;
  credits: number;
}

interface UsageResponse {
  since: string;
  by_model: UsageRow[];
  totals: { cost_usd: number; credits: number; calls: number };
}

const money = (value: number, digits = 2) => `$${Number(value ?? 0).toFixed(digits)}`;

/** What the user pays for 1M input tokens, once margin is applied. */
const sellPrice = (cost: number, margin: number) => cost * margin;

function AiHubPage() {
  const [hub, setHub] = useState<HubResponse | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Partial<PricingRow>>>({});
  const [newModel, setNewModel] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    const [hubData, usageData] = await Promise.all([
      ApiClient.get<HubResponse>('/admin/ai-hub'),
      ApiClient.get<UsageResponse>('/admin/ai-hub/usage?days=30'),
    ]);
    setHub(hubData);
    setUsage(usageData);
    setDrafts({});
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  const usageByModel = useMemo(() => {
    const map = new Map<string, UsageRow>();
    for (const row of usage?.by_model ?? []) map.set(`${row.provider}|${row.model}`, row);
    return map;
  }, [usage]);

  const savePricing = async (row: PricingRow) => {
    const draft = drafts[row.id];
    if (!draft) return;
    setBusy(true);
    try {
      await ApiClient.put(`/admin/ai-hub/pricing/${row.id}`, draft);
      await reload();
      setMessage(`Saved ${row.model}`);
    } finally {
      setBusy(false);
    }
  };

  const addModel = async (provider: string) => {
    const model = (newModel[provider] ?? '').trim();
    if (!model) return;
    setBusy(true);
    try {
      await ApiClient.post('/admin/ai-hub/pricing', {
        provider,
        model,
        input_cost_per_1m: 0,
        output_cost_per_1m: 0,
        cached_cost_per_1m: 0,
        margin_multiplier: 3,
      });
      setNewModel((prev) => ({ ...prev, [provider]: '' }));
      await reload();
      setMessage(`Added ${model} — set its rates before anyone uses it`);
    } finally {
      setBusy(false);
    }
  };

  const removePricing = async (row: PricingRow) => {
    if (!confirm(`Remove pricing for ${row.model}? It will bill at fallback rates until replaced.`)) return;
    setBusy(true);
    try {
      await ApiClient.delete(`/admin/ai-hub/pricing/${row.id}`);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const patch = (id: number, field: keyof PricingRow, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: field === 'model' ? value : Number(value) },
    }));
  };

  if (loading) {
    return <div className="p-8 text-zinc-400">Loading…</div>;
  }

  const creditsPerUsd = hub?.credits_per_usd ?? 10000;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Providers &amp; Pricing</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Every model users can pick, what it costs us, and what it costs them.
          1 credit = {money(1 / creditsPerUsd, 4)} · margin is the multiplier on top of raw cost.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-green-800 bg-green-950 px-4 py-2 text-sm text-green-300">
          {message}
        </div>
      )}

      {/* Spend first: the number an operator opens this page to see. */}
      {usage && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-3 text-lg font-semibold text-white">Last 30 days</h2>
          <div className="mb-4 grid grid-cols-3 gap-4">
            <div>
              <div className="text-2xl font-semibold text-white">{money(usage.totals.cost_usd, 4)}</div>
              <div className="text-xs text-zinc-500">Our provider cost</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-white">
                {usage.totals.credits.toLocaleString()}
              </div>
              <div className="text-xs text-zinc-500">
                Credits charged ≈ {money(usage.totals.credits / creditsPerUsd, 2)}
              </div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-white">{usage.totals.calls.toLocaleString()}</div>
              <div className="text-xs text-zinc-500">Calls</div>
            </div>
          </div>
          {usage.by_model.length === 0 && (
            <p className="text-sm text-zinc-500">No usage recorded yet.</p>
          )}
        </div>
      )}

      {hub?.providers.map((provider) => (
        <div key={provider.name} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-1 flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">{provider.label}</h2>
            <span
              className={
                provider.key_set
                  ? 'rounded bg-green-900 px-2 py-0.5 text-xs text-green-300'
                  : 'rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400'
              }
            >
              {provider.key_set ? 'Key set' : 'No key'}
            </span>
            {provider.name === 'claude_subscription' && (
              <span className="rounded bg-blue-950 px-2 py-0.5 text-xs text-blue-300">
                Mode: {hub.anthropic_mode}
              </span>
            )}
          </div>
          <p className="mb-4 text-sm text-zinc-400">{provider.blurb}</p>

          {/* A model with no rate bills at fallback and nobody finds out until
              the invoice. Say it here, where it can be fixed. */}
          {provider.models_without_pricing.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-800 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
              Billing at fallback rates — no price set for:{' '}
              <span className="font-mono">{provider.models_without_pricing.join(', ')}</span>
            </div>
          )}

          {provider.pricing.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                    <th className="pb-2 pr-3">Model</th>
                    <th className="pb-2 pr-3">In $/1M</th>
                    <th className="pb-2 pr-3">Out $/1M</th>
                    <th className="pb-2 pr-3">Cached $/1M</th>
                    <th className="pb-2 pr-3">Margin</th>
                    <th className="pb-2 pr-3">Sells at</th>
                    <th className="pb-2 pr-3">30d spend</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {provider.pricing.map((row) => {
                    const draft = drafts[row.id] ?? {};
                    const value = (field: keyof PricingRow) =>
                      String(draft[field] ?? row[field] ?? '');
                    const margin = Number(draft.margin_multiplier ?? row.margin_multiplier);
                    const input = Number(draft.input_cost_per_1m ?? row.input_cost_per_1m);
                    const spend = usageByModel.get(`${row.provider}|${row.model}`);
                    const dirty = Object.keys(draft).length > 0;

                    return (
                      <tr key={row.id} className="border-b border-zinc-800/60">
                        <td className="py-2 pr-3 font-mono text-xs text-zinc-300">{row.model}</td>
                        {(['input_cost_per_1m', 'output_cost_per_1m', 'cached_cost_per_1m', 'margin_multiplier'] as const).map(
                          (field) => (
                            <td key={field} className="py-2 pr-3">
                              <input
                                type="number"
                                step="0.001"
                                min="0"
                                value={value(field)}
                                onChange={(e) => patch(row.id, field, e.target.value)}
                                className="w-20 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
                              />
                            </td>
                          ),
                        )}
                        <td className="py-2 pr-3 text-xs text-zinc-400">
                          {money(sellPrice(input, margin))}/1M in
                        </td>
                        <td className="py-2 pr-3 text-xs text-zinc-400">
                          {spend ? `${money(spend.cost_usd, 4)} · ${spend.credits.toLocaleString()}cr` : '—'}
                        </td>
                        <td className="py-2 text-right">
                          {dirty && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => savePricing(row)}
                              className="mr-2 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
                            >
                              Save
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => removePricing(row)}
                            className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-950 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <input
              type="text"
              placeholder="Add a model id, e.g. claude-opus-4-8"
              value={newModel[provider.name] ?? ''}
              onChange={(e) => setNewModel((prev) => ({ ...prev, [provider.name]: e.target.value }))}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              disabled={busy || !(newModel[provider.name] ?? '').trim()}
              onClick={() => addModel(provider.name)}
              className="rounded-lg bg-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-600 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export const Route = createFileRoute('/admin/ai-hub')({
  component: AiHubPage,
});
