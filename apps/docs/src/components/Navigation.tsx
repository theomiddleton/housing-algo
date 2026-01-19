import { useState } from 'react';
import { Menu, X, Home, Cpu, Scale, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { href: '/', label: 'Home', icon: <Home className="w-4 h-4" /> },
  { href: '/algorithm', label: 'Algorithm', icon: <Cpu className="w-4 h-4" /> },
  { href: '/weights', label: 'Weights', icon: <Scale className="w-4 h-4" /> },
  // { href: '/usage', label: 'Usage', icon: <Terminal className="w-4 h-4" /> },
];

interface NavigationProps {
  currentPath: string;
}

export function Navigation({ currentPath }: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-industrial-border bg-industrial-bg/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-warning to-orange-500 flex items-center justify-center shadow-lg shadow-warning/25 group-hover:shadow-warning/40 transition-shadow">
                <svg
                  className="w-6 h-6 text-industrial-bg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
              </div>
            </div>
            <div>
              <span className="text-lg font-semibold text-gray-100">Housing</span>
              <span className="text-lg font-semibold text-warning">Algo</span>
            </div>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all',
                  currentPath === item.href
                    ? 'bg-warning/20 text-warning'
                    : 'text-muted-foreground hover:text-warning hover:bg-warning/10'
                )}
              >
                {item.icon}
                {item.label}
              </a>
            ))}
          </div>

          {/* GitHub Link */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href="https://github.com/theomiddleton/housing-algo"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-warning transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>
          </div>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-industrial-border bg-industrial-bg/95 backdrop-blur-md">
          <div className="px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all',
                  currentPath === item.href
                    ? 'bg-warning/20 text-warning'
                    : 'text-muted-foreground hover:text-warning hover:bg-warning/10'
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.icon}
                {item.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
