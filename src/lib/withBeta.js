import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionWalletFromRequest } from '@/lib/authSession';

/**
 * Higher-order function that wraps an API route handler and ensures
 * the requesting authenticated wallet belongs to a beta user.
 * Wallet is read from the signed HttpOnly session cookie.
 */
export function withBeta(handler) {
    return async function (request, context) {
        const wallet = getSessionWalletFromRequest(request);
        if (!wallet) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
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
