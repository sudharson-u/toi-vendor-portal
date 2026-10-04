import { NextRequest, NextResponse } from 'next/server';
import { getAllCustomers, createCustomer } from '@/lib/data-source';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || '';
  const vendorFilter = searchParams.get('vendor') || '';
  const expiryFilter = searchParams.get('expiry') || '';
  const sort = searchParams.get('sort') || 'customer_name';
  const dir = (searchParams.get('dir') === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(1000, parseInt(searchParams.get('limit') || '20'));

  try {
    const res = await getAllCustomers({
      search,
      statusFilter,
      vendorFilter,
      expiryFilter,
      sort,
      dir,
      page,
      limit,
    });

    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customer_name,
      order_id,
      address,
      mobile_number,
      notes,
      vendor_id,
      vendor_name,
      start_date,
      end_date,
    } = body;

    if (!customer_name || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'customer_name, start_date and end_date are required' },
        { status: 400 }
      );
    }

    const customer = await createCustomer({
      customer_name,
      order_id,
      address,
      mobile_number,
      notes,
      vendor_id,
      vendor_name,
      start_date,
      end_date,
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
