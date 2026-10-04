'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CalendarClock, Phone, RefreshCw, Filter, Search, ArrowRight,
  CheckCircle2, Clock, Building2, User, Download, AlertCircle, X,
  Calendar, ChevronLeft, ChevronRight
} from 'lucide-react';
import { formatDate, calculateDaysRemaining, cn } from '@/lib/utils';
import { format, addYears, addMonths, parseISO } from 'date-fns';

export default function RenewalsPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const today = new Date();
  const currentMonthKey = format(today, 'yyyy-MM');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);

  // Quick renew state
  const [activeCustomer, setActiveCustomer] = useState<any>(null);
  const [renewStartDate, setRenewStartDate] = useState('');
  const [renewEndDate, setRenewEndDate] = useState('');
  const [renewing, setRenewing] = useState(false);

  // Fetch vendors once
  useEffect(() => {
    fetch('/api/vendors')
      .then((r) => r.json())
      .then((vData) => {
        if (vData.vendors) setVendors(vData.vendors);
      })
      .catch((err) => console.error('Failed to load vendors:', err));
  }, []);

  // Fetch renewals when selectedMonth changes
  useEffect(() => {
    async function fetchRenewals() {
      try {
        setLoading(true);
        let url = '/api/customers?limit=1000';
        if (selectedMonth && selectedMonth !== 'all') {
          url = `/api/customers?expiry=${selectedMonth}&limit=1000`;
        }
        const res = await fetch(url);
        const data = await res.json();
        if (data.customers) {
          setCustomers(data.customers);
        } else {
          setCustomers([]);
        }
      } catch (err) {
        console.error('Failed to load renewals:', err);
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    }
    fetchRenewals();
  }, [selectedMonth]);

  function handleStepMonth(delta: number) {
    if (selectedMonth === 'all') {
      setSelectedMonth(currentMonthKey);
      return;
    }
    try {
      const [y, m] = selectedMonth.split('-').map(Number);
      const dateObj = new Date(y, m - 1 + delta, 1);
      setSelectedMonth(format(dateObj, 'yyyy-MM'));
    } catch {
      setSelectedMonth(currentMonthKey);
    }
  }

  const isAllMonths = selectedMonth === 'all';
  const isCurrentMonth = selectedMonth === currentMonthKey;

  let displayMonthTitle = 'All Months';
  if (!isAllMonths) {
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const dateObj = new Date(year, month - 1, 1);
      displayMonthTitle = format(dateObj, 'MMMM yyyy');
    } catch {
      displayMonthTitle = selectedMonth;
    }
  }

  function handleOpenRenew(c: any) {
    setActiveCustomer(c);
    const endStr = c.subscriptions?.[0]?.end_date;
    try {
      const prevEnd = parseISO(endStr);
      const nextStart = new Date(prevEnd);
      nextStart.setDate(nextStart.getDate() + 1);
      const nextEnd = addYears(nextStart, 1);
      nextEnd.setDate(nextEnd.getDate() - 1);
      setRenewStartDate(format(nextStart, 'yyyy-MM-dd'));
      setRenewEndDate(format(nextEnd, 'yyyy-MM-dd'));
    } catch {
      setRenewStartDate(format(today, 'yyyy-MM-dd'));
      setRenewEndDate(format(addYears(today, 1), 'yyyy-MM-dd'));
    }
  }

  async function handleRenewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCustomer || !renewStartDate || !renewEndDate) return;
    try {
      setRenewing(true);
      const res = await fetch(`/api/customers/${activeCustomer.id}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: renewStartDate, end_date: renewEndDate }),
      });
      const data = await res.json();
      if (data.subscription) {
        // Remove from list since it is renewed
        setCustomers((prev) => prev.filter((c) => c.id !== activeCustomer.id));
        setActiveCustomer(null);
      }
    } catch (err: any) {
      alert('Failed to renew: ' + err.message);
    } finally {
      setRenewing(false);
    }
  }

  const filteredCustomers = customers.filter((c) => {
    const matchesVendor =
      !selectedVendor ||
      c.vendor_id === selectedVendor ||
      c.vendor_name?.toLowerCase() === selectedVendor.toLowerCase() ||
      c.vendors?.vendor_name?.toLowerCase() === selectedVendor.toLowerCase();

    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      c.customer_name?.toLowerCase().includes(q) ||
      c.order_id?.toLowerCase().includes(q) ||
      c.mobile_number?.includes(q) ||
      c.address?.toLowerCase().includes(q);

    return matchesVendor && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white p-6 rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-black/20 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
              <CalendarClock className="w-3.5 h-3.5" />
              <span>
                {isCurrentMonth
                  ? `Current Month Alone (${displayMonthTitle})`
                  : isAllMonths
                  ? 'All Upcoming Renewals'
                  : `Selected Month: ${displayMonthTitle}`}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Upcoming Renewals — {displayMonthTitle}
            </h1>
            <p className="text-white/80 text-sm mt-1">
              {isAllMonths
                ? 'Viewing all upcoming renewals. Filter by any month and year anytime below.'
                : `Active subscriptions expiring during ${displayMonthTitle}. Select any month and year below to plan renewals in advance.`}
            </p>
          </div>
          <div className="text-left sm:text-right bg-white/10 px-5 py-3 rounded-xl border border-white/20 whitespace-nowrap">
            <span className="text-xs uppercase font-medium text-white/80 block">
              {isAllMonths ? 'Total Renewals' : `Total Due in ${displayMonthTitle}`}
            </span>
            <span className="text-3xl font-black">{customers.length}</span>
          </div>
        </div>
      </div>

      {/* Filter and Month & Year Selection Bar */}
      <div className="bg-white dark:bg-gray-900 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        {/* Month & Year Navigation & Quick Jump Pills */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1e3a5f] dark:text-blue-400 uppercase tracking-wider">
              <Calendar className="w-4 h-4 stroke-[2.5]" />
              <span>Select Month & Year:</span>
            </div>

            <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800/80 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => handleStepMonth(-1)}
                className="p-1.5 hover:bg-white dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <input
                type="month"
                id="renewals-month-picker"
                value={isAllMonths ? '' : selectedMonth}
                onChange={(e) => {
                  if (e.target.value) setSelectedMonth(e.target.value);
                }}
                className="px-2.5 py-1 text-sm font-bold bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg border border-gray-200 dark:border-gray-700 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/25 cursor-pointer"
              />

              <button
                type="button"
                onClick={() => handleStepMonth(1)}
                className="p-1.5 hover:bg-white dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <span className="text-xs sm:text-sm font-extrabold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800">
              {displayMonthTitle}
            </span>
          </div>

          {/* Quick Jump Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-gray-500 mr-1 hidden sm:inline">Quick Jump:</span>

            <button
              type="button"
              onClick={() => setSelectedMonth(currentMonthKey)}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-xl transition-all border",
                selectedMonth === currentMonthKey
                  ? "bg-[#1e3a5f] text-white border-[#1e3a5f] shadow-sm"
                  : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
              )}
            >
              Current Month ({format(today, 'MMM yyyy')})
            </button>

            <button
              type="button"
              onClick={() => setSelectedMonth(format(addMonths(today, 1), 'yyyy-MM'))}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-xl transition-all border",
                selectedMonth === format(addMonths(today, 1), 'yyyy-MM')
                  ? "bg-[#1e3a5f] text-white border-[#1e3a5f] shadow-sm"
                  : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
              )}
            >
              Next Month ({format(addMonths(today, 1), 'MMM yyyy')})
            </button>

            <button
              type="button"
              onClick={() => setSelectedMonth(format(addMonths(today, 2), 'yyyy-MM'))}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-xl transition-all border",
                selectedMonth === format(addMonths(today, 2), 'yyyy-MM')
                  ? "bg-[#1e3a5f] text-white border-[#1e3a5f] shadow-sm"
                  : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
              )}
            >
              {format(addMonths(today, 2), 'MMM yyyy')}
            </button>

            <button
              type="button"
              onClick={() => setSelectedMonth('all')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-xl transition-all border",
                isAllMonths
                  ? "bg-[#1e3a5f] text-white border-[#1e3a5f] shadow-sm"
                  : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
              )}
            >
              All Months
            </button>
          </div>
        </div>

        {/* Search Bar & Vendor Filter */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Prominent Large Search Bar */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-[#1e3a5f] dark:text-blue-400 stroke-[2.2] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              id="renewals-search-input"
              placeholder="Search renewals by customer name, order ID, phone number or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-10 py-3 text-sm sm:text-base rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/25 focus:border-[#1e3a5f] transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Vendor Filter & Count Controls */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
            <div className="flex items-center gap-2 flex-1 sm:flex-initial">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#1e3a5f] dark:text-blue-400 uppercase tracking-wider px-1 hidden sm:flex">
                <Filter className="w-4 h-4 text-[#1e3a5f] dark:text-blue-400 stroke-[2.5]" />
                <span>Vendor:</span>
              </div>
              <select
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                className="w-full sm:w-52 px-3.5 py-3 text-sm rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/25 focus:border-[#1e3a5f]"
              >
                <option value="">All Vendors ({vendors.length})</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.vendor_name}>
                    {v.vendor_name}
                  </option>
                ))}
              </select>
            </div>

            {selectedVendor && (
              <button
                onClick={() => setSelectedVendor('')}
                className="px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold flex items-center gap-1 transition-colors"
                title="Reset vendor filter"
              >
                <X className="w-3.5 h-3.5 text-red-500" />
                <span>Reset</span>
              </button>
            )}

            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 whitespace-nowrap">
              Showing <strong className="text-gray-900 dark:text-white">{filteredCustomers.length}</strong> renewals
            </span>
          </div>
        </div>
      </div>

      {/* Renewals Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Loading renewals for {displayMonthTitle}...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-16 text-center text-gray-400 dark:text-gray-600">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500 opacity-60" />
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-200 mb-1">
              No Renewals Found
            </h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {selectedVendor || searchTerm
                ? 'No matching customer renewals found for the selected filter.'
                : `No customer subscriptions are expiring in ${displayMonthTitle}. You can select any other month and year above.`}
            </p>
          </div>
        ) : (
          <>
            {/* MOBILE COMPACT CARDS VIEW (No horizontal sliding needed on mobile phones!) */}
            <div className="block md:hidden divide-y divide-gray-100 dark:divide-gray-800">
              {filteredCustomers.map((c) => {
                const sub = c.subscriptions?.[0];
                const days = calculateDaysRemaining(sub?.end_date || '', today);
                const vName = c.vendor_name || c.vendors?.vendor_name || 'Unassigned';

                return (
                  <div
                    key={c.id}
                    className="p-4 hover:bg-amber-50/40 dark:hover:bg-amber-950/10 transition-colors space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/customers/${c.id}`}
                          className="font-bold text-sm text-gray-900 dark:text-gray-100 hover:text-blue-600 block truncate"
                        >
                          {c.customer_name}
                        </Link>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {c.address || c.depot || '—'}
                        </p>
                      </div>

                      <span
                        className={cn(
                          'text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0',
                          days <= 5
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400'
                        )}
                      >
                        {days <= 0 ? 'Expires Today' : `${days}d left`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                      <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">
                        <Building2 className="w-3 h-3" />
                        <span>{vName}</span>
                      </span>

                      <span className="font-mono text-gray-500">
                        {c.order_id || '—'}
                      </span>

                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        Exp: {formatDate(sub?.end_date)}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                      {c.mobile_number && (
                        <a
                          href={`tel:${c.mobile_number}`}
                          className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Call</span>
                        </a>
                      )}
                      <button
                        onClick={() => handleOpenRenew(c)}
                        className="flex-1 py-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-gray-900 text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-1 transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Renew Subscription</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP TABLE VIEW */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-600 dark:text-gray-400">
                    <th className="py-3.5 px-4">Customer Details</th>
                    <th className="py-3.5 px-4">Assigned Vendor</th>
                    <th className="py-3.5 px-4">Order ID</th>
                    <th className="py-3.5 px-4">Expiry Date</th>
                    <th className="py-3.5 px-4">Days Left</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredCustomers.map((c) => {
                    const sub = c.subscriptions?.[0];
                    const days = calculateDaysRemaining(sub?.end_date || '', today);
                    const vName = c.vendor_name || c.vendors?.vendor_name || 'Unassigned';

                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-amber-50/40 dark:hover:bg-amber-950/10 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <Link
                            href={`/customers/${c.id}`}
                            className="font-bold text-gray-900 dark:text-gray-100 hover:text-blue-600 hover:underline block"
                          >
                            {c.customer_name}
                          </Link>
                          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate mt-0.5">
                            {c.address || c.depot || '—'}
                          </p>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium text-xs">
                            <Building2 className="w-3.5 h-3.5" />
                            <span>{vName}</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-xs font-mono font-medium text-gray-600 dark:text-gray-300">
                          {c.order_id || '—'}
                        </td>

                        <td className="py-3.5 px-4 text-xs font-semibold text-gray-900 dark:text-gray-100">
                          {formatDate(sub?.end_date)}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={cn(
                              'text-xs font-bold px-2.5 py-1 rounded-full',
                              days <= 5
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400'
                            )}
                          >
                            {days <= 0 ? 'Expires Today' : `${days} days`}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {c.mobile_number && (
                              <a
                                href={`tel:${c.mobile_number}`}
                                className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 hover:bg-emerald-100 transition-colors"
                                title={`Call ${c.mobile_number}`}
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button
                              onClick={() => handleOpenRenew(c)}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-gray-900 text-xs font-bold rounded-lg shadow-sm flex items-center gap-1 transition-colors"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Renew</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Quick Renew Modal */}
      {activeCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 animate-scaleIn text-gray-900 modal-card"
            style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
          >
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-gray-900" style={{ color: '#0f172a' }}>
                  Renew Subscription
                </h3>
              </div>
              <button
                onClick={() => setActiveCustomer(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenewSubmit} className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs space-y-1 text-gray-800" style={{ backgroundColor: '#f8fafc', color: '#1e293b' }}>
                <p>
                  <strong>Customer:</strong> {activeCustomer.customer_name}
                </p>
                <p>
                  <strong>Vendor:</strong> {activeCustomer.vendor_name || activeCustomer.vendors?.vendor_name}
                </p>
                <p>
                  <strong>Current Expiry:</strong> {formatDate(activeCustomer.subscriptions?.[0]?.end_date)}
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-800 block mb-1" style={{ color: '#1e293b' }}>
                  New Start Date
                </label>
                <input
                  type="date"
                  required
                  value={renewStartDate}
                  onChange={(e) => setRenewStartDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border-2 border-gray-300 bg-white text-gray-900 font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 modal-input"
                  style={{ color: '#0f172a', backgroundColor: '#ffffff', WebkitTextFillColor: '#0f172a' }}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-800 block mb-1" style={{ color: '#1e293b' }}>
                  New Expiry Date (1 Year)
                </label>
                <input
                  type="date"
                  required
                  value={renewEndDate}
                  onChange={(e) => setRenewEndDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border-2 border-gray-300 bg-white text-gray-900 font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 modal-input"
                  style={{ color: '#0f172a', backgroundColor: '#ffffff', WebkitTextFillColor: '#0f172a' }}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setActiveCustomer(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renewing}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-gray-900 text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  {renewing ? 'Renewing...' : 'Confirm Renewal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
