import { createClient, createServiceClient, isSupabaseConfigured } from '@/lib/supabase/server';
import seedData from '@/data/seedData.json';
import { calculateStatus } from '@/lib/utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import fs from 'fs';
import path from 'path';

export interface DataCustomer {
  id: string;
  customer_id: string;
  order_id: string;
  customer_name: string;
  address: string;
  depot: string;
  mobile_number: string | null;
  vendor_id: string | null;
  vendor_name: string;
  vendor_code?: string;
  publication?: string;
  notes?: string;
  subscriptions: Array<{
    id: string;
    customer_id: string;
    start_date: string;
    end_date: string;
    status: string;
    is_current: boolean;
  }>;
}

// In-memory fallback cache
let localVendors = [...seedData.vendors];
let localCustomers: DataCustomer[] = [...(seedData.customers as DataCustomer[])];

function ensureLatestLocalData() {
  try {
    const dataPath = path.join(process.cwd(), 'src/data/seedData.json');
    if (fs.existsSync(dataPath)) {
      const content = fs.readFileSync(dataPath, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.vendors) && parsed.vendors.length > 0) {
        localVendors = parsed.vendors;
      }
      if (Array.isArray(parsed.customers) && parsed.customers.length > 0) {
        localCustomers = parsed.customers;
      }
    }
  } catch (err) {
    // Keep in-memory fallback
  }
}

function saveLocal() {
  try {
    const dataPath = path.join(process.cwd(), 'src/data/seedData.json');
    fs.writeFileSync(dataPath, JSON.stringify({
      updatedAt: new Date().toISOString(),
      vendors: localVendors,
      customers: localCustomers,
    }, null, 2));
  } catch (err) {
    console.error('Failed to persist local JSON:', err);
  }
}

export async function getAllVendors() {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServiceClient();
      const { data, error } = await supabase
        .from('vendors')
        .select('id, vendor_name, mobile_number, created_at')
        .order('vendor_name');

      if (!error && data && data.length > 0) {
        const { data: counts } = await supabase.from('customers').select('vendor_id');
        const countMap: Record<string, number> = {};
        counts?.forEach((c: any) => {
          if (c.vendor_id) countMap[c.vendor_id] = (countMap[c.vendor_id] || 0) + 1;
        });

        return data.map((v: any) => ({
          ...v,
          customer_count: countMap[v.id] || 0,
        }));
      }
    } catch (e) {
      // Fallback
    }
  }

  // Recalculate local vendor customer counts
  ensureLatestLocalData();
  const countMap: Record<string, number> = {};
  localCustomers.forEach((c) => {
    if (c.vendor_name) {
      countMap[c.vendor_name] = (countMap[c.vendor_name] || 0) + 1;
    }
  });

  return localVendors.map((v) => ({
    ...v,
    customer_count: countMap[v.vendor_name] || 0,
  }));
}

export async function getAllCustomers(options: {
  search?: string;
  statusFilter?: string;
  vendorFilter?: string;
  expiryFilter?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}) {
  const {
    search = '',
    statusFilter = '',
    vendorFilter = '',
    expiryFilter = '',
    sort = 'customer_name',
    dir = 'asc',
    page = 1,
    limit = 20,
  } = options;

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServiceClient();
      let query = supabase
        .from('customers')
        .select(`
          id, customer_id, customer_name, address, mobile_number, order_id, vendor_id,
          vendors(id, vendor_name),
          subscriptions(id, start_date, end_date, status, is_current, notification_date)
        `, { count: 'exact' })
        .eq('subscriptions.is_current', true);

      if (search) {
        query = query.or(
          `customer_name.ilike.%${search}%,customer_id.ilike.%${search}%,mobile_number.ilike.%${search}%,order_id.ilike.%${search}%`
        );
      }
      if (vendorFilter) {
        query = query.eq('vendor_id', vendorFilter);
      }

      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const thisMonthEnd = format(endOfMonth(today), 'yyyy-MM-dd');

      if (statusFilter === 'expiring_this_month') {
        query = query
          .gte('subscriptions.end_date', todayStr)
          .lte('subscriptions.end_date', thisMonthEnd);
      } else if (statusFilter === 'expired') {
        query = query.lt('subscriptions.end_date', todayStr);
      } else if (statusFilter === 'active') {
        query = query.gt('subscriptions.end_date', thisMonthEnd);
      }

      if (expiryFilter) {
        const [y, m] = expiryFilter.split('-');
        const startDay = `${y}-${m}-01`;
        const lastDayNum = new Date(parseInt(y), parseInt(m), 0).getDate();
        const endDay = `${y}-${m}-${lastDayNum < 10 ? '0' + lastDayNum : lastDayNum}`;
        query = query
          .gte('subscriptions.end_date', startDay)
          .lte('subscriptions.end_date', endDay);
      }

      const sortCol = ['customer_name', 'customer_id', 'mobile_number', 'created_at'].includes(sort)
        ? sort
        : 'customer_name';
      query = query.order(sortCol, { ascending: dir === 'asc' });

      const from = (page - 1) * limit;
      const { data, count, error } = await query.range(from, from + limit - 1);

      if (!error && data) {
        const seen = new Set<string>();
        const deduped: any[] = [];
        for (const c of data) {
          if (!seen.has(c.id)) {
            seen.add(c.id);
            // Ensure subscriptions is always an array and take only the current one
            const subs: any[] = Array.isArray(c.subscriptions) ? c.subscriptions : [];
            const currentSub = subs.find((s: any) => s.is_current) || subs[0] || null;
            const vendorObj = Array.isArray(c.vendors) ? c.vendors[0] : c.vendors;
            deduped.push({
              ...c,
              vendors: vendorObj || null,
              vendor_name: vendorObj?.vendor_name || 'Unassigned',
              subscriptions: currentSub ? [currentSub] : [],
              computed_status: calculateStatus(currentSub?.end_date || '', today),
            });
          }
        }

        return {
          customers: deduped,
          total: count ?? deduped.length,
        };
      }
    } catch (e) {
      // Fallback
    }
  }

  // Fallback to local data
  ensureLatestLocalData();
  const today = new Date();
  let list = localCustomers.map((c) => {
    const sub = c.subscriptions?.[0];
    const status = calculateStatus(sub?.end_date || '', today);
    return {
      ...c,
      computed_status: status,
      vendors: {
        id: c.vendor_id || '',
        vendor_name: c.vendor_name || '—',
      },
    };
  });

  if (search) {
    const q = search.toLowerCase();
    list = list.filter(
      (c) =>
        c.customer_name?.toLowerCase().includes(q) ||
        c.order_id?.toLowerCase().includes(q) ||
        c.mobile_number?.includes(q) ||
        c.address?.toLowerCase().includes(q) ||
        c.vendor_name?.toLowerCase().includes(q)
    );
  }

  if (vendorFilter) {
    list = list.filter(
      (c) =>
        c.vendor_id === vendorFilter ||
        c.vendor_name?.toLowerCase() === vendorFilter.toLowerCase()
    );
  }

  if (statusFilter) {
    list = list.filter((c) => c.computed_status === statusFilter);
  }

  if (expiryFilter) {
    list = list.filter((c) =>
      (c.subscriptions?.[0]?.end_date || '').startsWith(expiryFilter)
    );
  }

  list.sort((a, b) => {
    let valA = (a as any)[sort] || '';
    let valB = (b as any)[sort] || '';
    if (sort === 'end_date') {
      valA = a.subscriptions?.[0]?.end_date || '';
      valB = b.subscriptions?.[0]?.end_date || '';
    }
    const cmp = String(valA).localeCompare(String(valB));
    return dir === 'desc' ? -cmp : cmp;
  });

  const total = list.length;
  const from = (page - 1) * limit;
  const paginated = list.slice(from, from + limit);

  return {
    customers: paginated,
    total,
  };
}

export async function getCustomerById(id: string) {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServiceClient();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      let query = supabase
        .from('customers')
        .select(`
          id, customer_id, customer_name, address, mobile_number, order_id, notes, vendor_id,
          vendors(id, vendor_name, mobile_number),
          subscriptions(id, start_date, end_date, status, is_current, notification_date, created_at)
        `);

      if (isUuid) {
        query = query.eq('id', id);
      } else {
        query = query.or(`customer_id.eq.${id},order_id.eq.${id}`);
      }

      const { data, error } = await query.maybeSingle();
      if (!error && data) {
        const vendorObj = Array.isArray(data.vendors) ? data.vendors[0] : data.vendors;
        return {
          ...data,
          vendors: vendorObj || null,
          vendor_name: vendorObj?.vendor_name || 'Unassigned',
        };
      }
    } catch (e) {
      // Fallback
    }
  }

  ensureLatestLocalData();
  const found = localCustomers.find((c) => c.id === id || c.order_id === id);
  if (!found) return null;

  return {
    ...found,
    notes: found.notes || '',
    vendors: {
      id: found.vendor_id || '',
      vendor_name: found.vendor_name || 'Unassigned',
      mobile_number: '',
    },
    vendor_name: found.vendor_name || 'Unassigned',
  };
}

export async function createCustomer(data: {
  customer_name: string;
  order_id?: string;
  address?: string;
  mobile_number?: string;
  notes?: string;
  vendor_id?: string;
  vendor_name?: string;
  start_date: string;
  end_date: string;
}) {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServiceClient();
      const { data: cust, error: custErr } = await supabase
        .from('customers')
        .insert({
          customer_name: data.customer_name.trim(),
          order_id: data.order_id?.trim() || null,
          address: data.address?.trim() || null,
          mobile_number: data.mobile_number?.trim() || null,
          notes: data.notes?.trim() || null,
          vendor_id: data.vendor_id || null,
        })
        .select()
        .single();

      if (!custErr && cust) {
        await supabase.from('subscriptions').insert({
          customer_id: cust.id,
          start_date: data.start_date,
          end_date: data.end_date,
          status: 'active',
          is_current: true,
        });
        return cust;
      }
    } catch (e) {
      // Fallback
    }
  }

  const newId = 'cust-' + (localCustomers.length + 1);
  const newCustomer: DataCustomer = {
    id: newId,
    customer_id: newId,
    order_id: data.order_id || 'ORD-' + Math.floor(10000000 + Math.random() * 90000000),
    customer_name: data.customer_name,
    address: data.address || '',
    depot: 'Royapuram',
    mobile_number: data.mobile_number || null,
    notes: data.notes || '',
    vendor_id: data.vendor_id || null,
    vendor_name: data.vendor_name || 'Unassigned',
    subscriptions: [
      {
        id: 'sub-' + (localCustomers.length + 1),
        customer_id: newId,
        start_date: data.start_date,
        end_date: data.end_date,
        status: 'active',
        is_current: true,
      },
    ],
  };

  localCustomers.unshift(newCustomer);
  saveLocal();
  return newCustomer;
}

export async function updateCustomer(id: string, updates: Partial<DataCustomer>) {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServiceClient();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      const updateData: Record<string, any> = {};
      if (updates.customer_name !== undefined) updateData.customer_name = updates.customer_name;
      if (updates.mobile_number !== undefined) updateData.mobile_number = updates.mobile_number;
      if (updates.address !== undefined) updateData.address = updates.address;
      if (updates.order_id !== undefined) updateData.order_id = updates.order_id;
      if (updates.notes !== undefined) updateData.notes = updates.notes;

      // Handle vendor assignment carefully
      if (updates.vendor_id !== undefined) {
        if (!updates.vendor_id || updates.vendor_id === 'unassigned') {
          updateData.vendor_id = null;
          updates.vendor_name = 'Unassigned';
        } else {
          const isVendorUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updates.vendor_id);
          if (isVendorUuid) {
            updateData.vendor_id = updates.vendor_id;
            // Fetch vendor name if not provided
            if (!updates.vendor_name) {
              const { data: vRow } = await supabase
                .from('vendors')
                .select('vendor_name')
                .eq('id', updates.vendor_id)
                .maybeSingle();
              if (vRow) updates.vendor_name = vRow.vendor_name;
            }
          } else if (updates.vendor_name) {
            // Find vendor UUID by vendor name
            const { data: vRow } = await supabase
              .from('vendors')
              .select('id, vendor_name')
              .ilike('vendor_name', updates.vendor_name.trim())
              .maybeSingle();
            if (vRow) {
              updateData.vendor_id = vRow.id;
              updates.vendor_id = vRow.id;
              updates.vendor_name = vRow.vendor_name;
            }
          }
        }
      } else if (updates.vendor_name) {
        if (updates.vendor_name === 'Unassigned') {
          updateData.vendor_id = null;
        } else {
          const { data: vRow } = await supabase
            .from('vendors')
            .select('id, vendor_name')
            .ilike('vendor_name', updates.vendor_name.trim())
            .maybeSingle();
          if (vRow) {
            updateData.vendor_id = vRow.id;
            updates.vendor_id = vRow.id;
            updates.vendor_name = vRow.vendor_name;
          }
        }
      }

      let query = supabase.from('customers').update(updateData);
      if (isUuid) {
        query = query.eq('id', id);
      } else {
        query = query.or(`customer_id.eq.${id},order_id.eq.${id}`);
      }

      const { data, error } = await query
        .select(`
          id, customer_id, customer_name, address, mobile_number, order_id, notes, vendor_id,
          vendors(id, vendor_name, mobile_number)
        `)
        .maybeSingle();

      if (!error && data) {
        const vendorObj = Array.isArray(data.vendors) ? data.vendors[0] : data.vendors;
        const normalizedData = {
          ...data,
          vendors: vendorObj || null,
          vendor_name: vendorObj?.vendor_name || updates.vendor_name || 'Unassigned',
        };

        ensureLatestLocalData();
        const targetId = data.customer_id || data.order_id || id;
        const idx = localCustomers.findIndex((c) =>
          c.id === id || c.id === targetId || c.customer_id === targetId || c.order_id === targetId || (data.id && c.id === data.id)
        );
        if (idx !== -1) {
          localCustomers[idx] = {
            ...localCustomers[idx],
            ...updates,
            vendor_id: data.vendor_id,
            vendor_name: normalizedData.vendor_name,
          };
          saveLocal();
        }
        return normalizedData;
      }
    } catch (e) {
      // Fallback
    }
  }

  ensureLatestLocalData();
  const idx = localCustomers.findIndex((c) => c.id === id || c.order_id === id);
  if (idx !== -1) {
    localCustomers[idx] = { ...localCustomers[idx], ...updates };
    saveLocal();
    return localCustomers[idx];
  }
  return null;
}

export async function deleteCustomer(id: string) {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServiceClient();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      if (isUuid) {
        await supabase.from('subscriptions').delete().eq('customer_id', id);
        await supabase.from('customers').delete().eq('id', id);
      } else {
        // Find customer uuid first
        const { data: c } = await supabase
          .from('customers')
          .select('id')
          .or(`customer_id.eq.${id},order_id.eq.${id}`)
          .maybeSingle();
        if (c) {
          await supabase.from('subscriptions').delete().eq('customer_id', c.id);
          await supabase.from('customers').delete().eq('id', c.id);
        }
      }
    } catch (e) {
      // Fallback
    }
  }

  ensureLatestLocalData();
  const idx = localCustomers.findIndex((c) => c.id === id || c.order_id === id);
  if (idx !== -1) {
    localCustomers.splice(idx, 1);
    saveLocal();
    return true;
  }
  return false;
}

export async function renewCustomerSubscription(
  customerId: string,
  newStartDate: string,
  newEndDate: string
) {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServiceClient();
      // Mark current subscription as non-current
      await supabase
        .from('subscriptions')
        .update({ is_current: false })
        .eq('customer_id', customerId);

      // Insert new subscription
      const { data, error } = await supabase
        .from('subscriptions')
        .insert({
          customer_id: customerId,
          start_date: newStartDate,
          end_date: newEndDate,
          status: 'active',
          is_current: true,
        })
        .select()
        .single();

      if (!error && data) return data;
    } catch (e) {
      // Fallback
    }
  }

  const cust = localCustomers.find((c) => c.id === customerId);
  if (cust) {
    cust.subscriptions.forEach((s) => (s.is_current = false));
    cust.subscriptions.unshift({
      id: 'sub-' + Date.now(),
      customer_id: customerId,
      start_date: newStartDate,
      end_date: newEndDate,
      status: 'active',
      is_current: true,
    });
    saveLocal();
    return cust.subscriptions[0];
  }
  return null;
}
