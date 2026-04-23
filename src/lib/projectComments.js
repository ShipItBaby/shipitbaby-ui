export const PROJECT_COMMENT_MAX_CHARS = 240;

export function sanitizeProjectCommentBody(value) {
    if (typeof value !== 'string') return '';

    return value
        .replace(/\r\n?/g, '\n')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .replace(/[<>]/g, '');
}

export function normalizeProjectCommentBody(value) {
    return sanitizeProjectCommentBody(value).trim();
}

export function getProjectCommentLength(value) {
    if (typeof value !== 'string') return 0;
    return Array.from(value).length;
}

export function trimProjectCommentToMaxChars(
    value,
    maxChars = PROJECT_COMMENT_MAX_CHARS
) {
    if (typeof value !== 'string') return '';
    if (!Number.isInteger(maxChars) || maxChars <= 0) return '';

    return Array.from(value).slice(0, maxChars).join('');
}
