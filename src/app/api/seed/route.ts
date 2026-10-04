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
      const { data: existing } = await supabase
        .from('vendors')
        .select('id, vendor_name')
        .eq('vendor_name', v.vendor_name)
        .maybeSingle();

      if (existing) {
        vendorMap[v.vendor_name] = existing.id;
      } else {
        const { data: inserted, error: vErr } = await supabase
          .from('vendors')
          .insert({ vendor_name: v.vendor_name })
          .select()
          .single();
        if (inserted) {
          vendorMap[v.vendor_name] = inserted.id;
        } else if (vErr) {
          console.error('Error inserting vendor:', v.vendor_name, vErr.message);
        }
      }
    }

    // 2. Insert customers & subscriptions in chunks
    let insertedCustCount = 0;
    const chunkSize = 25;
    for (let i = 0; i < seedData.customers.length; i += chunkSize) {
      const chunk = seedData.customers.slice(i, i + chunkSize);
      for (const c of chunk) {
        const vId = vendorMap[c.vendor_name] || null;
        const { data: cust, error: cErr } = await supabase
          .from('customers')
          .insert({
            customer_name: c.customer_name,
            address: c.address,
            mobile_number: c.mobile_number,
            order_id: c.order_id,
            vendor_id: vId,
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
