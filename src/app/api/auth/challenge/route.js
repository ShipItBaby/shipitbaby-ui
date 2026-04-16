import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import {
    createChallenge,
    setChallengeCookie,
} from '@/lib/authSession';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet || typeof wallet !== 'string') {
        return NextResponse.json({ error: 'wallet parameter required' }, { status: 400 });
    }

    let normalizedWallet;
    try {
        normalizedWallet = new PublicKey(wallet).toBase58();
    } catch {
        return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    const domain = request.headers.get('host') || 'shipit.baby';
    const { challenge, message } = createChallenge(normalizedWallet, domain);
    const response = NextResponse.json(
        { message, expiresAt: challenge.expiresAt },
        { status: 200 }
    );
    setChallengeCookie(response, challenge);
    return response;
}
