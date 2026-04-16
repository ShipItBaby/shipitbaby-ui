import { NextResponse } from 'next/server';
import { getSessionWalletFromRequest } from '@/lib/authSession';

export async function GET(request) {
    const wallet = getSessionWalletFromRequest(request);
    if (!wallet) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    return NextResponse.json({ authenticated: true, wallet }, { status: 200 });
}
