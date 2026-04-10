import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\s/g, '');
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.replace(/\s/g, '');

console.log('[supabase] url:', JSON.stringify(url));
console.log('[supabase] key length:', key?.length);

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(url, key);
