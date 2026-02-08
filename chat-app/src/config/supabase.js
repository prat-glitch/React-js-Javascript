// src/config/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jlmfkbvxmqrbnidrhryc.supabase.co'; // e.g., https://xxxxx.supabase.co
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsbWZrYnZ4bXFyYm5pZHJocnljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NTMxNTQsImV4cCI6MjA4NjAyOTE1NH0.9B-6SQfgzd_WXsGCApzLdWoBfCc6ppiLvhyAnMvgLd4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
