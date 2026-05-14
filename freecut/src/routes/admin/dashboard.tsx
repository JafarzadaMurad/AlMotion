import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ApiClient } from '@/infrastructure/api/api-client';
import { useAuthStore } from '@/features/auth/stores/auth-store';


interface DashboardData {
  total_users: number;
  total_projects: number;
  total_media_files: number;
  total_storage_used: number;
  total_tokens_used: number;
  users_by_plan: Array<{
    id: number;
    name: string;
    slug: string;
    users_count: number;
  }>;
  recent_users: Array<{
    id: number;
    name: string;
    email: string;
    created_at: string;
    plan: { name: string } | null;
  }>;
  blocked_users: number;
}

export const Route = createFileRoute('/admin/dashboard')({
  beforeLoad: () => {
    const user = useAuthStore.getState().user;
    if (!user?.is_admin) {
      throw new Error('Admin access required');
    }
  },
  component: DashboardPage,
});

function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ApiClient.get<DashboardData>('/admin/dashboard')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex h-64 items-center justify-center text-zinc-400">
          Loading...
        </div>
      </div>
    );
  }

  if (!data) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-white">Dashboard</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Users" value={data.total_users} />
        <StatCard label="Total Projects" value={data.total_projects} />
        <StatCard label="Total Media" value={data.total_media_files} />
        <StatCard
          label="Storage Used"
          value={formatBytes(data.total_storage_used)}
        />
        <StatCard
          label="AI Tokens Used"
          value={data.total_tokens_used.toLocaleString()}
        />
        <StatCard label="Blocked Users" value={data.blocked_users} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Users by Plan */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Users by Plan
          </h2>
          <div className="space-y-3">
            {data.users_by_plan.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center justify-between rounded-lg bg-zinc-800 px-4 py-3"
              >
                <span className="text-zinc-300">{plan.name}</span>
                <span className="font-mono text-white">
                  {plan.users_count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Users */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Recent Users
          </h2>
          <div className="space-y-3">
            {data.recent_users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-lg bg-zinc-800 px-4 py-3"
              >
                <div>
                  <div className="text-sm text-white">{user.name}</div>
                  <div className="text-xs text-zinc-400">{user.email}</div>
                </div>
                <span className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-300">
                  {user.plan?.name ?? 'No plan'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="text-sm text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-white">{value}</div>
    </div>
  );
}
