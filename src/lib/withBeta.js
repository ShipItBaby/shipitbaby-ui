import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Higher-order function that wraps an API route handler and ensures
 * the requesting wallet belongs to a beta user.
 *
 * Expects the wallet address to be provided as:
 *   - GET  → ?wallet= query parameter
 *   - POST → { wallet } in the JSON body
 *
 * Returns 400 if wallet is missing, 403 if the user is not a beta user.
 */
export function withBeta(handler) {
    return async function (request, context) {
        let wallet;

        if (request.method === 'GET') {
            const { searchParams } = new URL(request.url);
            wallet = searchParams.get('wallet');
        } else {
            try {
                const cloned = request.clone();
                const body = await cloned.json();
                wallet = body.wallet;
            } catch {
                return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
            }
        }

        if (!wallet || typeof wallet !== 'string') {
            return NextResponse.json({ error: 'wallet is required' }, { status: 400 });
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('is_beta')
            .eq('wallet', wallet)
            .single();

        if (error || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (user.is_beta !== true) {
            return NextResponse.json({ error: 'Beta access required' }, { status: 403 });
        }

        return handler(request, context);
    };
}
