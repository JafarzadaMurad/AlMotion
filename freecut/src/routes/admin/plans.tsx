import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ApiClient } from '@/infrastructure/api/api-client';
import { useAuthStore } from '@/features/auth/stores/auth-store';

import type { Plan } from '@/features/auth/types/auth';

export const Route = createFileRoute('/admin/plans')({
  beforeLoad: () => {
    const user = useAuthStore.getState().user;
    if (!user?.is_admin) throw new Error('Admin access required');
  },
  component: PlansPage,
});

function PlansPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPlans = () => {
    ApiClient.get<Plan[]>('/admin/plans')
      .then(setPlans)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const openCreate = () => {
    navigate({ to: '/admin/plans/$planId', params: { planId: 'new' } });
  };

  const openEdit = (plan: Plan) => {
    navigate({ to: '/admin/plans/$planId', params: { planId: String(plan.id) } });
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

    </div>
  );
}
