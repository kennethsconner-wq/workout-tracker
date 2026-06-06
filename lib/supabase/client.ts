import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { secureAuthStorage } from '@/lib/auth/authStorage';
import { getSupabaseConfig } from '@/lib/supabase/config';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) {
    return supabaseClient;
  }

  const config = getSupabaseConfig();
  if (!config) {
    return null;
  }

  supabaseClient = createClient(config.url, config.anonKey, {
    auth: {
      storage: secureAuthStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  return supabaseClient;
}
