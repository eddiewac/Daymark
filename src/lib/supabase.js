import { createClient } from '@supabase/supabase-js';

// These match the existing app. Move to .env later for production hygiene.
const SUPABASE_URL = 'https://oxgbaduigrdgratvevfx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94Z2JhZHVpZ3JkZ3JhdHZldmZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDQ2NDAsImV4cCI6MjA5MTgyMDY0MH0.XXMc5aygEE393k4O_fvVEI2TtyxffMqua8Eitw5RKws';

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
