import { getAllVendors, getAllCustomers } from '@/lib/data-source';
import { formatDate, calculateStatus, calculateDaysRemaining } from '@/lib/utils';
import {
  Users, CheckCircle, CalendarClock, XCircle, UserCheck, ArrowRight,
  ChevronRight, Building2
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

async function getDashboardData() {
  const [vendors, { customers }] = await Promise.all([
    getAllVendors(),
    getAllCustomers({ limit: 500 }),
  ]);

  const today = new Date();
  const currentMonth = format(today, 'MMMM yyyy');

  const stats = {
    total: customers.length,
    active: 0,
    expiringThisMonth: 0,
    expired: 0,
    totalVendors: vendors.length,
  };

  const thisMonthRenewals: typeof customers = [];
  const recentlyExpired: typeof customers = [];

  customers.forEach((c: any) => {
    const sub = c.subscriptions?.[0];
    if (!sub) return;
    const status = c.computed_status || calculateStatus(sub.end_date, today);
    if (status === 'active') {
      stats.active++;
    } else if (status === 'expiring_this_month') {
      stats.expiringThisMonth++;
      thisMonthRenewals.push(c);
    } else if (status === 'expired') {
      stats.expired++;
      recentlyExpired.push(c);
    }
  });

  // Sort upcoming renewals by end date ascending
  const sortByEnd = (a: any, b: any) =>
    (a?.subscriptions?.[0]?.end_date || '').localeCompare(b?.subscriptions?.[0]?.end_date || '');

  return {
    stats,
    vendors: vendors.slice(0, 8),
    thisMonthRenewals: thisMonthRenewals.sort(sortByEnd).slice(0, 8),
    recentlyExpired: recentlyExpired.sort(sortByEnd).slice(0, 6),
    currentMonth,
    today,
  };
}

export default async function DashboardPage() {
  const { stats, vendors, thisMonthRenewals, recentlyExpired, currentMonth, today } =
    await getDashboardData();

  const kpiCards = [
    {
      label: 'Total Customers',
      value: stats.total,
      icon: Users,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      border: 'border-blue-100 dark:border-blue-900',
      href: '/customers',
    },
    {
      label: 'Active Subscriptions',
      value: stats.active,
      icon: CheckCircle,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-100 dark:border-emerald-900',
      href: '/customers?status=active',
    },
    {
      label: `Upcoming Renewals (${currentMonth})`,
      value: stats.expiringThisMonth,
      icon: CalendarClock,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-100 dark:border-amber-900',
      href: '/renewals',
      highlight: true,
    },
    {
      label: 'Expired Subscriptions',
      value: stats.expired,
      icon: XCircle,
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      border: 'border-rose-100 dark:border-rose-900',
      href: '/customers?status=expired',
    },
    {
      label: 'Managed Vendors',
      value: stats.totalVendors,
      icon: UserCheck,
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
      border: 'border-indigo-100 dark:border-indigo-900',
      href: '/vendors',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner / Title */}
      <div className="dash-banner flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl shadow-sm">
        <div>
          <span className="inline-block px-2.5 py-1 text-xs font-semibold uppercase tracking-wider bg-white/15 text-white/90 rounded-md mb-2">
            Multi-Vendor Distribution Portal
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Times of India Admin</h1>
          <p className="text-white/70 text-sm mt-1">
            Tracking {stats.total} customers across {stats.totalVendors} distribution vendors in Royapuram &amp; Chennai
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/renewals"
            className="renewal-badge px-4 py-2.5 text-xs rounded-xl shadow transition-all flex items-center gap-2"
          >
            <CalendarClock className="w-4 h-4" />
            <span>{stats.expiringThisMonth} Renewals This Month</span>
          </Link>
          <Link
            href="/reports"
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl transition-all border border-white/20"
          >
            Generate Reports
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {kpiCards.map(({ label, value, icon: Icon, color, bg, border, href, highlight }) => {
          return (
            <Link
              key={label}
              href={href}
              className={cn(
                'metric-card group relative p-4 rounded-xl transition-all',
                highlight && 'ring-2 ring-amber-400/40 dark:ring-amber-500/25'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 leading-tight">
                  {label}
                </span>
                <div className={cn('p-2 rounded-lg', bg)}>
                  <Icon className={cn('w-4 h-4', color)} />
                </div>
              </div>
              <div className="mt-3">
                <p className={cn('text-2xl font-black', highlight ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white')}>
                  {value}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Main Grid: Upcoming Renewals & Vendor Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Renewals for Current Month */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                <CalendarClock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900 dark:text-gray-100 text-base">
                  Upcoming Renewals — {currentMonth} Alone
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Customers requiring immediate subscription renewal this month
                </p>
              </div>
            </div>
            <Link
              href="/renewals"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
            >
              <span>View all ({stats.expiringThisMonth})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {thisMonthRenewals.length === 0 ? (
              <div className="py-12 text-center text-gray-400 dark:text-gray-600">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50 text-emerald-500" />
                <p className="text-sm font-medium">All subscriptions are up to date for this month!</p>
              </div>
            ) : (
              thisMonthRenewals.map((customer: any) => {
                const sub = customer.subscriptions?.[0];
                const days = calculateDaysRemaining(sub?.end_date || '', today);
                return (
                  <div
                    key={customer.id}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-bold flex items-center justify-center text-sm flex-shrink-0">
                        {customer.customer_name?.charAt(0) || 'C'}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/customers/${customer.id}`}
                          className="font-semibold text-sm text-gray-900 dark:text-gray-100 hover:underline truncate block"
                        >
                          {customer.customer_name}
                        </Link>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          Vendor: <span className="font-medium text-gray-700 dark:text-gray-300">{customer.vendors?.vendor_name || customer.vendor_name}</span> · Expiry: {formatDate(sub?.end_date)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={cn(
                        'text-xs font-semibold px-2.5 py-1 rounded-full',
                        days <= 5
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                      )}>
                        {days <= 0 ? 'Expires today' : `${days} days left`}
                      </span>
                      <Link
                        href={`/customers/${customer.id}`}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Vendors Distribution Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                <Building2 className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-gray-900 dark:text-gray-100 text-base">Vendors Breakdown</h2>
            </div>
            <Link
              href="/vendors"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              All Vendors
            </Link>
          </div>

          <div className="p-4 divide-y divide-gray-100 dark:divide-gray-800 flex-1">
            {vendors.map((v: any) => (
              <div key={v.id} className="py-2.5 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span className="font-medium text-gray-800 dark:text-gray-200">{v.vendor_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                    {v.customer_count} customers
                  </span>
                  <Link
                    href={`/customers?vendor=${encodeURIComponent(v.vendor_name)}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800 text-center">
            <Link
              href="/reports"
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Export Multi-Vendor Reports PDF →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
