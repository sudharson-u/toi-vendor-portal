'use client';

import { useState, useEffect } from 'react';
import {
  FileText, Download, Printer, Filter, CheckSquare, Square,
  Building2, Calendar, CheckCircle2, ChevronDown, RefreshCw, CalendarDays
} from 'lucide-react';
import { formatDate, getStatusLabel, cn } from '@/lib/utils';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ReportsPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(''); // YYYY-MM
  const [monthFilterType, setMonthFilterType] = useState<'ending' | 'starting' | 'both'>('ending');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    async function loadVendors() {
      try {
        const res = await fetch('/api/vendors');
        const data = await res.json();
        if (data.vendors) {
          setVendors(data.vendors);
          // By default, select all vendors
          setSelectedVendors(data.vendors.map((v: any) => v.vendor_name));
        }
      } catch (err) {
        console.error('Failed to load vendors:', err);
      }
    }
    loadVendors();

    // Default current month
    const now = new Date();
    setSelectedMonth(format(now, 'yyyy-MM'));
  }, []);

  // Fetch report data
  useEffect(() => {
    async function fetchReportData() {
      setLoading(true);
      try {
        const res = await fetch('/api/customers?limit=1000');
        const data = await res.json();
        if (data.customers) {
          setCustomers(data.customers);
        }
      } catch (err) {
        console.error('Failed to load customer report data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchReportData();
  }, []);

  function toggleVendor(vName: string) {
    if (selectedVendors.includes(vName)) {
      setSelectedVendors(selectedVendors.filter((v) => v !== vName));
    } else {
      setSelectedVendors([...selectedVendors, vName]);
    }
  }

  function selectAllVendors() {
    setSelectedVendors(vendors.map((v) => v.vendor_name));
  }

  function clearAllVendors() {
    setSelectedVendors([]);
  }

  // Filter customers by selected vendors, month, date type, status
  const filteredCustomers = customers.filter((c) => {
    const vName = c.vendor_name || c.vendors?.vendor_name;
    const vendorMatches = selectedVendors.length === 0 || selectedVendors.includes(vName);
    if (!vendorMatches) return false;

    const sub = c.subscriptions?.[0];
    const startDate = sub?.start_date || '';
    const endDate = sub?.end_date || '';

    // Month filter (Starting vs Ending vs Both)
    if (selectedMonth && selectedMonth !== 'all') {
      if (monthFilterType === 'ending') {
        if (!endDate.startsWith(selectedMonth)) return false;
      } else if (monthFilterType === 'starting') {
        if (!startDate.startsWith(selectedMonth)) return false;
      } else if (monthFilterType === 'both') {
        if (!endDate.startsWith(selectedMonth) && !startDate.startsWith(selectedMonth)) return false;
      }
    }

    // Status filter
    if (selectedStatus !== 'all') {
      const computed = c.computed_status || sub?.status;
      if (computed !== selectedStatus) return false;
    }

    return true;
  });

  // Generate Portrait PDF with 20+ records per page
  async function generatePDF() {
    try {
      setGeneratingPdf(true);
      // Create portrait PDF (a4 is 210 x 297 mm)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Try loading logo
      let logoData: string | null = null;
      try {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = '/logo.jpg';
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          logoData = canvas.toDataURL('image/jpeg');
        }
      } catch (e) {
        // Logo fallback
      }

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Table rows: Address next to Customer Name, separate Start Date and End Date, NO status column
      const tableData = filteredCustomers.map((c, idx) => {
        const sub = c.subscriptions?.[0];
        const vName = c.vendor_name || c.vendors?.vendor_name || '—';
        const start = sub?.start_date ? formatDate(sub.start_date) : '—';
        const end = sub?.end_date ? formatDate(sub.end_date) : '—';

        return [
          String(idx + 1),
          c.customer_name || '—',
          c.address || '—',
          vName,
          c.order_id || '—',
          c.mobile_number || '—',
          start,
          end,
        ];
      });

      // Header summary text
      const vendorSummary =
        selectedVendors.length === vendors.length
          ? 'All Vendors'
          : selectedVendors.length <= 3
          ? selectedVendors.join(', ')
          : `${selectedVendors.length} Vendors`;

      const typeLabel =
        monthFilterType === 'starting'
          ? 'Starts'
          : monthFilterType === 'ending'
          ? 'Ends'
          : 'Starts/Ends';

      const monthSummary =
        selectedMonth === 'all'
          ? 'All Months'
          : `${format(new Date(selectedMonth + '-01'), 'MMMM yyyy')} (${typeLabel})`;

      // AutoTable in Portrait Mode: 20+ details per page!
      // Total column width = 8 + 34 + 44 + 26 + 24 + 20 + 17 + 17 = 190mm (Margins: left 10mm, right 10mm)
      autoTable(doc, {
        head: [['#', 'Customer Name', 'Address', 'Vendor', 'Order ID', 'Mobile', 'Start Date', 'End Date']],
        body: tableData,
        startY: 36,
        theme: 'grid',
        styles: {
          fontSize: 7,
          cellPadding: { top: 1.6, bottom: 1.6, left: 1.5, right: 1.5 },
          overflow: 'linebreak',
          valign: 'middle',
          textColor: [30, 41, 59],
        },
        headStyles: {
          fillColor: [30, 58, 95], // TOI Navy #1e3a5f
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.5,
          halign: 'left',
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' }, // #
          1: { cellWidth: 34, fontStyle: 'bold' }, // Customer Name
          2: { cellWidth: 44, fontSize: 6.3 }, // Address (next to Customer Name!)
          3: { cellWidth: 26 }, // Vendor
          4: { cellWidth: 24, fontStyle: 'normal' }, // Order ID
          5: { cellWidth: 20 }, // Mobile
          6: { cellWidth: 17, fontSize: 6.8 }, // Start Date
          7: { cellWidth: 17, fontSize: 6.8 }, // End Date
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        margin: { top: 36, left: 10, right: 10, bottom: 14 },
        didDrawPage: (data) => {
          // Top Header (draw on every page)
          doc.setFillColor(30, 58, 95);
          doc.rect(0, 0, pageWidth, 26, 'F');

          if (logoData) {
            try {
              doc.addImage(logoData, 'JPEG', 10, 3, 20, 20);
            } catch (e) {
              // fallback
            }
          }

          // Header Text
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text('THE TIMES OF INDIA — VENDOR DISTRIBUTION REPORT', 33, 10);

          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text(
            `Vendors: ${vendorSummary}  |  Filter: ${monthSummary}  |  Records: ${filteredCustomers.length}`,
            33,
            16
          );

          doc.setFontSize(6.8);
          doc.setTextColor(200, 215, 235);
          doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')} | Royapuram & Chennai Depot`, 33, 22);

          // Footer
          doc.setFontSize(7.5);
          doc.setTextColor(140, 150, 160);
          const pageStr = `Page ${data.pageNumber} of ${doc.internal.pages.length - 1}`;
          doc.text(pageStr, pageWidth - 28, pageHeight - 6);
          doc.text('Confidential — Times of India Multi-Vendor Portal', 10, pageHeight - 6);
        },
      });

      // Save PDF file
      const fileName = `TOI_Report_${vendorSummary.replace(/[^a-zA-Z0-9]/g, '_')}_${monthSummary.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      doc.save(fileName);
    } catch (err: any) {
      alert('Error generating PDF report: ' + err.message);
    } finally {
      setGeneratingPdf(false);
    }
  }

  // Export CSV without Status & Publication, Address next to Customer Name
  function exportCSV() {
    const headers = ['S.No', 'Customer Name', 'Address', 'Vendor Name', 'Order ID', 'Mobile', 'Start Date', 'Expiry Date', 'Depot'];
    const rows = filteredCustomers.map((c, idx) => {
      const sub = c.subscriptions?.[0];
      return [
        idx + 1,
        `"${(c.customer_name || '').replace(/"/g, '""')}"`,
        `"${(c.address || '').replace(/"/g, '""')}"`,
        `"${(c.vendor_name || c.vendors?.vendor_name || '').replace(/"/g, '""')}"`,
        `"${c.order_id || ''}"`,
        `"${c.mobile_number || ''}"`,
        `"${sub?.start_date || ''}"`,
        `"${sub?.end_date || ''}"`,
        `"${c.depot || 'Royapuram'}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TOI_Customers_Report_${selectedMonth}_${monthFilterType}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#1e3a5f] text-white p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-block px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-white/20 rounded-md mb-2">
            Multi-Vendor Export Engine
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Reports & PDF Generation</h1>
          <p className="text-white/80 text-sm mt-1">
            Generate custom portrait PDF reports with 20+ entries per page for starting or ending subscriptions across selected vendors.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={exportCSV}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl border border-white/20 transition-colors flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={generatePDF}
            disabled={generatingPdf || filteredCustomers.length === 0}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-gray-900 font-bold text-xs rounded-xl shadow transition-colors flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>{generatingPdf ? 'Generating PDF...' : 'Download Portrait PDF'}</span>
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm space-y-4">
        {/* Month, Filter Type & Status Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <label className="text-xs font-bold text-gray-800 dark:text-gray-200 block mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#1e3a5f] dark:text-blue-400 stroke-[2.2]" />
              <span>Select Month</span>
            </label>
            <input
              type="month"
              value={selectedMonth === 'all' ? '' : selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value || 'all')}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/25 focus:border-[#1e3a5f]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-800 dark:text-gray-200 block mb-1.5 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-indigo-600 dark:text-indigo-400 stroke-[2.2]" />
              <span>Filter By Date Type</span>
            </label>
            <select
              value={monthFilterType}
              onChange={(e) => setMonthFilterType(e.target.value as any)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/25 focus:border-[#1e3a5f]"
            >
              <option value="ending">Subscriptions Ending In This Month</option>
              <option value="starting">Subscriptions Starting In This Month</option>
              <option value="both">Starting OR Ending In This Month</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-800 dark:text-gray-200 block mb-1.5 flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-amber-600 dark:text-amber-400 stroke-[2.2]" />
              <span>Subscription Status</span>
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/25 focus:border-[#1e3a5f]"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Subscriptions</option>
              <option value="expiring_this_month">Expiring This Month</option>
              <option value="expired">Expired Subscriptions</option>
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <button
              onClick={() => setSelectedMonth('all')}
              className="px-4 py-2.5 text-xs font-bold text-[#1e3a5f] dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-xl transition-colors text-center border border-blue-200 dark:border-blue-900 shadow-sm"
            >
              {selectedMonth === 'all' ? 'Filtering: All Months' : 'Show All Months'}
            </button>
          </div>
        </div>

        {/* Multi-Vendor Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Select Vendors to Include ({selectedVendors.length} of {vendors.length} selected)</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllVendors}
                className="text-xs text-blue-600 hover:underline font-semibold"
              >
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={clearAllVendors}
                className="text-xs text-gray-500 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Vendor Chips / Checkboxes */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {vendors.map((v) => {
              const isSelected = selectedVendors.includes(v.vendor_name);
              return (
                <button
                  type="button"
                  key={v.id}
                  onClick={() => toggleVendor(v.vendor_name)}
                  className={cn(
                    'p-2.5 rounded-xl border text-left flex items-center justify-between text-xs font-semibold transition-all',
                    isSelected
                      ? 'bg-blue-50/70 border-blue-400 text-blue-900 dark:bg-blue-950/40 dark:border-blue-700 dark:text-blue-200 shadow-sm'
                      : 'bg-gray-50/50 border-gray-200 text-gray-600 dark:bg-gray-800/40 dark:border-gray-800 dark:text-gray-400 opacity-60'
                  )}
                >
                  <span className="truncate pr-1">{v.vendor_name}</span>
                  {isSelected ? (
                    <CheckSquare className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Preview Section */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
          <div>
            <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100">
              Report Preview ({filteredCustomers.length} Records Matching)
            </h3>
            <p className="text-xs text-gray-500">
              Portrait layout, 20+ records per page | Address included next to Customer Name | Columns: Customer Name, Address, Vendor, Order ID, Mobile, Start Date, End Date
            </p>
          </div>

          <button
            onClick={generatePDF}
            disabled={generatingPdf || filteredCustomers.length === 0}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-gray-900 font-bold text-xs rounded-xl shadow flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Generate Portrait PDF</span>
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-500">Compiling report data...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No records match the selected filters</p>
            <p className="text-xs text-gray-500 mt-1">Try selecting different vendors, toggling starting/ending month, or showing all months.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 z-10">
                <tr className="border-b border-gray-200 dark:border-gray-700 font-bold text-gray-700 dark:text-gray-300">
                  <th className="py-2.5 px-3 w-10">#</th>
                  <th className="py-2.5 px-3">Customer Name</th>
                  <th className="py-2.5 px-3">Address</th>
                  <th className="py-2.5 px-3">Vendor</th>
                  <th className="py-2.5 px-3">Order / Coupon</th>
                  <th className="py-2.5 px-3">Mobile</th>
                  <th className="py-2.5 px-3">Start Date</th>
                  <th className="py-2.5 px-3">End Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredCustomers.slice(0, 50).map((c, idx) => {
                  const sub = c.subscriptions?.[0];
                  return (
                    <tr key={c.id || idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="py-2 px-3 text-gray-400 font-mono">{idx + 1}</td>
                      <td className="py-2 px-3 font-semibold text-gray-900 dark:text-gray-100">{c.customer_name}</td>
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400 max-w-xs truncate">{c.address || '—'}</td>
                      <td className="py-2 px-3 text-gray-700 dark:text-gray-300 font-medium">{c.vendor_name || c.vendors?.vendor_name}</td>
                      <td className="py-2 px-3 font-mono text-gray-600 dark:text-gray-400">{c.order_id || '—'}</td>
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{c.mobile_number || '—'}</td>
                      <td className="py-2 px-3 font-medium">{formatDate(sub?.start_date)}</td>
                      <td className="py-2 px-3 font-medium">{formatDate(sub?.end_date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredCustomers.length > 50 && (
              <div className="p-3 text-center text-xs text-gray-500 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800">
                Showing first 50 rows in preview. All {filteredCustomers.length} records will be rendered in the portrait PDF.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
