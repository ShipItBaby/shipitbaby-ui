export const PROJECT_CATEGORIES = Object.freeze([
    'AI',
    'Trading',
    'Dev Tools',
    'Productivity',
    'Consumer',
    'Social',
    'Fun',
    'Experimental',
    'Other',
]);

const PROJECT_CATEGORY_COLORS = Object.freeze({
    AI: '#38bdf8',
    Trading: '#22c55e',
    'Dev Tools': '#a78bfa',
    Productivity: '#f59e0b',
    Consumer: '#f472b6',
    Social: '#d946ef',
    Fun: '#facc15',
    Experimental: '#14b8a6',
    Other: '#94a3b8',
});

function toCategoryKey(value) {
    if (typeof value !== 'string') return '';
    return value
        .trim()
        .toLowerCase()
        .replaceAll('&', 'and')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

const PROJECT_CATEGORY_BY_KEY = Object.freeze(
    PROJECT_CATEGORIES.reduce((acc, category) => {
        acc[toCategoryKey(category)] = category;
        return acc;
    }, {})
);

export function normalizeProjectCategory(value) {
    const key = toCategoryKey(value);
    if (!key) return null;
    return PROJECT_CATEGORY_BY_KEY[key] || null;
}

export function getProjectCategoryColor(value) {
    const normalizedCategory = normalizeProjectCategory(value);
    if (!normalizedCategory) return PROJECT_CATEGORY_COLORS.Other;
    return PROJECT_CATEGORY_COLORS[normalizedCategory] || PROJECT_CATEGORY_COLORS.Other;
}

export function getProjectCategoryTagStyle(value) {
    const color = getProjectCategoryColor(value);
    return {
        color,
        borderColor: color,
    };
}

export const PROJECT_CATEGORY_OPTIONS = Object.freeze(
    PROJECT_CATEGORIES.map((category) => ({
        value: category,
        label: category,
        color: getProjectCategoryColor(category),
    }))
);
