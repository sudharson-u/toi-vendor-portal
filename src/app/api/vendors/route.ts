import { NextRequest, NextResponse } from 'next/server';
import { getAllVendors } from '@/lib/data-source';
import { createServiceClient, isSupabaseConfigured } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const vendors = await getAllVendors();
    return NextResponse.json({ vendors });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vendor_name, mobile_number } = body;

    if (!vendor_name?.trim()) {
      return NextResponse.json({ error: 'vendor_name is required' }, { status: 400 });
    }

    if (isSupabaseConfigured()) {
      try {
        const supabase = await createServiceClient();
        const { data, error } = await supabase
          .from('vendors')
          .insert({ vendor_name: vendor_name.trim(), mobile_number: mobile_number?.trim() || null })
          .select()
          .single();

        if (!error && data) {
          return NextResponse.json({ vendor: data }, { status: 201 });
        }
      } catch (e) {
        // Fallback
      }
    }

    const fallbackVendor = {
      id: 'vendor-' + Date.now(),
      vendor_name: vendor_name.trim(),
      mobile_number: mobile_number?.trim() || null,
      customer_count: 0,
    };

    return NextResponse.json({ vendor: fallbackVendor }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
