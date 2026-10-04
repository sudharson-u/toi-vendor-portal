import { NextRequest, NextResponse } from 'next/server';
import { getCustomerById, updateCustomer } from '@/lib/data-source';
import { createServiceClient, isSupabaseConfigured } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const customer = await getCustomerById(id);
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }
    return NextResponse.json({ customer });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  try {
    const updated = await updateCustomer(id, {
      customer_name: body.customer_name?.trim(),
      mobile_number: body.mobile_number?.trim() || null,
      address: body.address?.trim() || null,
      order_id: body.order_id?.trim() || null,
      vendor_id: body.vendor_id || null,
      vendor_name: body.vendor_name || null,
    });

    return NextResponse.json({ customer: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServiceClient();
      await supabase.from('customers').delete().eq('id', id);
    } catch (e) {
      // Fallback
    }
  }

  return NextResponse.json({ success: true });
}
