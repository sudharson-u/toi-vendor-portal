import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, isSupabaseConfigured } from '@/lib/supabase/server';

// PUT /api/vendors/[id] - Update vendor
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const { id } = await params;
  const body = await req.json();
  const { vendor_name, mobile_number } = body;

  if (!vendor_name?.trim()) {
    return NextResponse.json({ error: 'vendor_name is required' }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('vendors')
    .update({ vendor_name: vendor_name.trim(), mobile_number: mobile_number?.trim() || null })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vendor: data });
}

// DELETE /api/vendors/[id] - Delete vendor
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const { id } = await params;
  const supabase = await createServiceClient();

  // Unassign customers first
  await supabase.from('customers').update({ vendor_id: null }).eq('vendor_id', id);

  const { error } = await supabase.from('vendors').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
