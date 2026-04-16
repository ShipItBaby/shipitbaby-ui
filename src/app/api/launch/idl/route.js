import { NextResponse } from 'next/server';
import { getShipitIdl } from '@/lib/idl';
import { withBeta } from '@/lib/withBeta';

async function handler() {
    const contractAddress = process.env.SHIPIT_CONTRACT;

    if (!contractAddress) {
        return NextResponse.json({ error: 'Contract address not configured' }, { status: 500 });
    }

    try {
        const idl = await getShipitIdl();
        return NextResponse.json({ idl, contractAddress }, { status: 200 });
    } catch (err) {
        console.error('Failed to load IDL:', err);
        return NextResponse.json({ error: 'Failed to load IDL' }, { status: 500 });
    }
}

export const GET = withBeta(handler);
