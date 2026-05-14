import { Link, useRouterState } from '@tanstack/react-router';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import type { ReactNode } from 'react';

const navItems = [
  { to: '/admin/dashboard' as const, label: 'Dashboard' },
  { to: '/admin/plans' as const, label: 'Plans' },
  { to: '/admin/users' as const, label: 'Users' },
  { to: '/admin/agents' as const, label: 'Agents' },
  { to: '/admin/ai-config' as const, label: 'AI Config' },
  { to: '/admin/settings' as const, label: 'Settings' },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const location = useRouterState({ select: (s) => s.location });

  return (
    <div className="flex min-h-screen bg-zinc-950">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 p-4">
          <Link to="/projects" className="text-lg font-bold text-white">
            FreeCut
          </Link>
          <div className="mt-1 text-xs text-zinc-400">Admin Panel</div>
        </div>

        <nav className="flex-1 p-3">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`mb-1 block rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-800 p-4">
          <div className="mb-2 text-sm text-zinc-300">{user?.name}</div>
          <div className="mb-3 text-xs text-zinc-500">{user?.email}</div>
          <div className="flex gap-2">
            <Link
              to="/projects"
              className="rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
            >
              Editor
            </Link>
            <button
              onClick={() => logout()}
              className="rounded bg-zinc-800 px-3 py-1.5 text-xs text-red-400 hover:bg-zinc-700"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
