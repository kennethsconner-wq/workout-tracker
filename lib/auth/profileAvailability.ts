import { getSupabaseClient } from '@/lib/supabase/client';

export async function isEmailAvailable(email: string): Promise<boolean | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.rpc('is_email_available', {
    requested_email: email.trim(),
  });

  if (error) {
    throw error;
  }

  return data === true;
}

export async function isUsernameAvailable(
  username: string,
  excludeUserId?: string | null,
): Promise<boolean | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.rpc('is_username_available', {
    requested_username: username.trim(),
    exclude_user_id: excludeUserId ?? null,
  });

  if (error) {
    throw error;
  }

  return data === true;
}

export async function updateProfileUsername(username: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { error } = await supabase.rpc('update_profile_username', {
    requested_username: username.trim(),
  });

  if (error) {
    throw error;
  }
}
