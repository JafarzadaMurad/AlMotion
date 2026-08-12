import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ApiClient } from '@/infrastructure/api/api-client';
import { useAuthStore } from '@/features/auth/stores/auth-store';

import type { Plan } from '@/features/auth/types/auth';

const ALL_MODELS = [
  // OpenAI
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', desc: 'Fast & cheap' },
  { id: 'gpt-4o', label: 'GPT-4o', desc: 'Standard' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', desc: 'Latest fast' },
  { id: 'gpt-4.1', label: 'GPT-4.1', desc: 'Latest standard' },
  { id: 'o3-mini', label: 'o3 Mini', desc: 'Reasoning' },
  { id: 'o4-mini', label: 'o4 Mini', desc: 'Advanced reasoning' },
  { id: 'gpt-5', label: 'GPT-5', desc: 'Previous intelligent reasoning model' },
  { id: 'gpt-5-mini', label: 'GPT-5 mini', desc: 'Near-frontier intelligence for cost sensitive workloads' },
  { id: 'gpt-5-nano', label: 'GPT-5 nano', desc: 'Fastest, most cost-efficient version of GPT-5' },
  { id: 'gpt-5.4', label: 'GPT-5.4', desc: 'Best intelligence at scale for agentic workflows' },
  { id: 'gpt-5.4-pro', label: 'GPT-5.4 pro', desc: 'Smarter and more precise responses' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini', desc: 'Our strongest mini model yet' },
  { id: 'gpt-5.4-nano', label: 'GPT-5.4 nano', desc: 'Cheapest GPT-5.4-class model' },
  // Anthropic
  { id: 'claude-opus-5', label: 'Claude Opus 5', desc: 'Anthropic top-tier reasoning' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', desc: 'Anthropic balanced default' },
  { id: 'claude-fable-5', label: 'Claude Fable 5', desc: 'Anthropic fast tier' },
  { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', desc: 'Previous generation' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', desc: 'Previous generation' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', desc: 'Anthropic fast & cheap' },
  // Google Gemini
  { id: 'gemini-3.1-pro-high', label: 'Gemini 3.1 Pro (High)', desc: 'Pro with dynamic thinking budget' },
  { id: 'gemini-3.1-pro-low', label: 'Gemini 3.1 Pro (Low)', desc: 'Pro with capped thinking budget' },
  { id: 'gemini-3-flash', label: 'Gemini 3 Flash', desc: 'Fast multimodal model' },
];

interface PlanForm {
  name: string;
  max_projects: number;
  max_storage_mb: number;
  max_ai_tokens_monthly: number;
  anthropic_tokens_monthly: number;
  gemini_tokens_monthly: number;
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

const emptyForm: PlanForm = {
  name: '',
  max_projects: 3,
  max_storage_mb: 500,
  max_ai_tokens_monthly: 50000,
  anthropic_tokens_monthly: 0,
  gemini_tokens_monthly: 0,
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
  allowed_models: ['gpt-4o-mini'],
  stripe_price_id: '',
};

export const Route = createFileRoute('/admin/plans')({
  beforeLoad: () => {
    const user = useAuthStore.getState().user;
    if (!user?.is_admin) throw new Error('Admin access required');
  },
  component: PlansPage,
});

function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadPlans = () => {
    ApiClient.get<Plan[]>('/admin/plans')
      .then(setPlans)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const openCreate = () => {
    setEditingPlan(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    const p = plan as Plan & { can_use_own_api_key?: boolean; allowed_models?: string[] };
    setForm({
      name: plan.name,
      max_projects: plan.max_projects,
      max_storage_mb: plan.max_storage_mb,
      max_ai_tokens_monthly: plan.max_ai_tokens_monthly,
      anthropic_tokens_monthly: (p as any).anthropic_tokens_monthly ?? 0,
      gemini_tokens_monthly: (p as any).gemini_tokens_monthly ?? 0,
      price_monthly: parseFloat(plan.price_monthly),
      trial_days: (p as any).trial_days ?? 0,
      is_default: plan.is_default,
      can_use_own_api_key: p.can_use_own_api_key ?? false,
      can_generate_broll: (p as any).can_generate_broll ?? false,
      can_create_agents: (p as any).can_create_agents ?? false,
      max_agents: (p as any).max_agents ?? 0,
      can_use_heygen: (p as any).can_use_heygen ?? false,
      max_heygen_credits_monthly: (p as any).max_heygen_credits_monthly ?? 0,
      can_create_avatars: (p as any).can_create_avatars ?? false,
      can_use_own_heygen_key: (p as any).can_use_own_heygen_key ?? false,
      can_use_mcp: (p as any).can_use_mcp ?? false,
      allowed_models: p.allowed_models ?? ['gpt-4o-mini'],
      stripe_price_id: (p as any).stripe_price_id ?? '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingPlan) {
        await ApiClient.put(`/admin/plans/${editingPlan.id}`, form);
      } else {
        await ApiClient.post('/admin/plans', form);
      }
      setShowForm(false);
      loadPlans();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (plan: Plan) => {
    if (!confirm(`Delete plan "${plan.name}"?`)) return;
    await ApiClient.delete(`/admin/plans/${plan.id}`);
    loadPlans();
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Plans</h1>
        <button
          onClick={openCreate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + New Plan
        </button>
      </div>

      {loading ? (
        <div className="text-zinc-400">Loading...</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Max Projects</th>
                <th className="px-4 py-3">Storage (MB)</th>
                <th className="px-4 py-3">AI Tokens/Month</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Users</th>
                <th className="px-4 py-3">Own API Key</th>
                <th className="px-4 py-3">Default</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {plans.map((plan) => (
                <tr key={plan.id} className="bg-zinc-950 text-white">
                  <td className="px-4 py-3 font-medium">{plan.name}</td>
                  <td className="px-4 py-3">{plan.max_projects}</td>
                  <td className="px-4 py-3">
                    {plan.max_storage_mb.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {plan.max_ai_tokens_monthly.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">${plan.price_monthly}</td>
                  <td className="px-4 py-3">{plan.users_count ?? 0}</td>
                  <td className="px-4 py-3">
                    {(plan as Plan & { can_use_own_api_key?: boolean }).can_use_own_api_key ? (
                      <span className="rounded bg-blue-900 px-2 py-0.5 text-xs text-blue-300">Yes</span>
                    ) : (
                      <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {plan.is_default && (
                      <span className="rounded bg-green-900 px-2 py-0.5 text-xs text-green-300">
                        Default
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(plan)}
                      className="mr-2 text-blue-400 hover:text-blue-300"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(plan)}
                      className="text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Plan Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6 flex flex-col max-h-[95vh]">
            <h2 className="mb-4 text-lg font-semibold text-white shrink-0">
              {editingPlan ? 'Edit Plan' : 'New Plan'}
            </h2>
            <div className="space-y-3 overflow-y-auto pr-2">
              <FormField
                label="Plan Name"
                value={form.name}
                onChange={(v) => setForm((f) => ({ ...f, name: v }))}
              />
              <FormField
                label="Max Projects"
                type="number"
                value={String(form.max_projects)}
                onChange={(v) =>
                  setForm((f) => ({ ...f, max_projects: parseInt(v) || 0 }))
                }
              />
              <FormField
                label="Max Storage (MB)"
                type="number"
                value={String(form.max_storage_mb)}
                onChange={(v) =>
                  setForm((f) => ({ ...f, max_storage_mb: parseInt(v) || 0 }))
                }
              />
              <FormField
                label="OpenAI Tokens / Month"
                type="number"
                value={String(form.max_ai_tokens_monthly)}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    max_ai_tokens_monthly: parseInt(v) || 0,
                  }))
                }
              />
              <FormField
                label="Anthropic Tokens / Month"
                type="number"
                value={String(form.anthropic_tokens_monthly)}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    anthropic_tokens_monthly: parseInt(v) || 0,
                  }))
                }
              />
              <FormField
                label="Gemini Tokens / Month"
                type="number"
                value={String(form.gemini_tokens_monthly)}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    gemini_tokens_monthly: parseInt(v) || 0,
                  }))
                }
              />
              <FormField
                label="Monthly Price ($)"
                type="number"
                value={String(form.price_monthly)}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    price_monthly: parseFloat(v) || 0,
                  }))
                }
              />
              <FormField
                label="Stripe Price ID"
                type="text"
                value={form.stripe_price_id}
                onChange={(v) =>
                  setForm((f) => ({ ...f, stripe_price_id: v }))
                }
              />
              <FormField
                label="Trial / free period (days)"
                type="number"
                value={String(form.trial_days)}
                onChange={(v) =>
                  setForm((f) => ({ ...f, trial_days: parseInt(v) || 0 }))
                }
              />
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, is_default: e.target.checked }))
                  }
                  className="rounded border-zinc-600"
                />
                Default plan for new users
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={form.can_use_own_api_key}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, can_use_own_api_key: e.target.checked }))
                  }
                  className="rounded border-zinc-600"
                />
                Allow users to use their own OpenAI API key
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={form.can_use_mcp}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, can_use_mcp: e.target.checked }))
                  }
                  className="rounded border-zinc-600"
                />
                Allow MCP access (Claude Desktop / Code / Cursor integration)
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={form.can_generate_broll}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, can_generate_broll: e.target.checked }))
                  }
                  className="rounded border-zinc-600"
                />
                Allow AI B-Roll generation (WaveSpeed)
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={form.can_create_agents}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, can_create_agents: e.target.checked }))
                  }
                  className="rounded border-zinc-600"
                />
                Allow creating custom agents
              </label>
              {form.can_create_agents && (
                <div>
                  <label className="mb-1 block text-sm text-zinc-400">Max Agents</label>
                  <input
                    type="number"
                    value={String(form.max_agents)}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, max_agents: parseInt(e.target.value) || 0 }))
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}

              {/* HeyGen */}
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={form.can_use_heygen}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, can_use_heygen: e.target.checked }))
                  }
                  className="rounded border-zinc-600"
                />
                Allow HeyGen (avatar video, translation, lip-sync)
              </label>
              {form.can_use_heygen && (
                <>
                  <div>
                    <label className="mb-1 block text-sm text-zinc-400">HeyGen Credits / Month</label>
                    <input
                      type="number"
                      value={String(form.max_heygen_credits_monthly)}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, max_heygen_credits_monthly: parseInt(e.target.value) || 0 }))
                      }
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={form.can_create_avatars}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, can_create_avatars: e.target.checked }))
                      }
                      className="rounded border-zinc-600"
                    />
                    Allow creating custom avatars
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={form.can_use_own_heygen_key}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, can_use_own_heygen_key: e.target.checked }))
                      }
                      className="rounded border-zinc-600"
                    />
                    Allow using own HeyGen API key
                  </label>
                </>
              )}

              {/* Allowed Models (platform key) */}
              <div>
                <label className="mb-2 block text-sm text-zinc-400">
                  Allowed AI Models <span className="text-zinc-600">(platform key)</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {ALL_MODELS.map((model) => (
                    <label key={model.id} className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 cursor-pointer hover:border-zinc-600">
                      <input
                        type="checkbox"
                        checked={form.allowed_models.includes(model.id)}
                        onChange={(e) => {
                          setForm((f) => ({
                            ...f,
                            allowed_models: e.target.checked
                              ? [...f.allowed_models, model.id]
                              : f.allowed_models.filter((m) => m !== model.id),
                          }));
                        }}
                        className="rounded border-zinc-600 accent-blue-500"
                      />
                      <div>
                        <div className="text-xs font-medium text-white">{model.label}</div>
                        <div className="text-[10px] text-zinc-500">{model.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-zinc-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}
