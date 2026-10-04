'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Upload, Download, FileSpreadsheet, Building2, CheckCircle2,
  AlertCircle, CheckSquare, Square, RefreshCw, FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function ImportExportPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedVendorsForExport, setSelectedVendorsForExport] = useState<string[]>([]);
  const [targetVendorForImport, setTargetVendorForImport] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  // Import preview
  const [fileData, setFileData] = useState<any[]>([]);
  const [fileName, setFileName] = useState('');
  const [importResult, setImportResult] = useState<{ count: number; vendor: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadVendors() {
      try {
        const res = await fetch('/api/vendors');
        const data = await res.json();
        if (data.vendors) {
          setVendors(data.vendors);
          setSelectedVendorsForExport(data.vendors.map((v: any) => v.vendor_name));
          if (data.vendors.length > 0) {
            setTargetVendorForImport(data.vendors[0].vendor_name);
          }
        }
      } catch (err) {
        console.error('Failed to load vendors:', err);
      }
    }
    loadVendors();
  }, []);

  function toggleExportVendor(vName: string) {
    if (selectedVendorsForExport.includes(vName)) {
      setSelectedVendorsForExport(selectedVendorsForExport.filter((v) => v !== vName));
    } else {
      setSelectedVendorsForExport([...selectedVendorsForExport, vName]);
    }
  }

  function selectAllExport() {
    setSelectedVendorsForExport(vendors.map((v) => v.vendor_name));
  }

  function clearAllExport() {
    setSelectedVendorsForExport([]);
  }

  // Handle Export Excel/CSV
  async function handleExport(formatType: 'xlsx' | 'csv') {
    if (selectedVendorsForExport.length === 0) {
      alert('Please select at least one vendor to export.');
      return;
    }

    try {
      setExporting(true);
      const res = await fetch('/api/customers?limit=1000');
      const data = await res.json();
      const allCustomers = data.customers || [];

      // Filter customers by selected vendors
      const exportList = allCustomers.filter((c: any) => {
        const v = c.vendor_name || c.vendors?.vendor_name;
        return selectedVendorsForExport.includes(v);
      });

      if (exportList.length === 0) {
        alert('No customers found under the selected vendors.');
        return;
      }

      // Format for spreadsheet
      const sheetData = exportList.map((c: any, idx: number) => {
        const sub = c.subscriptions?.[0];
        return {
          'S.No': idx + 1,
          'Coupon / Order ID': c.order_id || '',
          'Customer Name': c.customer_name || '',
          'Vendor Name': c.vendor_name || c.vendors?.vendor_name || '',
          'Mobile Number': c.mobile_number || '',
          'Start Date': sub?.start_date || '',
          'Expiry Date': sub?.end_date || '',
          'Address': c.address || '',
          'Depot': c.depot || 'Royapuram',
          'Status': c.computed_status || sub?.status || 'active',
          'Publication': c.publication || 'TOI',
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(sheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');

      const vendorLabel =
        selectedVendorsForExport.length === vendors.length
          ? 'All_Vendors'
          : selectedVendorsForExport.join('_').slice(0, 30);

      const fName = `TOI_Customers_${vendorLabel}_${format(new Date(), 'yyyyMMdd')}.${formatType}`;

      if (formatType === 'xlsx') {
        XLSX.writeFile(workbook, fName);
      } else {
        XLSX.writeFile(workbook, fName, { bookType: 'csv' });
      }
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  }

  // Handle File Upload for Import
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws);

        // Normalize columns
        const normalized = rawJson.map((row) => {
          const name = row['Customer Name'] || row['Name'] || row['customer_name'] || '';
          const orderId = row['Coupon / Order ID'] || row['Order ID'] || row['order_id'] || row['coupon No'] || row['Coupon No'] || '';
          const mobile = row['Mobile Number'] || row['Mobile'] || row['mobile_number'] || row['Phone'] || '';
          const address = row['Address'] || row['address'] || '';
          const startDate = row['Start Date'] || row['start_date'] || '2026-10-01';
          const endDate = row['Expiry Date'] || row['end_date'] || '2027-09-30';

          return {
            customer_name: String(name).trim(),
            order_id: String(orderId).trim(),
            mobile_number: String(mobile).trim(),
            address: String(address).trim(),
            start_date: String(startDate).trim(),
            end_date: String(endDate).trim(),
          };
        }).filter((r) => r.customer_name);

        setFileData(normalized);
      } catch (err: any) {
        alert('Failed to parse file: ' + err.message);
      }
    };

    reader.readAsBinaryString(file);
  }

  // Execute Import directly to selected vendor
  async function handleImportSubmit() {
    if (!targetVendorForImport) {
      alert('Please select a target vendor to import these customers into.');
      return;
    }
    if (fileData.length === 0) {
      alert('No valid customer records found in the uploaded file.');
      return;
    }

    try {
      setImporting(true);
      const targetVendorObj = vendors.find((v) => v.vendor_name === targetVendorForImport);

      let successCount = 0;
      for (const row of fileData) {
        await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: row.customer_name,
            order_id: row.order_id,
            mobile_number: row.mobile_number,
            address: row.address,
            start_date: row.start_date,
            end_date: row.end_date,
            vendor_name: targetVendorForImport,
            vendor_id: targetVendorObj?.id || null,
          }),
        });
        successCount++;
      }

      setImportResult({ count: successCount, vendor: targetVendorForImport });
      setFileData([]);
      setFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      alert('Import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  }

  // Download Sample Template
  function downloadTemplate() {
    const templateData = [
      {
        'Customer Name': 'John Doe',
        'Coupon / Order ID': 'SCT45298124',
        'Mobile Number': '9840123456',
        'Start Date': '2026-10-01',
        'Expiry Date': '2027-09-30',
        'Address': 'No 12, Main Street, Royapuram, Chennai 600013',
        'Depot': 'Royapuram',
      },
      {
        'Customer Name': 'Ayesha Banu',
        'Coupon / Order ID': 'SCF47587784',
        'Mobile Number': '9840654321',
        'Start Date': '2026-10-15',
        'Expiry Date': '2027-10-14',
        'Address': 'Flat 4A, Casa Grand, Royapuram, Chennai',
        'Depot': 'Royapuram',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sample');
    XLSX.writeFile(wb, 'TOI_Customer_Import_Template.xlsx');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#1e3a5f] text-white p-6 rounded-2xl shadow-sm">
        <span className="inline-block px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-white/20 rounded-md mb-2">
          Data Management
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Import & Export Portal</h1>
        <p className="text-white/80 text-sm mt-1">
          Export customer lists grouped by selected vendors or import new subscriber batches directly into any assigned vendor.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* EXPORT SECTION */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Export by Vendor</h2>
                <p className="text-xs text-gray-500">Select which vendors to download together</p>
              </div>
            </div>

            {/* Vendor Multi-Selection */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Select Vendors ({selectedVendorsForExport.length} of {vendors.length})
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={selectAllExport} className="text-xs text-blue-600 hover:underline font-semibold">
                    Select All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button onClick={clearAllExport} className="text-xs text-gray-500 hover:underline">
                    Clear
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-800/20">
                {vendors.map((v) => {
                  const isSel = selectedVendorsForExport.includes(v.vendor_name);
                  return (
                    <button
                      type="button"
                      key={v.id}
                      onClick={() => toggleExportVendor(v.vendor_name)}
                      className={cn(
                        'p-2 rounded-lg text-left text-xs font-semibold flex items-center justify-between transition-colors',
                        isSel
                          ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-900 dark:text-blue-200'
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      )}
                    >
                      <span className="truncate">{v.vendor_name}</span>
                      {isSel ? (
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

          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3">
            <button
              onClick={() => handleExport('xlsx')}
              disabled={exporting || selectedVendorsForExport.length === 0}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{exporting ? 'Exporting...' : 'Export Excel (.xlsx)'}</span>
            </button>
            <button
              onClick={() => handleExport('csv')}
              disabled={exporting || selectedVendorsForExport.length === 0}
              className="py-2.5 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold text-xs rounded-xl transition-colors"
            >
              CSV
            </button>
          </div>
        </div>

        {/* IMPORT SECTION */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Import Directly to Vendor</h2>
                <p className="text-xs text-gray-500">Upload customers and assign them straight to a chosen vendor</p>
              </div>
            </div>

            {/* Target Vendor Picker */}
            <div className="mb-4">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Assign Imported Customers to Vendor:</span>
              </label>
              <select
                value={targetVendorForImport}
                onChange={(e) => setTargetVendorForImport(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 font-bold text-gray-900 dark:text-gray-100"
              >
                {vendors.map((v) => (
                  <option key={v.id} value={v.vendor_name}>
                    {v.vendor_name} ({v.customer_count || 0} existing customers)
                  </option>
                ))}
              </select>
            </div>

            {/* File Upload Box */}
            <div className="mb-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center cursor-pointer hover:border-amber-400 hover:bg-amber-50/20 dark:hover:bg-amber-950/10 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Upload className="w-8 h-8 text-amber-500 mx-auto mb-2 opacity-70" />
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                  {fileName ? fileName : 'Click to select Excel or CSV file'}
                </p>
                <p className="text-[11px] text-gray-400 mt-1">
                  Supports .xlsx, .xls, .csv format
                </p>
              </div>

              <div className="flex items-center justify-between mt-2">
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="text-xs text-blue-600 hover:underline font-semibold flex items-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Download Sample Template</span>
                </button>
                {fileData.length > 0 && (
                  <span className="text-xs font-semibold text-emerald-600">
                    ✓ {fileData.length} records detected
                  </span>
                )}
              </div>
            </div>

            {/* Success message */}
            {importResult && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-3">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>
                  Successfully imported {importResult.count} customers to vendor {importResult.vendor}!
                </span>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={handleImportSubmit}
              disabled={importing || fileData.length === 0}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-gray-900 font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>
                {importing
                  ? 'Importing...'
                  : `Confirm & Import ${fileData.length} Customers to ${targetVendorForImport}`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
