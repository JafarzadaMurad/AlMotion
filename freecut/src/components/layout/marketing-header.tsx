import { Link, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { FreeCutLogo } from '@/components/brand/freecut-logo';
import { Button } from '@/components/ui/button';

export function MarketingHeader() {
    const token = useAuthStore((s) => s.token);
    const logout = useAuthStore((s) => s.logout);
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate({ to: '/' });
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
                <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
                    <FreeCutLogo size="sm" />
                </Link>

                <nav className="flex items-center gap-4">
                    {token ? (
                        <>
                            <Button asChild variant="ghost" size="sm">
                                <Link to="/projects">Dashboard</Link>
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleLogout}>
                                Logout
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button asChild variant="ghost" size="sm">
                                <Link to="/login">Login</Link>
                            </Button>
                            <Button asChild size="sm" className="bg-primary hover:bg-primary/90">
                                <Link to="/register">Get Started</Link>
                            </Button>
                        </>
                    )}
                </nav>
            </div>
        </header>
    );
}
