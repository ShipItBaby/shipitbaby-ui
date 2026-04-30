'use client';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabaseBrowser = null;

export function getSupabaseBrowserClient() {
    if (!supabaseUrl || !supabaseAnonKey) return null;

    if (!supabaseBrowser) {
        supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false },
        });
    }

    return supabaseBrowser;
}
