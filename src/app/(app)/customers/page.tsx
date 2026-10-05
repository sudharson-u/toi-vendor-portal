'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search, Filter, Plus, Phone, ArrowUpDown, ChevronLeft, ChevronRight, X, Download, UserCheck } from 'lucide-react';
import { formatDate, calculateStatus, getStatusLabel, getStatusColor, cn } from '@/lib/utils';
import { SubscriptionStatus } from '@/lib/types';
import Modal from '@/components/ui/Modal';

const PAGE_SIZE = 20;

interface CustomerRow {
  id: string;
  customer_id: string;
  customer_name: string;
  address: string;
  mobile_number: string;
  order_id: string;
  vendor_id?: string;
  vendors?: { id: string; vendor_name: string };
  subscriptions: Array<{
    id: string;
    start_date: string;
    end_date: string;
    status: string;
    is_current: boolean;
  }>;
  computed_status?: SubscriptionStatus;
}

interface Vendor {
  id: string;
  vendor_name: string;
}

function CustomersContent() {
  const searchParams = useSearchParams();

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | ''>(
    (searchParams.get('status') as SubscriptionStatus) || ''
  );
  const [vendorFilter, setVendorFilter] = useState(searchParams.get('vendor') || '');
  const [sortBy, setSortBy] = useState('customer_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Fetch vendors for filter
  useEffect(() => {
    fetch('/api/vendors').then(r => r.json()).then(d => setVendors(d.vendors || []));
  }, []);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: search.trim(),
        status: statusFilter,
        vendor: vendorFilter,
        sort: sortBy,
        dir: sortDir,
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      const res = await fetch(`/api/customers?${params}`);
      const data = await res.json();
      setCustomers(data.customers || []);
      setTotal(data.total || 0);
    } catch { setCustomers([]); }
    setLoading(false);
  }, [search, statusFilter, vendorFilter, sortBy, sortDir, page]);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [fetchCustomers]);

  function handleSort(col: string) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
    setPage(1);
  }

  function clearFilters() {
    setSearch(''); setStatusFilter(''); setVendorFilter(''); setPage(1);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const today = new Date();
  const hasFilters = search || statusFilter || vendorFilter;

  return (
    <div className="page-container animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Customers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{total} total records</p>
        </div>
        <div className="sm:ml-auto flex gap-2">
          <Link href="/import" className="btn-secondary text-sm">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </Link>
          <button
            id="add-customer-btn"
            onClick={() => setShowAddModal(true)}
            className="btn-primary text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white dark:bg-gray-900 p-3.5 sm:p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm mb-5 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Main Prominent Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#1e3a5f] dark:text-blue-400 stroke-[2.2] pointer-events-none" />
            <input
              id="customer-search-input"
              className="w-full pl-12 pr-4 py-3 text-sm sm:text-base rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/25 focus:border-[#1e3a5f] transition-all"
              placeholder="Search by customer name, order ID, phone number or address..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns with High-Contrast Filter Icon */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1e3a5f] dark:text-blue-400 uppercase tracking-wider px-1 hidden sm:flex">
              <Filter className="w-4 h-4 text-[#1e3a5f] dark:text-blue-400 stroke-[2.5]" />
              <span>Filter:</span>
            </div>

            <select
              className="flex-1 sm:w-44 px-3.5 py-3 text-sm rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/25 focus:border-[#1e3a5f]"
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value as SubscriptionStatus | ''); setPage(1); }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="expiring_this_month">Expiring This Month</option>
              <option value="expired">Expired</option>
              <option value="renewed">Renewed</option>
            </select>

            <select
              className="flex-1 sm:w-48 px-3.5 py-3 text-sm rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/25 focus:border-[#1e3a5f]"
              value={vendorFilter}
              onChange={e => { setVendorFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Vendors ({vendors.length})</option>
              {vendors.map(v => (
                <option key={v.id} value={v.vendor_name}>{v.vendor_name}</option>
              ))}
            </select>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold flex items-center gap-1 transition-colors"
                title="Clear all filters"
              >
                <X className="w-3.5 h-3.5 text-red-500" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper mb-4">
        <table>
          <thead>
            <tr>
              <th>
                <button onClick={() => handleSort('customer_name')} className="flex items-center gap-1">
                  Customer <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="hidden sm:table-cell">Vendor</th>
              <th className="hidden md:table-cell">Order ID</th>
              <th>Subscription</th>
              <th>Status</th>
              <th className="hidden lg:table-cell">Phone</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {[1,2,3,4,5,6].map(j => (
                    <td key={j}><div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400 dark:text-gray-600">
                  No customers found
                </td>
              </tr>
            ) : (
              customers.map((c) => {
                const sub = c.subscriptions?.[0];
                const status = c.computed_status || calculateStatus(sub?.end_date || '', today);
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/customers/${c.id}`} className="hover:text-[#1e3a5f] dark:hover:text-blue-300 transition-colors block">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">{c.customer_name}</div>
                        <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5 flex items-center gap-1">
                          <span>Vendor: {c.vendors?.vendor_name || (c as any).vendor_name || 'Unassigned'}</span>
                        </div>
                      </Link>
                    </td>
                    <td className="hidden sm:table-cell">
                      <div className="flex items-center gap-1.5">
                        <UserCheck className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <span className="text-xs">{c.vendors?.vendor_name || '—'}</span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{c.order_id || '—'}</span>
                    </td>
                    <td>
                      <div className="text-xs">
                        <span className="text-gray-900 dark:text-gray-100">{formatDate(sub?.end_date)}</span>
                        {sub?.start_date && (
                          <div className="text-gray-400 dark:text-gray-500">{formatDate(sub.start_date)}</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={cn('badge', getStatusColor(status))}>
                        {getStatusLabel(status)}
                      </span>
                    </td>
                    <td className="hidden lg:table-cell">
                      {c.mobile_number ? (
                        <a href={`tel:${c.mobile_number}`} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-[#1e3a5f] dark:hover:text-blue-300 transition-colors">
                          <Phone className="w-3 h-3" />
                          {c.mobile_number}
                        </a>
                      ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary text-sm disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-secondary text-sm disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <AddCustomerModal
          vendors={vendors}
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); fetchCustomers(); }}
        />
      )}
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-500">Loading customers...</p>
        </div>
      }
    >
      <CustomersContent />
    </Suspense>
  );
}

function AddCustomerModal({ vendors, onClose, onSaved }: {
  vendors: Vendor[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    customer_name: '', customer_id: '', address: '', mobile_number: '',
    order_id: '', notes: '', vendor_id: '', start_date: '', end_date: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_name.trim()) { setError('Customer name is required'); return; }
    if (!form.start_date || !form.end_date) { setError('Start and end dates are required'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed');
      }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    }
    setSaving(false);
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Add Customer"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3.5">
          <div className="col-span-2">
            <label className="label">Customer Name *</label>
            <input
              className="input text-base sm:text-sm"
              placeholder="e.g. Ramesh Kumar"
              value={form.customer_name}
              onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Customer ID</label>
            <input
              className="input text-base sm:text-sm"
              placeholder="e.g. CUST-1001"
              value={form.customer_id}
              onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Order ID</label>
            <input
              className="input text-base sm:text-sm"
              placeholder="e.g. 50012345"
              value={form.order_id}
              onChange={e => setForm(f => ({ ...f, order_id: e.target.value }))}
            />
          </div>
          <div className="col-span-2">
            <label className="label">Vendor</label>
            <select
              className="input text-base sm:text-sm"
              value={form.vendor_id}
              onChange={e => setForm(f => ({ ...f, vendor_id: e.target.value }))}
            >
              <option value="">Select vendor...</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.vendor_name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Address</label>
            <input
              className="input text-base sm:text-sm"
              placeholder="Delivery address..."
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Mobile</label>
            <input
              className="input text-base sm:text-sm"
              type="tel"
              placeholder="e.g. 9876543210"
              value={form.mobile_number}
              onChange={e => setForm(f => ({ ...f, mobile_number: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Notes</label>
            <input
              className="input text-base sm:text-sm"
              placeholder=""
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Start Date *</label>
            <input
              className="input text-base sm:text-sm"
              type="date"
              value={form.start_date}
              onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">End Date *</label>
            <input
              className="input text-base sm:text-sm"
              type="date"
              value={form.end_date}
              onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
            />
          </div>
        </div>
        {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-2 justify-end pt-3 border-t border-gray-100 dark:border-gray-800">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary text-sm shadow-md">
            {saving ? 'Adding...' : 'Add Customer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
