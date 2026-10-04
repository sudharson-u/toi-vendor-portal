import { NextRequest, NextResponse } from 'next/server';
import { renewCustomerSubscription } from '@/lib/data-source';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { start_date, end_date } = body;

    if (!start_date || !end_date) {
      return NextResponse.json({ error: 'start_date and end_date are required' }, { status: 400 });
    }

    const sub = await renewCustomerSubscription(id, start_date, end_date);
    return NextResponse.json({ subscription: sub });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
