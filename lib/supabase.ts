import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://tqeilnquadxbmdtwyngt.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxZWlsbnF1YWR4Ym1kdHd5bmd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMzIxMzAsImV4cCI6MjA4MTkwODEzMH0.lnLKZSuLc9fiZYhxNIBDyKwbjP34tkKGU3dRoSnZyMs";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);