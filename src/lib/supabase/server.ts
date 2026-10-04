import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  if (url.includes('your_supabase') || key.includes('your_supabase')) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function createClient() {
  const cookieStore = await cookies();
  const configured = isSupabaseConfigured();

  const url = configured
    ? process.env.NEXT_PUBLIC_SUPABASE_URL!
    : 'https://placeholder.supabase.co';
  const key = configured
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    : 'placeholder-key';

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Ignore errors from Server Components
        }
      },
    },
  });
}

export async function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
