const IDL_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let cachedIdl = null;
let cachedAt = null;

export async function getShipitIdl() {
    const now = Date.now();

    if (cachedIdl && cachedAt && now - cachedAt < IDL_CACHE_TTL_MS) {
        return cachedIdl;
    }

    const idlUrl = process.env.SHIPIT_IDL;

    if (!idlUrl) {
        throw new Error('Missing environment variable: SHIPIT_IDL');
    }

    const response = await fetch(idlUrl);

    if (!response.ok) {
        throw new Error(`Failed to fetch Shipit IDL: ${response.status} ${response.statusText}`);
    }

    const idl = await response.json();

    cachedIdl = idl;
    cachedAt = now;

    return idl;
}
