import { NextResponse } from 'next/server';
import { getAdminWalletAllowlist, isAdminWallet } from '@/lib/adminWallets';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
        return NextResponse.json({ error: 'wallet parameter required' }, { status: 400 });
    }

    const allowlist = getAdminWalletAllowlist();
    if (allowlist.length === 0) {
        return NextResponse.json({ error: 'Admin wallet not configured' }, { status: 500 });
    }

    return NextResponse.json(
        { allowed: isAdminWallet(wallet) },
        { status: 200 }
    );
}
