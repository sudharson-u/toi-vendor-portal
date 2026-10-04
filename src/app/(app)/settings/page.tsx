'use client';

import { useState } from 'react';
import {
  Settings, Database, Smartphone, ShieldCheck, RefreshCw,
  CheckCircle2, AlertTriangle, ExternalLink, Moon, Sun, Copy, Check
} from 'lucide-react';
import ThemeToggle from '@/components/theme/ThemeToggle';

export default function SettingsPage() {
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSeedSupabase() {
    try {
      setSeeding(true);
      setSeedResult(null);
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSeedResult(data.message || 'Database successfully seeded with vendors and customers!');
      } else {
        setSeedResult(`Notice: ${data.error || 'Please run schema.sql in Supabase SQL editor first.'}`);
      }
    } catch (err: any) {
      setSeedResult('Seed failed: ' + err.message);
    } finally {
      setSeeding(false);
    }
  }

  function copyProjectUrl() {
    navigator.clipboard.writeText('https://eqsjancsvtjwhcsmnbjm.supabase.co');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-[#1e3a5f] text-white p-6 rounded-2xl shadow-sm">
        <span className="inline-block px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-white/20 rounded-md mb-2">
          System Configuration
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Portal Settings</h1>
        <p className="text-white/80 text-sm mt-1">
          Manage Supabase database synchronization, mobile app configuration, and theme preferences.
        </p>
      </div>

      {/* Supabase Database Card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Supabase Cloud Database</h2>
              <p className="text-xs text-gray-500">Connected to project eqsjancsvtjwhcsmnbjm</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Configured</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
            <span className="text-gray-400 block mb-1">Project URL</span>
            <div className="flex items-center justify-between font-mono font-bold text-gray-800 dark:text-gray-200">
              <span>https://eqsjancsvtjwhcsmnbjm.supabase.co</span>
              <button onClick={copyProjectUrl} className="text-gray-400 hover:text-gray-600 ml-2">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
            <span className="text-gray-400 block mb-1">Database Schema</span>
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              Multi-Vendor: 14 Vendors, 262 Customers
            </span>
          </div>
        </div>

        {/* Sync / Seed Button */}
        <div className="p-4 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-xs text-blue-900 dark:text-blue-200">Sync Seed Data to Supabase</h3>
            <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80 mt-0.5">
              Syncs all 14 vendors and 262 extracted customer records into the Supabase database.
            </p>
          </div>
          <button
            onClick={handleSeedSupabase}
            disabled={seeding}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition-colors self-start sm:self-center disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${seeding ? 'animate-spin' : ''}`} />
            <span>{seeding ? 'Syncing...' : 'Sync to Supabase'}</span>
          </button>
        </div>

        {seedResult && (
          <div className="p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-semibold text-gray-800 dark:text-gray-200">
            {seedResult}
          </div>
        )}
      </div>

      {/* Mobile PWA & Installation */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Mobile Installation (PWA)</h2>
            <p className="text-xs text-gray-500">Install the portal directly on Android & iOS mobile devices</p>
          </div>
        </div>

        <div className="text-xs text-gray-600 dark:text-gray-300 space-y-2">
          <p>
            This portal is configured as a Progressive Web App (PWA). You can install it on your mobile device as a standalone native-like app:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-gray-500 dark:text-gray-400">
            <li><strong>Android (Chrome):</strong> Tap the three-dot menu at top-right and select <em>&quot;Install app&quot;</em> or <em>&quot;Add to Home screen&quot;</em>.</li>
            <li><strong>iPhone / iPad (Safari):</strong> Tap the Share button at bottom and select <em>&quot;Add to Home Screen&quot;</em>.</li>
          </ul>
        </div>
      </div>

      {/* Theme Preferences */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Appearance</h2>
          <p className="text-xs text-gray-500">Switch between light, dark, or system theme</p>
        </div>
        <ThemeToggle />
      </div>
    </div>
  );
}
