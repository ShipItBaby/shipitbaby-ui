import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionWalletFromRequest } from '@/lib/authSession';

export async function GET(request) {
    const wallet = getSessionWalletFromRequest(request);
    if (!wallet) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: user, error: userError } = await supabase
        .from('users')
        .select('github_username')
        .eq('wallet', wallet)
        .single();

    if (userError || !user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const githubUsername = typeof user.github_username === 'string'
        ? user.github_username.trim()
        : '';
    if (!githubUsername) {
        return NextResponse.json({ github_username: null, repos: [] }, { status: 200 });
    }

    const githubRes = await fetch(
        `https://api.github.com/users/${encodeURIComponent(githubUsername)}/repos?type=owner&sort=updated&direction=desc&per_page=100`,
        {
            headers: {
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
            },
            cache: 'no-store',
        }
    );

    const githubData = await githubRes.json().catch(() => null);
    if (!githubRes.ok || !Array.isArray(githubData)) {
        console.error('GitHub public repos fetch error:', githubData);
        return NextResponse.json(
            { error: 'Failed to load public GitHub repositories' },
            { status: 502 }
        );
    }

    const repos = githubData
        .filter((repo) => repo && repo.private !== true && typeof repo.html_url === 'string')
        .map((repo) => ({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            url: repo.html_url,
            description: repo.description,
            fork: repo.fork === true,
            pushed_at: repo.pushed_at,
            updated_at: repo.updated_at,
        }));

    return NextResponse.json(
        {
            github_username: githubUsername,
            repos,
        },
        { status: 200 }
    );
}
