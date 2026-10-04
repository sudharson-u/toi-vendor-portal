const { createClient } = require('@supabase/supabase-js');
const seedData = require('../src/data/seedData.json');

const fs = require('fs');
const path = require('path');

// Read from .env.local if present
let envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let envKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
      envUrl = envUrl || trimmed.split('=')[1]?.trim();
    }
    if (trimmed.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
      envKey = envKey || trimmed.split('=')[1]?.trim();
    }
  }
}

const url = envUrl || '';
const serviceKey = envKey || '';
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

async function seed() {
  console.log('--- Starting Full Supabase Sync ---');

  // 1. Map existing vendors
  const { data: existingVendors, error: vErr } = await supabase.from('vendors').select('id, vendor_name');
  if (vErr) {
    console.error('Failed to get vendors:', vErr);
    return;
  }

  const vendorMap = {};
  existingVendors.forEach((v) => {
    vendorMap[v.vendor_name.toLowerCase()] = v.id;
  });

  // Ensure all 14 vendors are present
  for (const v of seedData.vendors) {
    const vName = v.vendor_name || v.name;
    if (!vendorMap[vName.toLowerCase()]) {
      const { data: newV, error: insErr } = await supabase
        .from('vendors')
        .insert({
          vendor_name: vName,
          mobile_number: v.mobile || null,
        })
        .select()
        .single();
      if (newV) {
        vendorMap[vName.toLowerCase()] = newV.id;
        console.log(`Inserted vendor: ${vName}`);
      } else {
        console.error(`Failed to insert vendor ${vName}:`, insErr);
      }
    }
  }

  console.log(`Vendor mapping complete (${Object.keys(vendorMap).length} vendors).`);

  // 2. Check if customers already exist
  const { data: existingCusts } = await supabase.from('customers').select('id, order_id');
  const existingOrderMap = new Set((existingCusts || []).map((c) => c.order_id).filter(Boolean));
  console.log(`Existing customers in Supabase: ${existingOrderMap.size}`);

  let insertedCount = 0;
  let skippedCount = 0;
  let subCount = 0;

  for (const c of seedData.customers) {
    if (existingOrderMap.has(c.order_id)) {
      skippedCount++;
      continue;
    }

    const vId = vendorMap[c.vendor_name.toLowerCase()] || null;

    const { data: cust, error: cErr } = await supabase
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

    if (cErr || !cust) {
      console.error(`Error inserting customer ${c.customer_name}:`, cErr?.message);
      continue;
    }

    insertedCount++;
    const sub = c.subscriptions?.[0];
    if (sub) {
      const { error: sErr } = await supabase.from('subscriptions').insert({
        customer_id: cust.id,
        start_date: sub.start_date,
        end_date: sub.end_date,
        status: sub.status || 'active',
        is_current: true,
      });
      if (!sErr) subCount++;
      else console.error(`Error inserting subscription for ${c.customer_name}:`, sErr.message);
    }
  }

  console.log(`\nSync Summary:`);
  console.log(`- Inserted customers: ${insertedCount}`);
  console.log(`- Inserted subscriptions: ${subCount}`);
  console.log(`- Skipped (already existed): ${skippedCount}`);

  // Verify Mohammed Saifullah Advocate
  const { data: saif, error: saifErr } = await supabase
    .from('customers')
    .select('*, vendors(vendor_name), subscriptions(*)')
    .eq('order_id', 'SCT55863557')
    .single();

  console.log('\n--- Verification in Supabase for SCT55863557 ---');
  if (saif) {
    console.log({
      id: saif.id,
      name: saif.customer_name,
      order: saif.order_id,
      vendor: saif.vendors?.vendor_name,
      address: saif.address,
      subscription: saif.subscriptions?.[0],
    });
  } else {
    console.error('Record not found:', saifErr);
  }
}

seed();
