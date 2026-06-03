import { createRootRoute, Outlet, useRouter, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { AppSidebar } from '@/features/layout/components/app-sidebar';
import { MediaHydrationOverlay } from '@/features/media-library/components/media-hydration-overlay';

export const Route = createRootRoute({
  component: RootComponent,
});

// Routes that should NOT have the sidebar
const NO_SIDEBAR_ROUTES = ['/login', '/register', '/', '/editor'];

function RootComponent() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (token) {
      fetchMe();
    }
  }, [token, fetchMe]);

  // Redirect to login if not authenticated and trying to access protected routes
  useEffect(() => {
    const publicRoutes = ['/', '/login', '/register', '/auth/callback'];
    const isPublicRoute = publicRoutes.includes(pathname);

    if (!token && !isPublicRoute) {
      router.navigate({ to: '/login' });
    }
  }, [token, router, pathname]);

  // Check if current route should show sidebar
  const showSidebar = token && !NO_SIDEBAR_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'));

  if (showSidebar) {
    return (
      <>
        <AppSidebar>
          <Outlet />
        </AppSidebar>
        <MediaHydrationOverlay />
      </>
    );
  }

  return (
    <>
      <Outlet />
      <MediaHydrationOverlay />
    </>
  );
}
