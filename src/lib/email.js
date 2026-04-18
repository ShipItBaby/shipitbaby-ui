const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZERO_WIDTH_CHARS = /[\u200B-\u200D\uFEFF]/g;
const MAX_EMAIL_LENGTH = 254;

export function sanitizeEmailInput(value) {
    if (typeof value !== 'string') return '';

    return value
        .normalize('NFKC')
        .replace(ZERO_WIDTH_CHARS, '')
        .trim()
        .toLowerCase();
}

export function isValidEmailInput(value) {
    if (typeof value !== 'string') return false;
    if (value.length < 3 || value.length > MAX_EMAIL_LENGTH) return false;
    if (value.includes(' ')) return false;
    return BASIC_EMAIL_REGEX.test(value);
}
