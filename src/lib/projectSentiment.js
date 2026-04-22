export const SENTIMENT_OPTIONS = Object.freeze([
    { key: 'bullish', label: 'Bullish', color: '#06d6a0' },
    { key: 'shipping', label: 'Shipping', color: '#38bdf8' },
    { key: 'underrated', label: 'Underrated', color: '#a78bfa' },
    { key: 'would_use', label: 'Would Use', color: '#22c55e' },
    { key: 'would_pay', label: 'Would Pay', color: '#f59e0b' },
    { key: 'promising', label: 'Promising', color: '#7c3aed' },
    { key: 'dead', label: 'Dead', color: '#ef4444' },
]);

export const SENTIMENT_KEYS = Object.freeze(SENTIMENT_OPTIONS.map((item) => item.key));

export function normalizeSentiment(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase().replaceAll('-', '_').replaceAll(' ', '_');
    return SENTIMENT_KEYS.includes(normalized) ? normalized : null;
}

export function createEmptySentimentCounts() {
    const counts = {};
    for (const key of SENTIMENT_KEYS) {
        counts[key] = 0;
    }
    return counts;
}

export function toSentimentCounts(rawCounts) {
    const counts = createEmptySentimentCounts();
    if (!rawCounts || typeof rawCounts !== 'object') return counts;

    for (const key of SENTIMENT_KEYS) {
        const value = rawCounts[key];
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
            counts[key] = value;
        }
    }
    return counts;
}

export function tallySentimentCounts(rows) {
    const counts = createEmptySentimentCounts();
    if (!Array.isArray(rows)) return counts;

    for (const row of rows) {
        const key = normalizeSentiment(row?.sentiment);
        if (!key) continue;
        counts[key] += 1;
    }

    return counts;
}
