import crypto from 'node:crypto';

const SESSION_COOKIE_NAME = 'shipit_session';
const CHALLENGE_COOKIE_NAME = 'shipit_auth_challenge';

const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours
const CHALLENGE_TTL_SECONDS = 60 * 5; // 5 minutes

function getSessionSecret() {
    const secret = process.env.SHIPIT_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) {
        throw new Error('Missing SHIPIT_SESSION_SECRET (or SUPABASE_SERVICE_ROLE_KEY fallback).');
    }
    return secret;
}

function toBase64Url(value) {
    return Buffer.from(value)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function fromBase64Url(value) {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = `${normalized}${'='.repeat(padLength)}`;
    return Buffer.from(padded, 'base64');
}

function signPayload(payloadString) {
    return crypto
        .createHmac('sha256', getSessionSecret())
        .update(payloadString)
        .digest();
}

function safeSignatureEquals(left, right) {
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
}

function encodeSignedObject(obj) {
    const payload = toBase64Url(JSON.stringify(obj));
    const signature = toBase64Url(signPayload(payload));
    return `${payload}.${signature}`;
}

function decodeSignedObject(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;

    const expectedSignature = signPayload(payload);
    const providedSignature = fromBase64Url(signature);
    if (!safeSignatureEquals(expectedSignature, providedSignature)) return null;

    try {
        return JSON.parse(fromBase64Url(payload).toString('utf8'));
    } catch {
        return null;
    }
}

export function buildWalletAuthMessage({ wallet, nonce, issuedAt, expiresAt, domain }) {
    return [
        'Sign in to ShipIt',
        `Domain: ${domain}`,
        `Wallet: ${wallet}`,
        `Nonce: ${nonce}`,
        `Issued At: ${issuedAt}`,
        `Expires At: ${expiresAt}`,
    ].join('\n');
}

function isExpiredIso(isoDate) {
    const ts = Date.parse(isoDate);
    if (Number.isNaN(ts)) return true;
    return ts <= Date.now();
}

export function createChallenge(wallet, domain) {
    const nonce = crypto.randomBytes(16).toString('hex');
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000).toISOString();

    const challenge = { wallet, nonce, issuedAt, expiresAt, domain };
    const message = buildWalletAuthMessage(challenge);
    return { challenge, message };
}

export function setChallengeCookie(response, challenge) {
    response.cookies.set(CHALLENGE_COOKIE_NAME, encodeSignedObject(challenge), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: CHALLENGE_TTL_SECONDS,
    });
}

export function getChallengeFromRequest(request) {
    const value = request.cookies.get(CHALLENGE_COOKIE_NAME)?.value;
    const decoded = decodeSignedObject(value);
    if (!decoded) return null;
    if (isExpiredIso(decoded.expiresAt)) return null;
    return decoded;
}

export function clearChallengeCookie(response) {
    response.cookies.set(CHALLENGE_COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
    });
}

function createSessionToken(wallet) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const exp = nowSeconds + SESSION_TTL_SECONDS;
    return encodeSignedObject({ wallet, exp });
}

export function setSessionCookie(response, wallet) {
    response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(wallet), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_TTL_SECONDS,
    });
}

export function clearSessionCookie(response) {
    response.cookies.set(SESSION_COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
    });
}

export function getSessionWalletFromRequest(request) {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    return getSessionWalletFromToken(token);
}

export function getSessionWalletFromToken(token) {
    const decoded = decodeSignedObject(token);
    if (!decoded || !decoded.wallet || !decoded.exp) return null;

    const exp = Number(decoded.exp);
    if (!Number.isFinite(exp)) return null;
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (exp <= nowSeconds) return null;
    return decoded.wallet;
}

export { CHALLENGE_COOKIE_NAME, SESSION_COOKIE_NAME };
