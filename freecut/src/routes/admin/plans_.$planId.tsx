import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, Gauge, Coins, Cpu, Sparkles } from 'lucide-react';
import { ApiClient } from '@/infrastructure/api/api-client';
import { useAuthStore } from '@/features/auth/stores/auth-store';

/**
 * Plan editor as a page with sections, not a modal.
 *
 * A plan carries about twenty settings across five unrelated concerns; a
 * single scrolling dialog made finding one a hunt and gave no room to explain
 * what any of them do. Sections down the side keep each concern to a screen.
 *
 * The AI models list comes from the pricing table rather than a hardcoded
 * array. That array had already drifted a whole model generation behind, and
 * an allow-list offering a model with no price is how usage ends up billed at
 * fallback rates — the catalogue and the price are the same fact.
 */

interface PricingRow {
  id: number;
  provider: string;
  model: string;
  input_cost_per_1m: number;
  output_cost_per_1m: number;
  margin_multiplier: number;
  is_active: boolean;
}

interface HubResponse {
  providers: Array<{ name: string; label: string; pricing: PricingRow[] }>;
  credits_per_usd: number;
}

interface PlanForm {
  name: string;
  max_projects: number;
  max_storage_mb: number;
  max_ai_tokens_monthly: number;
  anthropic_tokens_monthly: number;
  gemini_tokens_monthly: number;
  monthly_credits: number;
  price_monthly: number;
  trial_days: number;
  is_default: boolean;
  can_use_own_api_key: boolean;
  can_generate_broll: boolean;
  can_create_agents: boolean;
  max_agents: number;
  can_use_heygen: boolean;
  max_heygen_credits_monthly: number;
  can_create_avatars: boolean;
  can_use_own_heygen_key: boolean;
  can_use_mcp: boolean;
  allowed_models: string[];
  stripe_price_id: string;
}

const EMPTY: PlanForm = {
  name: '',
  max_projects: 3,
  max_storage_mb: 500,
  max_ai_tokens_monthly: 50000,
  anthropic_tokens_monthly: 0,
  gemini_tokens_monthly: 0,
  monthly_credits: 0,
  price_monthly: 0,
  trial_days: 0,
  is_default: false,
  can_use_own_api_key: false,
  can_generate_broll: false,
  can_create_agents: false,
  max_agents: 0,
  can_use_heygen: false,
  max_heygen_credits_monthly: 0,
  can_create_avatars: false,
  can_use_own_heygen_key: false,
  can_use_mcp: false,
  allowed_models: [],
  stripe_price_id: '',
};

const SECTIONS = [
  { key: 'basics', label: 'Basics', icon: Info, hint: 'Name, price, trial, visibility.' },
  { key: 'limits', label: 'Usage limits', icon: Gauge, hint: 'Projects, storage, agents.' },
  { key: 'credits', label: 'Credits', icon: Coins, hint: 'Monthly allowance and token caps.' },
  { key: 'ai', label: 'AI models', icon: Cpu, hint: 'Which models this plan may use.' },
  { key: 'features', label: 'Features', icon: Sparkles, hint: 'HeyGen, B-roll, MCP, own keys.' },
] as const;

type SectionKey = typeof SECTIONS[number]['key'];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-zinc-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

function Toggle({
  checked, onChange, label, hint,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-blue-600"
      />
      <span>
        <span className="block text-sm text-zinc-200">{label}</span>
        {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
      </span>
    </label>
  );
}

const inputClass =
  'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none';

function PlanEditorPage() {
  const { planId } = useParams({ from: '/admin/plans_/$planId' });
  const navigate = useNavigate();
  const isNew = planId === 'new';

  const [form, setForm] = useState<PlanForm>(EMPTY);
  const [hub, setHub] = useState<HubResponse | null>(null);
  const [section, setSection] = useState<SectionKey>('basics');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = useCallback(<K extends keyof PlanForm>(key: K, value: PlanForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    const load = async () => {
      const hubData = await ApiClient.get<HubResponse>('/admin/ai-hub').catch(() => null);
      setHub(hubData);

      if (!isNew) {
        const plans = await ApiClient.get<Array<PlanForm & { id: number }>>('/admin/plans');
        const found = plans.find((p) => String(p.id) === planId);
        if (found) {
          setForm({ ...EMPTY, ...found, allowed_models: found.allowed_models ?? [] });
        }
      }
    };
    load().finally(() => setLoading(false));
  }, [planId, isNew]);

  /**
   * Only priced, active models are offerable. A plan that allows a model with
   * no price would bill it at fallback rates — the allow-list and the price
   * list have to agree, so they come from the same source.
   */
  const availableModels = useMemo(() => {
    if (!hub) return [];
    return hub.providers.flatMap((provider) =>
      provider.pricing
        .filter((row) => row.is_active)
        .map((row) => ({ ...row, providerLabel: provider.label })),
    );
  }, [hub]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof availableModels>();
    for (const model of availableModels) {
      const list = map.get(model.providerLabel) ?? [];
      list.push(model);
      map.set(model.providerLabel, list);
    }
    return [...map.entries()];
  }, [availableModels]);

  const toggleModel = (model: string) => {
    setForm((prev) => ({
      ...prev,
      allowed_models: prev.allowed_models.includes(model)
        ? prev.allowed_models.filter((m) => m !== model)
        : [...prev.allowed_models, model],
    }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        await ApiClient.post('/admin/plans', form);
      } else {
        await ApiClient.put(`/admin/plans/${planId}`, form);
      }
      navigate({ to: '/admin/plans' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the plan');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-zinc-400">Loading…</div>;

  const creditsPerUsd = hub?.credits_per_usd ?? 10000;

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{isNew ? 'New plan' : form.name || 'Edit plan'}</h1>
          <p className="text-sm text-zinc-400">
            {form.allowed_models.length} model{form.allowed_models.length === 1 ? '' : 's'} allowed
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate({ to: '/admin/plans' })}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !form.name.trim()}
            onClick={save}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save plan'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-950 px-4 py-2 text-sm text-red-300">{error}</div>
      )}

      <div className="flex gap-6">
        <nav className="w-56 shrink-0 space-y-1">
          {SECTIONS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setSection(entry.key)}
              className={
                section === entry.key
                  ? 'flex w-full items-center gap-2 rounded-lg bg-blue-600/20 px-3 py-2 text-left text-sm text-blue-300'
                  : 'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-400 hover:bg-zinc-800'
              }
            >
              <entry.icon className="h-4 w-4 shrink-0" />
              {entry.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="mb-4 text-xs text-zinc-500">
            {SECTIONS.find((entry) => entry.key === section)?.hint}
          </p>

          {section === 'basics' && (
            <div className="space-y-4">
              <Field label="Name">
                <input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Price (USD / month)">
                  <input type="number" step="0.01" min="0" className={inputClass}
                    value={form.price_monthly} onChange={(e) => set('price_monthly', Number(e.target.value))} />
                </Field>
                <Field label="Trial days" hint="0 for no trial.">
                  <input type="number" min="0" className={inputClass}
                    value={form.trial_days} onChange={(e) => set('trial_days', Number(e.target.value))} />
                </Field>
              </div>
              <Field label="Stripe price ID" hint="Required before this plan can be bought.">
                <input className={inputClass} placeholder="price_..." value={form.stripe_price_id}
                  onChange={(e) => set('stripe_price_id', e.target.value)} />
              </Field>
              <Toggle checked={form.is_default} onChange={(v) => set('is_default', v)}
                label="Default plan" hint="New sign-ups land on this one." />
            </div>
          )}

          {section === 'limits' && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Max projects">
                <input type="number" min="0" className={inputClass}
                  value={form.max_projects} onChange={(e) => set('max_projects', Number(e.target.value))} />
              </Field>
              <Field label="Storage (MB)" hint="A minute of 1080p is roughly 100 MB.">
                <input type="number" min="0" className={inputClass}
                  value={form.max_storage_mb} onChange={(e) => set('max_storage_mb', Number(e.target.value))} />
              </Field>
              <Field label="Max agents">
                <input type="number" min="0" className={inputClass}
                  value={form.max_agents} onChange={(e) => set('max_agents', Number(e.target.value))} />
              </Field>
              <Field label="HeyGen credits / month">
                <input type="number" min="0" className={inputClass}
                  value={form.max_heygen_credits_monthly}
                  onChange={(e) => set('max_heygen_credits_monthly', Number(e.target.value))} />
              </Field>
            </div>
          )}

          {section === 'credits' && (
            <div className="space-y-4">
              <Field
                label="Monthly credits"
                hint={`1 credit = $${(1 / creditsPerUsd).toFixed(4)}. ${
                  form.monthly_credits > 0
                    ? `This grant is worth about $${(form.monthly_credits / creditsPerUsd).toFixed(2)} of retail AI usage.`
                    : 'Zero means the user must buy credits before using AI.'
                }`}
              >
                <input type="number" min="0" className={inputClass}
                  value={form.monthly_credits} onChange={(e) => set('monthly_credits', Number(e.target.value))} />
              </Field>

              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <p className="mb-3 text-xs text-zinc-500">
                  Token caps predate credits and still apply on top. Leave them generous unless you
                  want a hard ceiling per provider regardless of spend.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="OpenAI tokens">
                    <input type="number" min="0" className={inputClass}
                      value={form.max_ai_tokens_monthly}
                      onChange={(e) => set('max_ai_tokens_monthly', Number(e.target.value))} />
                  </Field>
                  <Field label="Anthropic tokens">
                    <input type="number" min="0" className={inputClass}
                      value={form.anthropic_tokens_monthly}
                      onChange={(e) => set('anthropic_tokens_monthly', Number(e.target.value))} />
                  </Field>
                  <Field label="Gemini tokens">
                    <input type="number" min="0" className={inputClass}
                      value={form.gemini_tokens_monthly}
                      onChange={(e) => set('gemini_tokens_monthly', Number(e.target.value))} />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {section === 'ai' && (
            <div className="space-y-5">
              {grouped.length === 0 && (
                <p className="text-sm text-zinc-400">
                  No priced models yet. Add them under{' '}
                  <span className="text-zinc-200">Admin → AI Providers</span> first — a model
                  without a price cannot be offered on a plan.
                </p>
              )}
              {grouped.map(([providerLabel, models]) => (
                <div key={providerLabel}>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    {providerLabel}
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {models.map((model) => {
                      const checked = form.allowed_models.includes(model.model);
                      const sells = model.input_cost_per_1m * model.margin_multiplier;
                      return (
                        <label
                          key={model.id}
                          className={
                            checked
                              ? 'flex cursor-pointer items-start gap-2 rounded-lg border border-blue-700 bg-blue-950/30 p-2'
                              : 'flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-2 hover:border-zinc-700'
                          }
                        >
                          <input type="checkbox" checked={checked} onChange={() => toggleModel(model.model)}
                            className="mt-0.5 h-4 w-4 accent-blue-600" />
                          <span className="min-w-0">
                            <span className="block truncate font-mono text-xs text-zinc-200">{model.model}</span>
                            <span className="block text-[11px] text-zinc-500">
                              sells at ${sells.toFixed(2)}/1M in · margin {model.margin_multiplier}×
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {section === 'features' && (
            <div className="space-y-2">
              <Toggle checked={form.can_use_own_api_key} onChange={(v) => set('can_use_own_api_key', v)}
                label="Bring your own API key" hint="Their key, their bill — no credits charged." />
              <Toggle checked={form.can_generate_broll} onChange={(v) => set('can_generate_broll', v)}
                label="AI B-roll generation" />
              <Toggle checked={form.can_create_agents} onChange={(v) => set('can_create_agents', v)}
                label="Create agents" />
              <Toggle checked={form.can_use_heygen} onChange={(v) => set('can_use_heygen', v)}
                label="HeyGen avatar videos" />
              <Toggle checked={form.can_create_avatars} onChange={(v) => set('can_create_avatars', v)}
                label="Create custom avatars" />
              <Toggle checked={form.can_use_own_heygen_key} onChange={(v) => set('can_use_own_heygen_key', v)}
                label="Bring your own HeyGen key" />
              <Toggle checked={form.can_use_mcp} onChange={(v) => set('can_use_mcp', v)}
                label="MCP access" hint="Drive the editor from Claude Code or Cursor." />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/admin/plans_/$planId')({
  beforeLoad: () => {
    const user = useAuthStore.getState().user;
    if (!user?.is_admin) throw new Error('Admin access required');
  },
  component: PlanEditorPage,
});
