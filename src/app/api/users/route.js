import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request) {
    let wallet;

    try {
        ({ wallet } = await request.json());
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (!wallet || typeof wallet !== 'string') {
        return NextResponse.json({ error: 'wallet is required' }, { status: 400 });
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('users')
        .upsert(
            { wallet, last_seen_at: now, updated_at: now },
            { onConflict: 'wallet', ignoreDuplicates: false }
        )
        .select()
        .single();

    if (error) {
        console.error('Supabase upsert error:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ user: data }, { status: 200 });
}
