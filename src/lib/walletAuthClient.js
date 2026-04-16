function toBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function extractSignatureBytes(signedMessage) {
    if (signedMessage instanceof Uint8Array) return signedMessage;

    if (signedMessage && signedMessage.signature instanceof Uint8Array) {
        return signedMessage.signature;
    }

    if (Array.isArray(signedMessage)) {
        return Uint8Array.from(signedMessage);
    }

    if (signedMessage && Array.isArray(signedMessage.signature)) {
        return Uint8Array.from(signedMessage.signature);
    }

    return null;
}

export async function ensureWalletSession(walletProvider, walletAddress) {
    if (!walletProvider) throw new Error('Wallet provider not found');
    if (!walletAddress) throw new Error('Wallet address is required');

    const sessionRes = await fetch('/api/auth/session', { method: 'GET' });
    if (sessionRes.ok) {
        const sessionData = await sessionRes.json().catch(() => ({}));
        if (sessionData?.authenticated === true && sessionData.wallet === walletAddress) {
            return;
        }
    }

    if (typeof walletProvider.signMessage !== 'function') {
        throw new Error('Wallet does not support message signing');
    }

    const challengeRes = await fetch(`/api/auth/challenge?wallet=${walletAddress}`, { method: 'GET' });
    const challengeData = await challengeRes.json().catch(() => ({}));
    if (!challengeRes.ok || !challengeData?.message) {
        throw new Error(challengeData?.error || 'Failed to create auth challenge');
    }

    const message = challengeData.message;
    const messageBytes = new TextEncoder().encode(message);
    const signedMessage = await walletProvider.signMessage(messageBytes, 'utf8');
    const signatureBytes = extractSignatureBytes(signedMessage);
    if (!signatureBytes) {
        throw new Error('Wallet returned invalid signature payload');
    }

    const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            wallet: walletAddress,
            message,
            signature: toBase64(signatureBytes),
        }),
    });
    const verifyData = await verifyRes.json().catch(() => ({}));
    if (!verifyRes.ok || verifyData?.authenticated !== true) {
        throw new Error(verifyData?.error || 'Failed to verify wallet signature');
    }
}

export async function clearWalletSession() {
    await fetch('/api/auth/logout', { method: 'POST' });
}
