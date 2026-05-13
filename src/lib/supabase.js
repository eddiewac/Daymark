import { createClient } from '@supabase/supabase-js';

// Daymark — connected to EU hosting region (eu-west-1, Ireland).
// Moved from Tokyo region (ap-northeast-1) on 12 May 2026.
// TODO: move these to environment variables for proper production hygiene.
const SUPABASE_URL = 'https://yhzsexzgrzmghjxmxuwz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloenNleHpncnptZ2hqeG14dXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1Nzg0ODcsImV4cCI6MjA5NDE1NDQ4N30.Ww25qVwkJxY89Pks0Ac8jJMh5oTc_dAmuV2yBC6VhAI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data?.user || null;
}