import { NextResponse } from 'next/server';
import { getShipitIdl } from '@/lib/idl';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    const contractAddress = process.env.SHIPIT_CONTRACT;
    if (!wallet) {
        return NextResponse.json({ error: 'wallet parameter required' }, { status: 400 });
    }

    if (!contractAddress) {
        return NextResponse.json({ error: 'Contract address not configured' }, { status: 500 });
    }

    try {
        const idl = await getShipitIdl();
        return NextResponse.json({ idl, contractAddress }, { status: 200 });
    } catch (err) {
        console.error('Failed to load IDL for admin configure:', err);
        return NextResponse.json({ error: 'Failed to load IDL' }, { status: 500 });
    }
}
