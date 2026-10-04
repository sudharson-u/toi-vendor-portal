'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Phone, Calendar, RefreshCw, Edit3, Trash2, CheckCircle2,
  AlertTriangle, Clock, Building2, MapPin, User, FileText, Check, X,
  Share2, MessageSquare, StickyNote, Copy, AlertOctagon
} from 'lucide-react';
import { formatDate, calculateStatus, calculateDaysRemaining, getStatusLabel, getStatusColor, cn } from '@/lib/utils';
import { format, addYears, parseISO } from 'date-fns';

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [customer, setCustomer] = useState<any>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Notes state
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // Edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    customer_name: '',
    mobile_number: '',
    address: '',
    order_id: '',
    vendor_name: '',
    notes: '',
  });

  // Delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Share state
  const [copiedShare, setCopiedShare] = useState(false);

  // Renew modal
  const [showRenew, setShowRenew] = useState(false);
  const [renewStartDate, setRenewStartDate] = useState('');
  const [renewEndDate, setRenewEndDate] = useState('');
  const [renewing, setRenewing] = useState(false);

  useEffect(() => {
    async function fetchCustomer() {
      try {
        setLoading(true);
        const [cRes, vRes] = await Promise.all([
          fetch(`/api/customers/${id}`),
          fetch('/api/vendors'),
        ]);

        const cData = await cRes.json();
        const vData = await vRes.json();

        if (cData.customer) {
          setCustomer(cData.customer);
          setNotes(cData.customer.notes || '');
          setEditForm({
            customer_name: cData.customer.customer_name || '',
            mobile_number: cData.customer.mobile_number || '',
            address: cData.customer.address || '',
            order_id: cData.customer.order_id || '',
            vendor_name: cData.customer.vendor_name || cData.customer.vendors?.vendor_name || '',
            notes: cData.customer.notes || '',
          });

          // Set default renew dates
          const currentEnd = cData.customer.subscriptions?.[0]?.end_date;
          if (currentEnd) {
            try {
              const prevEnd = parseISO(currentEnd);
              const nextStart = new Date(prevEnd);
              nextStart.setDate(nextStart.getDate() + 1);
              const nextEnd = addYears(nextStart, 1);
              nextEnd.setDate(nextEnd.getDate() - 1);
              setRenewStartDate(format(nextStart, 'yyyy-MM-dd'));
              setRenewEndDate(format(nextEnd, 'yyyy-MM-dd'));
            } catch {
              const now = new Date();
              setRenewStartDate(format(now, 'yyyy-MM-dd'));
              setRenewEndDate(format(addYears(now, 1), 'yyyy-MM-dd'));
            }
          }
        } else {
          setError(cData.error || 'Customer not found');
        }

        if (vData.vendors) setVendors(vData.vendors);
      } catch (err: any) {
        setError(err.message || 'Failed to load customer');
      } finally {
        setLoading(false);
      }
    }

    fetchCustomer();
  }, [id]);

  // Handle Save Notes
  async function handleSaveNotes() {
    try {
      setSavingNotes(true);
      const res = await fetch(`/api/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      const data = await res.json();
      if (data.customer) {
        setCustomer((prev: any) => ({ ...prev, notes }));
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 2500);
      }
    } catch (err: any) {
      alert('Error saving notes: ' + err.message);
    } finally {
      setSavingNotes(false);
    }
  }

  // Handle Share Customer Details
  function getShareText() {
    const sub = customer?.subscriptions?.[0];
    const vName = customer?.vendor_name || customer?.vendors?.vendor_name || 'Unassigned';
    const start = sub?.start_date ? formatDate(sub.start_date) : 'N/A';
    const end = sub?.end_date ? formatDate(sub.end_date) : 'N/A';

    return `Order ID: ${customer?.order_id || 'N/A'}\nCustomer Name: ${customer?.customer_name || 'N/A'}\nAddress: ${customer?.address || 'N/A'}\nVendor: ${vName}\nStart date and end date: ${start} to ${end}`;
  }

  async function handleShare() {
    const shareText = getShareText();

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Customer: ${customer.customer_name}`,
          text: shareText,
        });
        return;
      } catch (e) {
        // Fallback to clipboard
      }
    }

    // Fallback: Copy to clipboard
    navigator.clipboard.writeText(shareText);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2500);
  }

  function handleShareWhatsApp() {
    const text = encodeURIComponent(getShareText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  // Handle Delete Customer
  async function handleDeleteConfirm() {
    try {
      setDeleting(true);
      const res = await fetch(`/api/customers/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.push('/customers');
      } else {
        const data = await res.json();
        alert('Failed to delete customer: ' + (data.error || 'Server error'));
      }
    } catch (err: any) {
      alert('Error deleting customer: ' + err.message);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.customer) {
        setCustomer((prev: any) => ({
          ...prev,
          ...data.customer,
          vendor_name: editForm.vendor_name,
        }));
        setNotes(editForm.notes || '');
        setShowEdit(false);
      }
    } catch (err: any) {
      alert('Error updating customer: ' + err.message);
    }
  }

  async function handleRenewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!renewStartDate || !renewEndDate) return;
    try {
      setRenewing(true);
      const res = await fetch(`/api/customers/${id}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: renewStartDate, end_date: renewEndDate }),
      });
      const data = await res.json();
      if (data.subscription) {
        setCustomer((prev: any) => ({
          ...prev,
          subscriptions: [data.subscription, ...(prev?.subscriptions || [])],
        }));
        setShowRenew(false);
      }
    } catch (err: any) {
      alert('Error renewing subscription: ' + err.message);
    } finally {
      setRenewing(false);
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Loading customer details...</p>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="py-16 text-center max-w-md mx-auto">
        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Customer Not Found</h2>
        <p className="text-sm text-gray-500 mb-4">{error || "This customer record doesn't exist."}</p>
        <Link href="/customers" className="px-4 py-2 bg-[#1e3a5f] text-white text-xs font-semibold rounded-lg">
          Back to Customer List
        </Link>
      </div>
    );
  }

  const sub = customer.subscriptions?.[0];
  const today = new Date();
  const computedStatus = sub ? calculateStatus(sub.end_date, today) : 'expired';
  const daysLeft = sub ? calculateDaysRemaining(sub.end_date, today) : 0;
  const vendorName = customer.vendor_name || customer.vendors?.vendor_name || 'Unassigned';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Navigation & Action Buttons Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link
          href="/customers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Customers</span>
        </Link>

        {/* Action Buttons: Share, Edit, Renew, Delete */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Share Button */}
          <button
            onClick={handleShare}
            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
            title="Share customer details"
          >
            {copiedShare ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiedShare ? 'Copied Details!' : 'Share'}</span>
          </button>

          {/* WhatsApp Share */}
          <button
            onClick={handleShareWhatsApp}
            className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 transition-colors"
            title="Share directly to WhatsApp"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </button>

          {/* Edit Info */}
          <button
            onClick={() => setShowEdit(true)}
            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>

          {/* Renew Subscription */}
          <button
            onClick={() => setShowRenew(true)}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-gray-900 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Renew</span>
          </button>

          {/* Delete Customer Button */}
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 text-xs font-semibold rounded-lg border border-rose-200 dark:border-rose-800 flex items-center gap-1.5 transition-colors"
            title="Delete this customer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Main Profile Card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-extrabold text-xl flex items-center justify-center flex-shrink-0">
              {customer.customer_name?.charAt(0) || 'C'}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{customer.customer_name}</h1>
                <span className={cn('text-xs font-bold px-2.5 py-0.5 rounded-full border', getStatusColor(computedStatus))}>
                  {getStatusLabel(computedStatus)}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                <span>Order ID: <strong className="text-gray-700 dark:text-gray-300">{customer.order_id || '—'}</strong></span>
                <span>·</span>
                <span>Vendor: <strong className="text-indigo-600 dark:text-indigo-400">{vendorName}</strong></span>
              </p>
            </div>
          </div>

          {customer.mobile_number && (
            <a
              href={`tel:${customer.mobile_number}`}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold hover:bg-emerald-100 transition-colors self-start"
            >
              <Phone className="w-4 h-4" />
              <span>{customer.mobile_number}</span>
            </a>
          )}
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 pt-6">
          <div>
            <span className="text-xs text-gray-400 font-medium flex items-center gap-1.5 mb-1">
              <Building2 className="w-3.5 h-3.5 text-indigo-500" />
              Assigned Vendor
            </span>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{vendorName}</p>
            {customer.vendor_code && (
              <p className="text-xs text-gray-500">{customer.vendor_code}</p>
            )}
          </div>

          <div>
            <span className="text-xs text-gray-400 font-medium flex items-center gap-1.5 mb-1">
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              Depot & Area
            </span>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{customer.depot || 'Royapuram'}</p>
          </div>

          <div>
            <span className="text-xs text-gray-400 font-medium flex items-center gap-1.5 mb-1">
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              Subscription Status
            </span>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {computedStatus === 'expired'
                ? `Expired on ${formatDate(sub?.end_date)}`
                : `${daysLeft} days remaining (${formatDate(sub?.end_date)})`}
            </p>
          </div>

          <div className="sm:col-span-2 md:col-span-3">
            <span className="text-xs text-gray-400 font-medium mb-1 block">Full Address</span>
            <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
              {customer.address || 'No address recorded'}
            </p>
          </div>
        </div>
      </div>

      {/* DEDICATED NOTES SECTION */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-amber-500" />
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Customer Notes</h2>
          </div>
          {notesSaved && (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Notes Saved!
            </span>
          )}
        </div>

        <p className="text-xs text-gray-500">
          Add any delivery instructions, renewal notes, preferred timings, or vendor remarks for this subscriber.
        </p>

        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Deliver to 2nd floor security desk. Prefers morning renewal call..."
          className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none transition-colors"
        />

        <div className="flex justify-end">
          <button
            onClick={handleSaveNotes}
            disabled={savingNotes}
            className="px-4 py-2 bg-[#1e3a5f] hover:bg-[#2d5080] text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {savingNotes ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>{savingNotes ? 'Saving Notes...' : 'Save Notes'}</span>
          </button>
        </div>
      </div>

      {/* Subscription Timeline & History */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          <span>Subscription History</span>
        </h2>

        <div className="space-y-3">
          {(customer.subscriptions || []).map((s: any, idx: number) => {
            const isCurr = s.is_current !== false && idx === 0;
            return (
              <div
                key={s.id || idx}
                className={cn(
                  'p-4 rounded-xl border flex items-center justify-between gap-4',
                  isCurr
                    ? 'border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20'
                    : 'border-gray-100 dark:border-gray-800'
                )}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-900 dark:text-gray-100">
                      {formatDate(s.start_date)} — {formatDate(s.end_date)}
                    </span>
                    {isCurr && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    1 Year Term · Publication: TOI
                  </p>
                </div>

                <div className="text-right">
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-md border', getStatusColor(s.status || computedStatus))}>
                    {getStatusLabel(s.status || computedStatus)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 animate-scaleIn text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto">
              <AlertOctagon className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-gray-100">Confirm Deletion</h3>
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                Are you sure you want to delete customer <strong>{customer.customer_name}</strong>? All associated subscriptions and notes will be permanently removed.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2 px-3 text-xs font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-800 animate-scaleIn">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800 mb-4">
              <h3 className="font-bold text-base text-gray-900 dark:text-gray-100">Edit Customer Information</h3>
              <button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-gray-800 dark:text-gray-200 block mb-1">Customer Name</label>
                <input
                  type="text"
                  required
                  value={editForm.customer_name}
                  onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/25 focus:border-[#1e3a5f]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-800 dark:text-gray-200 block mb-1">Assigned Vendor</label>
                <select
                  value={editForm.vendor_name}
                  onChange={(e) => setEditForm({ ...editForm, vendor_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/25 focus:border-[#1e3a5f]"
                >
                  <option value="">Select Vendor...</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.vendor_name}>
                      {v.vendor_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-800 dark:text-gray-200 block mb-1">Mobile Number</label>
                <input
                  type="text"
                  value={editForm.mobile_number}
                  onChange={(e) => setEditForm({ ...editForm, mobile_number: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/25 focus:border-[#1e3a5f]"
                  placeholder="e.g. 9840123456"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-800 dark:text-gray-200 block mb-1">Order / Coupon ID</label>
                <input
                  type="text"
                  value={editForm.order_id}
                  onChange={(e) => setEditForm({ ...editForm, order_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/25 focus:border-[#1e3a5f]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-800 dark:text-gray-200 block mb-1">Address</label>
                <textarea
                  rows={3}
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold resize-none shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/25 focus:border-[#1e3a5f]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1e3a5f] hover:bg-[#2d5080] text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renew Subscription Modal */}
      {showRenew && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-800 animate-scaleIn">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-gray-900 dark:text-gray-100">Renew Subscription</h3>
              </div>
              <button onClick={() => setShowRenew(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenewSubmit} className="space-y-4">
              <p className="text-xs text-gray-500">
                Renew subscription for <strong>{customer.customer_name}</strong> under vendor <strong>{vendorName}</strong>.
              </p>

              <div>
                <label className="text-xs font-bold text-gray-800 dark:text-gray-200 block mb-1">New Start Date</label>
                <input
                  type="date"
                  required
                  value={renewStartDate}
                  onChange={(e) => setRenewStartDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-800 dark:text-gray-200 block mb-1">New Expiry Date</label>
                <input
                  type="date"
                  required
                  value={renewEndDate}
                  onChange={(e) => setRenewEndDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowRenew(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renewing}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-gray-900 text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  {renewing ? 'Processing...' : 'Confirm Renewal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
