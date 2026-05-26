import { Link, useRouterState } from '@tanstack/react-router';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { useState } from 'react';
import {
  FolderOpen,
  Bot,
  Settings,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  LayoutDashboard,
  CreditCard,
  Users,
  Brain,
  Wrench,
} from 'lucide-react';
import { cn } from '@/shared/ui/cn';

const NAV_ITEMS = [
  { to: '/projects' as const, label: 'Projects', icon: FolderOpen },
  { to: '/agents' as const, label: 'Agents', icon: Bot },
  { to: '/billing' as const, label: 'Billing', icon: CreditCard },
  { to: '/settings' as const, label: 'Settings', icon: Settings },
];

const ADMIN_ITEMS = [
  { to: '/admin/dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/plans' as const, label: 'Plans', icon: CreditCard },
  { to: '/admin/payments' as const, label: 'Payments', icon: CreditCard },
  { to: '/admin/users' as const, label: 'Users', icon: Users },
  { to: '/admin/agents' as const, label: 'Agents', icon: Bot },
  { to: '/admin/ai-config' as const, label: 'AI Config', icon: Brain },
  { to: '/admin/settings' as const, label: 'Settings', icon: Wrench },
];

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const location = useRouterState({ select: (s) => s.location });
  const [collapsed, setCollapsed] = useState(false);
  const [adminOpen, setAdminOpen] = useState(location.pathname.startsWith('/admin'));

  return (
    <div className="flex min-h-screen bg-zinc-950">
      <aside
        className={cn(
          'flex flex-col border-r border-zinc-800/60 bg-zinc-900/80 backdrop-blur-sm transition-all duration-300 relative',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        {/* Logo */}
        <div className={cn('border-b border-zinc-800/60 flex items-center', collapsed ? 'px-3 py-4 justify-center' : 'px-5 py-4')}>
          <Link to="/projects" className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
            {!collapsed && <span className="text-base font-bold text-white tracking-tight">AlMotion</span>}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname.startsWith(item.to) && !location.pathname.startsWith('/admin');
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  collapsed && 'justify-center px-0',
                  isActive
                    ? 'bg-purple-500/15 text-purple-300 border border-purple-500/20'
                    : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 border border-transparent'
                )}
              >
                <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-purple-400' : '')} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}

          {/* Admin dropdown */}
          {user?.is_admin && (
            <div className="pt-2 mt-2 border-t border-zinc-800/40">
              <button
                onClick={() => setAdminOpen(o => !o)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  collapsed && 'justify-center px-0',
                  location.pathname.startsWith('/admin')
                    ? 'bg-amber-500/15 text-amber-300'
                    : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                )}
              >
                <Shield className={cn('w-4 h-4 shrink-0', location.pathname.startsWith('/admin') ? 'text-amber-400' : '')} />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">Admin</span>
                    <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', adminOpen && 'rotate-180')} />
                  </>
                )}
              </button>

              {adminOpen && !collapsed && (
                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-zinc-800/40 pl-3">
                  {ADMIN_ITEMS.map((item) => {
                    const isActive = location.pathname === item.to;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={cn(
                          'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-all',
                          isActive
                            ? 'bg-amber-500/10 text-amber-300'
                            : 'text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300'
                        )}
                      >
                        <Icon className={cn('w-3.5 h-3.5 shrink-0', isActive ? 'text-amber-400' : '')} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors z-10"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>

        {/* User section */}
        <div className={cn('border-t border-zinc-800/60 p-3', collapsed && 'px-2')}>
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">{user?.name}</p>
                <p className="text-[11px] text-zinc-500 truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => logout()}
                className="p-1.5 rounded-md hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
              </div>
              <button
                onClick={() => logout()}
                className="p-1.5 rounded-md hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
