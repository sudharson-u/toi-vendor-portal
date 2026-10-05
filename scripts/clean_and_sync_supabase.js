const { createClient } = require('@supabase/supabase-js');
const seedData = require('../src/data/seedData.json');
const fs = require('fs');
const path = require('path');

let envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let envKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) envUrl = envUrl || trimmed.split('=')[1]?.trim();
    if (trimmed.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) envKey = envKey || trimmed.split('=')[1]?.trim();
  }
}

const supabase = createClient(envUrl, envKey, { auth: { persistSession: false } });

async function sync() {
  console.log('--- Step 1: Ensure All Vendors Exist in Supabase ---');
  let { data: vendors } = await supabase.from('vendors').select('id, vendor_name');
  const vMap = {};
  vendors.forEach(v => { vMap[v.vendor_name.toLowerCase()] = v.id; });

  for (const v of seedData.vendors) {
    const vName = v.vendor_name || v.name;
    if (!vMap[vName.toLowerCase()]) {
      const { data: newV, error: vErr } = await supabase
        .from('vendors')
        .insert({
          vendor_name: vName,
          mobile_number: v.mobile || null,
        })
        .select()
        .single();
      if (newV) {
        vMap[vName.toLowerCase()] = newV.id;
        console.log(`Inserted vendor: ${vName} (${newV.id})`);
      } else {
        console.error(`Failed to insert vendor ${vName}:`, vErr);
      }
    }
  }

  // Refresh vendors
  const { data: updatedVendors } = await supabase.from('vendors').select('id, vendor_name');
  updatedVendors.forEach(v => { vMap[v.vendor_name.toLowerCase()] = v.id; });
  console.log(`All ${updatedVendors.length} vendors ready.`);

  console.log('\n--- Step 2: Identify and Remove Duplicate Customers ---');
  const { data: existingCusts } = await supabase
    .from('customers')
    .select('id, customer_name, order_id, created_at')
    .order('created_at', { ascending: true });

  const seenOrders = new Map();
  const duplicateIdsToDelete = [];

  for (const c of existingCusts) {
    const key = c.order_id || c.customer_name;
    if (seenOrders.has(key)) {
      duplicateIdsToDelete.push(c.id);
    } else {
      seenOrders.set(key, c.id);
    }
  }

  console.log(`Found ${duplicateIdsToDelete.length} duplicate customer records to delete.`);

  // Delete duplicates in batches
  for (let i = 0; i < duplicateIdsToDelete.length; i += 50) {
    const batch = duplicateIdsToDelete.slice(i, i + 50);
    // Subscriptions cascade on customer delete
    await supabase.from('subscriptions').delete().in('customer_id', batch);
    const { error: delErr } = await supabase.from('customers').delete().in('id', batch);
    if (delErr) {
      console.error('Error deleting batch:', delErr);
    }
  }

  const { count: countAfterDelete } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true });
  console.log(`Customer count after deduplication: ${countAfterDelete}`);

  console.log('\n--- Step 3: Insert Missing Customers (including Palani) ---');
  const { data: currentCusts } = await supabase.from('customers').select('order_id');
  const existingOrderSet = new Set((currentCusts || []).map(c => c.order_id).filter(Boolean));

  let insertedCount = 0;
  for (const c of seedData.customers) {
    if (existingOrderSet.has(c.order_id)) {
      continue;
    }

    const vId = vMap[c.vendor_name.toLowerCase()] || null;
    const { data: newCust, error: cErr } = await supabase
      .from('customers')
      .insert({
        customer_id: c.customer_id,
        customer_name: c.customer_name,
        address: c.address,
        mobile_number: c.mobile_number,
        order_id: c.order_id,
        notes: c.notes || '',
        vendor_id: vId,
      })
      .select()
      .single();

    if (cErr || !newCust) {
      console.error(`Error inserting ${c.customer_name}:`, cErr?.message);
      continue;
    }

    insertedCount++;
    const sub = c.subscriptions?.[0];
    if (sub) {
      await supabase.from('subscriptions').insert({
        customer_id: newCust.id,
        start_date: sub.start_date,
        end_date: sub.end_date,
        status: sub.status || 'active',
        is_current: true,
      });
    }
  }

  console.log(`Inserted ${insertedCount} new customers into Supabase.`);

  const { count: finalCount } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true });
  console.log(`\nFinal unique customer count in Supabase: ${finalCount}`);

  // Check vendor distribution
  const { data: allFinal } = await supabase.from('customers').select('id, vendor_id, vendors(vendor_name)');
  const vCounts = {};
  allFinal.forEach(c => {
    const vName = c.vendors?.vendor_name || 'Unassigned';
    vCounts[vName] = (vCounts[vName] || 0) + 1;
  });
  console.log('\nCustomer count per vendor in Supabase:');
  console.table(vCounts);
}

sync().catch(console.error);
