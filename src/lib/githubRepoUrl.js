const GITHUB_HOSTS = new Set(['github.com', 'www.github.com']);

function stripGitSuffix(value) {
    return value.endsWith('.git') ? value.slice(0, -4) : value;
}

function assertGithubPathPart(value, fieldName) {
    if (!value || value === '.' || value === '..') {
        throw new Error(`${fieldName} is invalid`);
    }
    if (!/^[A-Za-z0-9._-]+$/.test(value)) {
        throw new Error(`${fieldName} is invalid`);
    }
}

export function normalizeGithubRepoUrl(value) {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') {
        throw new Error('repo_url must be a string');
    }

    const trimmed = value.trim();
    if (!trimmed) return null;

    const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/(.+?)$/i);
    if (sshMatch) {
        const owner = sshMatch[1];
        const repo = stripGitSuffix(sshMatch[2].replace(/\/+$/, ''));
        assertGithubPathPart(owner, 'GitHub owner');
        assertGithubPathPart(repo, 'GitHub repo');
        return `https://github.com/${owner}/${repo}`;
    }

    const urlCandidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    let parsed;
    try {
        parsed = new URL(urlCandidate);
    } catch {
        throw new Error('repo_url must be a valid GitHub repository URL');
    }

    if (!GITHUB_HOSTS.has(parsed.hostname.toLowerCase())) {
        throw new Error('repo_url must be a GitHub repository URL');
    }

    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length < 2) {
        throw new Error('repo_url must include a GitHub owner and repository');
    }

    const owner = parts[0];
    const repo = stripGitSuffix(parts[1]);
    assertGithubPathPart(owner, 'GitHub owner');
    assertGithubPathPart(repo, 'GitHub repo');

    return `https://github.com/${owner}/${repo}`;
}
