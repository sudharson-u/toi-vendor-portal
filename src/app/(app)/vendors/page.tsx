'use client';

import { useState, useEffect } from 'react';
import { UserCheck, Plus, Users, Phone, Edit, Trash2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import Modal from '@/components/ui/Modal';

interface Vendor {
  id: string;
  vendor_name: string;
  mobile_number?: string;
  created_at: string;
  customer_count?: number;
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editVendor, setEditVendor] = useState<Vendor | null>(null);
  const [form, setForm] = useState({ vendor_name: '', mobile_number: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function fetchVendors() {
    setLoading(true);
    try {
      const res = await fetch('/api/vendors');
      const data = await res.json();
      setVendors(data.vendors || []);
    } catch {
      setVendors([]);
    }
    setLoading(false);
  }

  useEffect(() => { fetchVendors(); }, []);

  const filtered = vendors.filter(v =>
    v.vendor_name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSave() {
    if (!form.vendor_name.trim()) { setError('Vendor name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const url = editVendor ? `/api/vendors/${editVendor.id}` : '/api/vendors';
      const method = editVendor ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed');
      setShowAdd(false);
      setEditVendor(null);
      setForm({ vendor_name: '', mobile_number: '' });
      fetchVendors();
    } catch {
      setError('Failed to save vendor. Please try again.');
    }
    setSaving(false);
  }

  function openAdd() {
    setForm({ vendor_name: '', mobile_number: '' });
    setEditVendor(null);
    setError('');
    setShowAdd(true);
  }

  function openEdit(v: Vendor) {
    setForm({ vendor_name: v.vendor_name, mobile_number: v.mobile_number || '' });
    setEditVendor(v);
    setError('');
    setShowAdd(true);
  }

  async function handleDelete(v: Vendor) {
    if (!confirm(`Delete vendor "${v.vendor_name}"? This will unassign all their customers.`)) return;
    await fetch(`/api/vendors/${v.id}`, { method: 'DELETE' });
    fetchVendors();
  }

  return (
    <div className="page-container animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Vendors</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{vendors.length} vendors managing customer subscriptions</p>
        </div>
        <div className="sm:ml-auto flex gap-2">
          <button onClick={openAdd} className="btn-primary text-sm">
            <Plus className="w-4 h-4" />
            Add Vendor
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#1e3a5f] dark:text-blue-400 stroke-[2.2] pointer-events-none" />
        <input
          className="w-full pl-11 pr-4 py-2.5 text-sm sm:text-base rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/25 focus:border-[#1e3a5f]"
          placeholder="Search vendors by name or code..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Vendors Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-gray-400 dark:text-gray-600">
          <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No vendors found</p>
          <p className="text-sm mt-1">Add a vendor to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((vendor) => (
            <div key={vendor.id} className="card p-4 hover:shadow-md transition-all duration-200">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#1e3a5f]/10 dark:bg-[#1e3a5f]/30 flex items-center justify-center">
                  <span className="text-[#1e3a5f] dark:text-blue-300 font-bold text-sm">
                    {vendor.vendor_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(vendor)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(vendor)}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-1 truncate">
                {vendor.vendor_name}
              </h3>

              {vendor.mobile_number && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <Phone className="w-3 h-3 flex-shrink-0" />
                  <span>{vendor.mobile_number}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {vendor.customer_count ?? 0} customers
                  </span>
                </div>
                <a
                  href={`/customers?vendor=${encodeURIComponent(vendor.vendor_name)}`}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  View Customers →
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showAdd}
        onClose={() => { setShowAdd(false); setEditVendor(null); }}
        title={editVendor ? 'Edit Vendor' : 'Add Vendor'}
        maxWidth="max-w-md"
      >
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Vendor Name *</label>
            <input
              className="input text-base sm:text-sm"
              placeholder="e.g. Arumugam"
              value={form.vendor_name}
              onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Mobile Number</label>
            <input
              className="input text-base sm:text-sm"
              placeholder="e.g. 9876543210"
              value={form.mobile_number}
              onChange={e => setForm(f => ({ ...f, mobile_number: e.target.value }))}
            />
          </div>
          {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2 justify-end pt-3 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={() => { setShowAdd(false); setEditVendor(null); }}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-primary text-sm shadow-md"
            >
              {saving ? 'Saving...' : editVendor ? 'Save Changes' : 'Add Vendor'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
