import { NextRequest, NextResponse } from 'next/server';
import { getCustomerById, updateCustomer, deleteCustomer } from '@/lib/data-source';

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
    const updates: Record<string, any> = {};

    if (body.customer_name !== undefined) {
      updates.customer_name = body.customer_name?.trim();
    }
    if (body.mobile_number !== undefined) {
      updates.mobile_number = body.mobile_number?.trim() || null;
    }
    if (body.address !== undefined) {
      updates.address = body.address?.trim() || null;
    }
    if (body.order_id !== undefined) {
      updates.order_id = body.order_id?.trim() || null;
    }
    if (body.vendor_id !== undefined) {
      const vid = typeof body.vendor_id === 'string' ? body.vendor_id.trim() : body.vendor_id;
      updates.vendor_id = vid || null;
    }
    if (body.vendor_name !== undefined) {
      const vname = typeof body.vendor_name === 'string' ? body.vendor_name.trim() : body.vendor_name;
      updates.vendor_name = vname || null;
    }
    if (body.notes !== undefined) {
      updates.notes = typeof body.notes === 'string' ? body.notes : '';
    }

    const updated = await updateCustomer(id, updates);
    return NextResponse.json({ customer: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const PATCH = PUT;

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const success = await deleteCustomer(id);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
