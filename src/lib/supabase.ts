import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and anon key must be set in environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type AuthUser = Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'];
