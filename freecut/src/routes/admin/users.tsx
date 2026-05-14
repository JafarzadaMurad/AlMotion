import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState, useCallback } from 'react';
import { ApiClient } from '@/infrastructure/api/api-client';
import { useAuthStore } from '@/features/auth/stores/auth-store';

import type { Plan, User } from '@/features/auth/types/auth';

interface PaginatedUsers {
  data: User[];
  current_page: number;
  last_page: number;
  total: number;
}

export const Route = createFileRoute('/admin/users')({
  beforeLoad: () => {
    const user = useAuthStore.getState().user;
    if (!user?.is_admin) throw new Error('Admin access required');
  },
  component: UsersPage,
});

function UsersPage() {
  const [users, setUsers] = useState<PaginatedUsers | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [assigningPlan, setAssigningPlan] = useState<{
    userId: number;
    planId: number | null;
  } | null>(null);

  const loadUsers = useCallback(() => {
    setLoading(true);
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
    ApiClient.get<PaginatedUsers>(
      `/admin/users?page=${page}${searchParam}`
    )
      .then(setUsers)
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => {
    loadUsers();
    ApiClient.get<Plan[]>('/admin/plans').then(setPlans);
  }, [loadUsers]);

  const handleToggleBlock = async (user: User) => {
    await ApiClient.post(`/admin/users/${user.id}/toggle-block`);
    loadUsers();
  };

  const handleAssignPlan = async () => {
    if (!assigningPlan) return;
    await ApiClient.post(`/admin/users/${assigningPlan.userId}/assign-plan`, {
      plan_id: assigningPlan.planId,
    });
    setAssigningPlan(null);
    loadUsers();
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Delete user "${user.name}" (${user.email})?`)) return;
    await ApiClient.delete(`/admin/users/${user.id}`);
    loadUsers();
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <div className="text-sm text-zinc-400">
          Total: {users?.total ?? 0}
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="text-zinc-400">Loading...</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900 text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Projects</th>
                  <th className="px-4 py-3">Tokens Used</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {users?.data.map((user) => (
                  <tr key={user.id} className="bg-zinc-950 text-white">
                    <td className="px-4 py-3">
                      <div className="font-medium">{user.name}</div>
                      {user.is_admin && (
                        <span className="text-xs text-yellow-400">Admin</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{user.email}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() =>
                          setAssigningPlan({
                            userId: user.id,
                            planId: user.plan_id,
                          })
                        }
                        className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
                      >
                        {user.plan?.name ?? 'No plan'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {(user as User & { projects_count?: number })
                        .projects_count ?? 0}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {user.tokens_used_this_month.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {user.is_blocked ? (
                        <span className="rounded bg-red-900 px-2 py-0.5 text-xs text-red-300">
                          Blocked
                        </span>
                      ) : (
                        <span className="rounded bg-green-900 px-2 py-0.5 text-xs text-green-300">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleToggleBlock(user)}
                          className={`text-xs ${user.is_blocked ? 'text-green-400 hover:text-green-300' : 'text-yellow-400 hover:text-yellow-300'}`}
                        >
                          {user.is_blocked ? 'Unblock' : 'Block'}
                        </button>
                        {!user.is_admin && (
                          <button
                            onClick={() => handleDelete(user)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {users && users.last_page > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded border border-zinc-700 px-3 py-1 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
              >
                Prev
              </button>
              <span className="text-sm text-zinc-400">
                Page {page} of {users.last_page}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(users.last_page, p + 1))}
                disabled={page === users.last_page}
                className="rounded border border-zinc-700 px-3 py-1 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Assign Plan Modal */}
      {assigningPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">
              Assign Plan
            </h2>
            <select
              value={assigningPlan.planId ?? ''}
              onChange={(e) =>
                setAssigningPlan((s) =>
                  s
                    ? { ...s, planId: e.target.value ? Number(e.target.value) : null }
                    : null
                )
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="">No plan</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} - ${plan.price_monthly}/mo
                </option>
              ))}
            </select>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setAssigningPlan(null)}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignPlan}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
