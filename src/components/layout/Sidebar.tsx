'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, Users, RefreshCw, Bell, FileText,
  Upload, Settings, ChevronLeft, ChevronRight, X, UserCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ThemeToggle from '@/components/theme/ThemeToggle';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/vendors', label: 'Vendors', icon: UserCheck },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/renewals', label: 'Renewals', icon: RefreshCw },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/import', label: 'Import / Export', icon: Upload },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile toggle button */}
      <button
        id="mobile-menu-toggle"
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg p-2 shadow-md"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full z-50 flex flex-col bg-[#1e3a5f] text-white transition-all duration-300 shadow-xl',
          collapsed ? 'w-16' : 'w-60',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Header */}
        <div className={cn(
          'flex items-center border-b border-white/10 flex-shrink-0',
          collapsed ? 'justify-center px-2 py-4' : 'justify-between px-4 py-4'
        )}>
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-[#1e3a5f] font-black text-xs leading-none">TOI</span>
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">Vendor Portal</p>
                <p className="text-white/60 text-xs truncate">Multi-Vendor</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <span className="text-[#1e3a5f] font-black text-xs leading-none">TOI</span>
            </div>
          )}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 rounded-lg hover:bg-white/10 text-white/70"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? label : undefined}
                className={cn(
                  'flex items-center gap-3 mx-2 my-0.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-white/20 text-white shadow-sm'
                    : 'text-white/70 hover:bg-white/10 hover:text-white',
                  collapsed && 'justify-center px-2'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={cn(
          'border-t border-white/10 p-3 flex items-center flex-shrink-0',
          collapsed ? 'flex-col gap-2' : 'gap-2'
        )}>
          <ThemeToggle />
          <button
            onClick={() => setCollapsed(c => !c)}
            className="hidden lg:flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors text-xs ml-auto"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed
              ? <ChevronRight className="w-4 h-4" />
              : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>
            }
          </button>
        </div>
      </aside>

      {/* Main content offset */}
      <div className={cn(
        'hidden lg:block flex-shrink-0 transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
      )} />
    </>
  );
}
