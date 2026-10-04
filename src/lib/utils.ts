import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  format,
  parseISO,
  isBefore,
  startOfMonth,
  endOfMonth,
  differenceInDays,
  isValid,
} from 'date-fns';
import { SubscriptionStatus } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calculate subscription status based on today's date.
 * Renewal notification = subscriptions expiring THIS MONTH only.
 */
export function calculateStatus(
  endDate: Date | string,
  today: Date = new Date()
): SubscriptionStatus {
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
  if (!isValid(end)) return 'expired';

  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const thisMonthEnd = endOfMonth(todayStart);
  const thisMonthStart = startOfMonth(todayStart);

  if (isBefore(end, todayStart)) {
    return 'expired';
  }

  if (end >= thisMonthStart && end <= thisMonthEnd) {
    return 'expiring_this_month';
  }

  return 'active';
}

export function calculateDaysRemaining(endDate: Date | string, today: Date = new Date()): number {
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return differenceInDays(end, todayStart);
}

export function getStatusLabel(status: SubscriptionStatus): string {
  switch (status) {
    case 'active': return 'Active';
    case 'renew_soon': return 'Renew Soon';
    case 'expiring_this_month': return 'Expiring This Month';
    case 'expired': return 'Expired';
    case 'renewed': return 'Renewed';
    default: return status;
  }
}

export function getStatusColor(status: SubscriptionStatus): string {
  switch (status) {
    case 'active': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'renew_soon': return 'text-amber-700 bg-amber-50 border-amber-200';
    case 'expiring_this_month': return 'text-orange-700 bg-orange-50 border-orange-200';
    case 'expired': return 'text-red-700 bg-red-50 border-red-200';
    case 'renewed': return 'text-blue-700 bg-blue-50 border-blue-200';
    default: return 'text-gray-700 bg-gray-50 border-gray-200';
  }
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return '—';
    return format(date, 'dd MMM yyyy');
  } catch {
    return '—';
  }
}

export function parseExcelDate(value: unknown): string {
  if (!value && value !== 0) return '';
  if (typeof value === 'number') {
    // Excel serial date
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    if (!isValid(date)) return '';
    return format(date, 'yyyy-MM-dd');
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Try multiple date formats
    const formats = [
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // DD/MM/YYYY or MM/DD/YYYY
      /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // DD-MM-YYYY
    ];
    for (const fmt of formats) {
      const m = trimmed.match(fmt);
      if (m) {
        // Assume DD/MM/YYYY for Indian format
        if (fmt === formats[0]) {
          const date = new Date(+m[3], +m[2] - 1, +m[1]);
          if (isValid(date)) return format(date, 'yyyy-MM-dd');
        }
        if (fmt === formats[2]) {
          const date = new Date(+m[3], +m[2] - 1, +m[1]);
          if (isValid(date)) return format(date, 'yyyy-MM-dd');
        }
        if (fmt === formats[1]) {
          const date = new Date(+m[1], +m[2] - 1, +m[3]);
          if (isValid(date)) return format(date, 'yyyy-MM-dd');
        }
      }
    }
    // Try parsing as-is
    const d = new Date(trimmed);
    if (isValid(d)) return format(d, 'yyyy-MM-dd');
  }
  if (value instanceof Date) {
    if (isValid(value)) return format(value, 'yyyy-MM-dd');
  }
  return '';
}

export function sanitizePhone(value: unknown): string {
  if (!value) return '';
  return String(value).replace(/[^0-9+\s\-()]/g, '').trim().slice(0, 15);
}
