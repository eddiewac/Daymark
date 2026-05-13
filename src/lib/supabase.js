import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yhzsexzgrzmghjxmxuwz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloenNleHpncnptZ2hqeG14dXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1Nzg0ODcsImV4cCI6MjA5NDE1NDQ4N30.Ww25qVwkJxY89Pks0Ac8jJMh5oTc_dAmuV2yBC6VhAI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Read user from the cached session rather than calling getUser(). getSession()
// returns from local storage when fresh — no network round-trip, no auth-lock
// acquisition. Far less prone to lock-contention pile-ups on slow networks.
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data?.session?.user || null;
}