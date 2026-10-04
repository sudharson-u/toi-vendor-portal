'use client';

import { useState, useEffect } from 'react';
import {
  FileText, Download, Printer, Filter, CheckSquare, Square,
  Building2, Calendar, CheckCircle2, ChevronDown, RefreshCw
} from 'lucide-react';
import { formatDate, getStatusLabel, cn } from '@/lib/utils';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ReportsPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(''); // YYYY-MM
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

  // Fetch report data whenever filters change
  useEffect(() => {
    async function fetchReportData() {
      setLoading(true);
      try {
        // Fetch up to 500 customers
        const res = await fetch('/api/customers?limit=500');
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

  // Filter customers by selected vendors, month, status
  const filteredCustomers = customers.filter((c) => {
    const vName = c.vendor_name || c.vendors?.vendor_name;
    const vendorMatches = selectedVendors.length === 0 || selectedVendors.includes(vName);
    if (!vendorMatches) return false;

    const sub = c.subscriptions?.[0];
    const endDate = sub?.end_date || '';

    // Month filter
    if (selectedMonth && selectedMonth !== 'all') {
      if (!endDate.startsWith(selectedMonth)) return false;
    }

    // Status filter
    if (selectedStatus !== 'all') {
      const computed = c.computed_status || sub?.status;
      if (computed !== selectedStatus) return false;
    }

    return true;
  });

  // Generate Portrait PDF with at least 20 records per page
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
        // Logo not available or canvas error, continue with text header
      }

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Table rows
      const tableData = filteredCustomers.map((c, idx) => {
        const sub = c.subscriptions?.[0];
        const vName = c.vendor_name || c.vendors?.vendor_name || '—';
        const start = sub?.start_date ? formatDate(sub.start_date) : '—';
        const end = sub?.end_date ? formatDate(sub.end_date) : '—';

        return [
          String(idx + 1),
          c.customer_name || '—',
          vName,
          c.order_id || '—',
          c.mobile_number || '—',
          `${start}\nto ${end}`,
          getStatusLabel(c.computed_status || sub?.status || 'active'),
        ];
      });

      // Format header title
      const vendorSummary =
        selectedVendors.length === vendors.length
          ? 'All Vendors'
          : selectedVendors.length <= 3
          ? selectedVendors.join(', ')
          : `${selectedVendors.length} Selected Vendors`;

      const monthSummary =
        selectedMonth === 'all'
          ? 'All Months'
          : format(new Date(selectedMonth + '-01'), 'MMMM yyyy');

      // AutoTable with compact rows to fit at least 20 per page!
      // A4 portrait height is 297mm. Top margin 38mm, bottom margin 15mm => 244mm usable.
      // 20 rows + header row => each row ~8.5mm to 9mm.
      autoTable(doc, {
        head: [['#', 'Customer Name', 'Vendor', 'Order ID', 'Mobile', 'Term Period', 'Status']],
        body: tableData,
        startY: 38,
        theme: 'grid',
        styles: {
          fontSize: 7.5,
          cellPadding: { top: 1.8, bottom: 1.8, left: 1.5, right: 1.5 },
          overflow: 'linebreak',
          valign: 'middle',
          textColor: [30, 41, 59],
        },
        headStyles: {
          fillColor: [30, 58, 95], // TOI Navy #1e3a5f
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'left',
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' }, // #
          1: { cellWidth: 44, fontStyle: 'bold' }, // Customer Name
          2: { cellWidth: 32 }, // Vendor
          3: { cellWidth: 26, fontStyle: 'normal' }, // Order ID
          4: { cellWidth: 24 }, // Mobile
          5: { cellWidth: 30, fontSize: 6.5 }, // Term
          6: { cellWidth: 26, fontStyle: 'bold' }, // Status
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        margin: { top: 38, left: 10, right: 10, bottom: 15 },
        didDrawPage: (data) => {
          // Top Header (draw on every page)
          doc.setFillColor(30, 58, 95);
          doc.rect(0, 0, pageWidth, 28, 'F');

          if (logoData) {
            try {
              doc.addImage(logoData, 'JPEG', 10, 4, 20, 20);
            } catch (e) {
              // fallback
            }
          }

          // Header Text
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(13);
          doc.setFont('helvetica', 'bold');
          doc.text('THE TIMES OF INDIA — VENDOR DISTRIBUTION REPORT', 34, 11);

          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'normal');
          doc.text(
            `Vendors: ${vendorSummary}  |  Period: ${monthSummary}  |  Records: ${filteredCustomers.length}`,
            34,
            17
          );

          doc.setFontSize(7);
          doc.setTextColor(200, 215, 235);
          doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy, hh:mm a')} | Royapuram & Chennai Depot`, 34, 23);

          // Footer
          doc.setFontSize(7.5);
          doc.setTextColor(140, 150, 160);
          const pageStr = `Page ${data.pageNumber} of ${doc.internal.pages.length - 1}`;
          doc.text(pageStr, pageWidth - 30, pageHeight - 7);
          doc.text('Confidential — Times of India Multi-Vendor Portal', 10, pageHeight - 7);
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

  // Export CSV
  function exportCSV() {
    const headers = ['S.No', 'Customer Name', 'Vendor Name', 'Order ID', 'Mobile', 'Address', 'Depot', 'Start Date', 'Expiry Date', 'Status'];
    const rows = filteredCustomers.map((c, idx) => {
      const sub = c.subscriptions?.[0];
      return [
        idx + 1,
        `"${(c.customer_name || '').replace(/"/g, '""')}"`,
        `"${(c.vendor_name || c.vendors?.vendor_name || '').replace(/"/g, '""')}"`,
        `"${c.order_id || ''}"`,
        `"${c.mobile_number || ''}"`,
        `"${(c.address || '').replace(/"/g, '""')}"`,
        `"${c.depot || ''}"`,
        `"${sub?.start_date || ''}"`,
        `"${sub?.end_date || ''}"`,
        `"${c.computed_status || sub?.status || 'active'}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TOI_Customers_Report_${selectedMonth}.csv`);
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
            Generate custom portrait PDF reports with 20+ entries per page for any selected vendors and months.
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
        {/* Month & Status Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>Select Month</span>
            </label>
            <input
              type="month"
              value={selectedMonth === 'all' ? '' : selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value || 'all')}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 font-medium"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-amber-600" />
              <span>Subscription Status</span>
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 font-medium"
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
              className="px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 rounded-lg transition-colors text-center"
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
              Estimated pages: ~{Math.max(1, Math.ceil(filteredCustomers.length / 22))} pages (Portrait layout, 20+ per page)
            </p>
          </div>

          <button
            onClick={generatePDF}
            disabled={generatingPdf || filteredCustomers.length === 0}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-gray-900 font-bold text-xs rounded-xl shadow flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Generate PDF</span>
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
            <p className="text-xs text-gray-500 mt-1">Try selecting different vendors or showing all months.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 z-10">
                <tr className="border-b border-gray-200 dark:border-gray-700 font-bold text-gray-700 dark:text-gray-300">
                  <th className="py-2.5 px-3 w-10">#</th>
                  <th className="py-2.5 px-3">Customer Name</th>
                  <th className="py-2.5 px-3">Vendor</th>
                  <th className="py-2.5 px-3">Order / Coupon</th>
                  <th className="py-2.5 px-3">Mobile</th>
                  <th className="py-2.5 px-3">Expiry Date</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredCustomers.slice(0, 50).map((c, idx) => {
                  const sub = c.subscriptions?.[0];
                  return (
                    <tr key={c.id || idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="py-2 px-3 text-gray-400 font-mono">{idx + 1}</td>
                      <td className="py-2 px-3 font-semibold text-gray-900 dark:text-gray-100">{c.customer_name}</td>
                      <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{c.vendor_name || c.vendors?.vendor_name}</td>
                      <td className="py-2 px-3 font-mono text-gray-600 dark:text-gray-400">{c.order_id || '—'}</td>
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{c.mobile_number || '—'}</td>
                      <td className="py-2 px-3 font-medium">{formatDate(sub?.end_date)}</td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded-full font-bold text-[10px] uppercase bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                          {c.computed_status || sub?.status || 'active'}
                        </span>
                      </td>
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
