import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request) {
    let payload;

    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { wallet, connected_wallet_type, github_username } = payload;

    if (!wallet || typeof wallet !== 'string') {
        return NextResponse.json({ error: 'wallet is required' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Create the update payload: avoid overriding existing data with undefined
    const upsertPayload = { wallet, last_seen_at: now, updated_at: now };
    if (connected_wallet_type !== undefined) upsertPayload.connected_wallet_type = connected_wallet_type;
    if (github_username !== undefined) upsertPayload.github_username = github_username;

    const { data, error } = await supabase
        .from('users')
        .upsert(
            upsertPayload,
            { onConflict: 'wallet', ignoreDuplicates: false }
        )
        .single();

    if (error) {
        console.error('Supabase upsert error:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ user: data }, { status: 200 });
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
        return NextResponse.json({ error: 'wallet parameter required' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('wallet', wallet)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return NextResponse.json({ user: null }, { status: 200 }); 
        console.error('Supabase get error:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ user: data }, { status: 200 });
}

