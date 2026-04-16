import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import {
    buildWalletAuthMessage,
    clearChallengeCookie,
    getChallengeFromRequest,
    setSessionCookie,
} from '@/lib/authSession';

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function verifyWalletSignature(wallet, message, signatureBase64) {
    let signature;
    try {
        signature = Buffer.from(signatureBase64, 'base64');
    } catch {
        return false;
    }

    if (signature.length !== 64) return false;

    const walletBytes = new PublicKey(wallet).toBytes();
    const publicKeyDer = Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(walletBytes)]);
    const keyObject = crypto.createPublicKey({
        key: publicKeyDer,
        format: 'der',
        type: 'spki',
    });

    return crypto.verify(
        null,
        Buffer.from(message, 'utf8'),
        keyObject,
        signature
    );
}

export async function POST(request) {
    let payload;
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { wallet, message, signature } = payload;
    if (!wallet || !message || !signature) {
        return NextResponse.json(
            { error: 'wallet, message, and signature are required' },
            { status: 400 }
        );
    }

    let normalizedWallet;
    try {
        normalizedWallet = new PublicKey(wallet).toBase58();
    } catch {
        return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    const challenge = getChallengeFromRequest(request);
    if (!challenge) {
        return NextResponse.json(
            { error: 'Authentication challenge is missing or expired' },
            { status: 401 }
        );
    }

    if (challenge.wallet !== normalizedWallet) {
        return NextResponse.json(
            { error: 'Challenge wallet mismatch' },
            { status: 401 }
        );
    }

    const expectedMessage = buildWalletAuthMessage(challenge);
    if (message !== expectedMessage) {
        return NextResponse.json(
            { error: 'Signed message mismatch' },
            { status: 401 }
        );
    }

    if (!verifyWalletSignature(normalizedWallet, message, signature)) {
        return NextResponse.json(
            { error: 'Invalid wallet signature' },
            { status: 401 }
        );
    }

    const response = NextResponse.json(
        { authenticated: true, wallet: normalizedWallet },
        { status: 200 }
    );
    setSessionCookie(response, normalizedWallet);
    clearChallengeCookie(response);
    return response;
}
