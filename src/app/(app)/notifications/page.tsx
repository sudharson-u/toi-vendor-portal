'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Bell, Phone, MessageSquare, CalendarClock, CheckCircle2,
  Building2, Send, ExternalLink, RefreshCw
} from 'lucide-react';
import { formatDate, calculateDaysRemaining, cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function NotificationsPage() {
  const [expiringCustomers, setExpiringCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const currentMonthName = format(today, 'MMMM yyyy');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch('/api/customers?status=expiring_this_month&limit=200');
        const data = await res.json();
        if (data.customers) setExpiringCustomers(data.customers);
      } catch (err) {
        console.error('Failed to load notifications:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  function sendWhatsAppReminder(customer: any) {
    const sub = customer.subscriptions?.[0];
    const expiry = formatDate(sub?.end_date);
    const vName = customer.vendor_name || customer.vendors?.vendor_name || 'TOI Distribution';
    const text = encodeURIComponent(
      `Dear ${customer.customer_name}, your Times of India annual newspaper subscription is expiring on ${expiry}. Please renew your subscription through your vendor (${vName}) to avoid any interruption in delivery. Thank you!`
    );
    const phone = customer.mobile_number ? customer.mobile_number.replace(/\D/g, '') : '';
    const url = phone ? `https://wa.me/91${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#1e3a5f] text-white p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-block px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-white/20 rounded-md mb-2">
            Renewal Reminders
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Notifications Hub</h1>
          <p className="text-white/80 text-sm mt-1">
            All customer renewals upcoming for {currentMonthName} alone. Send WhatsApp or phone alerts directly.
          </p>
        </div>

        <div className="bg-white/10 px-5 py-3 rounded-xl border border-white/20 text-center sm:text-right">
          <span className="text-xs uppercase font-medium text-white/80 block">Due Reminders</span>
          <span className="text-3xl font-black">{expiringCustomers.length}</span>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-500" />
            <span>Pending Notifications for {currentMonthName}</span>
          </h2>
          <span className="text-xs font-semibold text-gray-500">
            {expiringCustomers.length} active alerts
          </span>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading renewal notifications...</p>
          </div>
        ) : expiringCustomers.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500 opacity-60" />
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">No Reminders Needed</h3>
            <p className="text-xs text-gray-500 mt-1">All customers have been renewed or have active terms.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {expiringCustomers.map((c) => {
              const sub = c.subscriptions?.[0];
              const days = calculateDaysRemaining(sub?.end_date || '', today);
              const vName = c.vendor_name || c.vendors?.vendor_name || 'Unassigned';

              return (
                <div
                  key={c.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-bold flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
                      {c.customer_name?.charAt(0) || 'C'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/customers/${c.id}`}
                          className="font-bold text-sm text-gray-900 dark:text-gray-100 hover:text-blue-600 hover:underline"
                        >
                          {c.customer_name}
                        </Link>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium">
                          {vName}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Expires {formatDate(sub?.end_date)} ({days <= 0 ? 'Today' : `${days} days left`}) · Order ID: {c.order_id || '—'}
                      </p>
                      {c.address && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-md mt-0.5">
                          {c.address}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {c.mobile_number && (
                      <a
                        href={`tel:${c.mobile_number}`}
                        className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5 text-blue-600" />
                        <span>Call</span>
                      </a>
                    )}
                    <button
                      onClick={() => sendWhatsAppReminder(c)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>
                    <Link
                      href={`/customers/${c.id}`}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-gray-900 text-xs font-bold rounded-lg shadow-sm flex items-center gap-1 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Renew</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
