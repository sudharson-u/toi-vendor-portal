import { NextResponse } from 'next/server';
import { createServiceClient, isSupabaseConfigured } from '@/lib/supabase/server';
import seedData from '@/data/seedData.json';

export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 503 });
  }

  try {
    const supabase = await createServiceClient();

    // 1. Check or insert vendors
    const vendorMap: Record<string, string> = {};
    for (const v of seedData.vendors) {
      const vName = v.vendor_name || (v as any).name;
      const { data: existing } = await supabase
        .from('vendors')
        .select('id, vendor_name')
        .eq('vendor_name', vName)
        .maybeSingle();

      if (existing) {
        vendorMap[vName] = existing.id;
      } else {
        const { data: inserted, error: vErr } = await supabase
          .from('vendors')
          .insert({
            vendor_name: vName,
            mobile_number: v.mobile || null,
          })
          .select()
          .single();
        if (inserted) {
          vendorMap[vName] = inserted.id;
        } else if (vErr) {
          console.error('Error inserting vendor:', vName, vErr.message);
        }
      }
    }

    // 2. Insert customers & subscriptions in chunks (idempotent, skips existing)
    let insertedCustCount = 0;
    const chunkSize = 25;
    for (let i = 0; i < seedData.customers.length; i += chunkSize) {
      const chunk = seedData.customers.slice(i, i + chunkSize);
      for (const c of chunk) {
        const vId = vendorMap[c.vendor_name] || null;

        // Skip if customer already exists by order_id or name+vendor
        let existingCust = null;
        if (c.order_id) {
          const { data: found } = await supabase
            .from('customers')
            .select('id')
            .eq('order_id', c.order_id)
            .maybeSingle();
          existingCust = found;
        }
        if (!existingCust && vId) {
          const { data: found } = await supabase
            .from('customers')
            .select('id')
            .eq('customer_name', c.customer_name)
            .eq('vendor_id', vId)
            .maybeSingle();
          existingCust = found;
        }

        if (existingCust) {
          continue; // Already exists, do not duplicate
        }

        const { data: cust, error: cErr } = await supabase
          .from('customers')
          .insert({
            customer_name: c.customer_name,
            customer_id: c.customer_id || null,
            address: c.address,
            mobile_number: c.mobile_number,
            order_id: c.order_id,
            vendor_id: vId,
            notes: (c as any).notes || null,
          })
          .select()
          .single();

        if (cust) {
          insertedCustCount++;
          const sub = c.subscriptions[0];
          if (sub) {
            await supabase.from('subscriptions').insert({
              customer_id: cust.id,
              start_date: sub.start_date,
              end_date: sub.end_date,
              status: sub.status,
              is_current: true,
            });
          }
        } else if (cErr) {
          console.error('Error inserting customer:', c.customer_name, cErr.message);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Seeded ${Object.keys(vendorMap).length} vendors and ${insertedCustCount} customers into Supabase`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
