import { NextResponse } from 'next/server';
import {
    clearChallengeCookie,
    clearSessionCookie,
} from '@/lib/authSession';

export async function POST() {
    const response = NextResponse.json({ ok: true }, { status: 200 });
    clearSessionCookie(response);
    clearChallengeCookie(response);
    return response;
}
