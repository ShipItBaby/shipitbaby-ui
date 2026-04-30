import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { supabase } from '@/lib/supabase';
import { getSessionWalletFromRequest } from '@/lib/authSession';
import { normalizeGithubRepoUrl } from '@/lib/githubRepoUrl';
import { attachRepositoryToProject } from '@/lib/projectRepos';
import {
    createEmptySentimentCounts,
    normalizeSentiment,
    tallySentimentCounts,
} from '@/lib/projectSentiment';

async function fetchCurrentUser(wallet) {
    if (!wallet) return null;

    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('wallet', wallet)
        .maybeSingle();

    if (userError) {
        throw userError;
    }

    return user || null;
}

export async function GET(request, { params }) {
    const resolvedParams = await params;
    const tokenAddressParam = typeof resolvedParams?.tokenAddress === 'string'
        ? resolvedParams.tokenAddress
        : '';

    if (!tokenAddressParam) {
        return NextResponse.json({ error: 'tokenAddress is required' }, { status: 400 });
    }

    let normalizedTokenAddress;
    try {
        normalizedTokenAddress = new PublicKey(tokenAddressParam).toBase58();
    } catch {
        return NextResponse.json({ error: 'Invalid token address' }, { status: 400 });
    }

    const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('token_address', normalizedTokenAddress)
        .maybeSingle();

    if (projectError) {
        console.error('Supabase fetch project by token address error:', projectError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    let repo = null;
    let reposError = null;

    const reposByProjectIdQuery = await supabase
        .from('repos')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })
        .limit(1);

    repo = reposByProjectIdQuery.data?.[0] || null;
    reposError = reposByProjectIdQuery.error;

    if (reposError?.code === '42703') {
        const reposByTokenIdQuery = await supabase
            .from('repos')
            .select('*')
            .eq('token_id', project.id)
            .order('created_at', { ascending: false })
            .limit(1);

        repo = reposByTokenIdQuery.data?.[0] || null;
        reposError = reposByTokenIdQuery.error;
    }

    if (reposError) {
        console.error('Supabase fetch repo by project id error:', reposError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    let sentimentCounts = createEmptySentimentCounts();
    let canQueryVotes = true;

    const { data: voteRows, error: voteRowsError } = await supabase
        .from('project_votes')
        .select('sentiment')
        .eq('project_id', project.id);

    if (voteRowsError) {
        if (voteRowsError.code === '42P01') {
            canQueryVotes = false;
        } else {
            console.error('Supabase fetch project sentiment votes error:', voteRowsError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }
    } else {
        sentimentCounts = tallySentimentCounts(voteRows || []);
    }

    let currentUser = null;
    const sessionWallet = getSessionWalletFromRequest(request);
    if (sessionWallet) {
        try {
            currentUser = await fetchCurrentUser(sessionWallet);
        } catch (userError) {
            console.error('Supabase fetch user for project sentiment error:', userError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }
    }

    const canManageProject = Boolean(currentUser?.id && currentUser.id === project.deployer_id);
    let userSentiment = null;
    if (currentUser?.id && canQueryVotes) {
        const { data: userVote, error: userVoteError } = await supabase
            .from('project_votes')
            .select('sentiment')
            .eq('project_id', project.id)
            .eq('user_id', currentUser.id)
            .maybeSingle();

        if (userVoteError) {
            if (userVoteError.code !== '42P01') {
                console.error('Supabase fetch user sentiment vote error:', userVoteError);
                return NextResponse.json({ error: 'Database error' }, { status: 500 });
            }
        }

        userSentiment = normalizeSentiment(userVote?.sentiment);
    }

    return NextResponse.json(
        {
            project,
            repo,
            sentiment_counts: sentimentCounts,
            user_sentiment: userSentiment,
            can_manage_project: canManageProject,
        },
        { status: 200 }
    );
}

export async function PATCH(request, { params }) {
    const sessionWallet = getSessionWalletFromRequest(request);
    if (!sessionWallet) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const resolvedParams = await params;
    const tokenAddressParam = typeof resolvedParams?.tokenAddress === 'string'
        ? resolvedParams.tokenAddress
        : '';

    if (!tokenAddressParam) {
        return NextResponse.json({ error: 'tokenAddress is required' }, { status: 400 });
    }

    let normalizedTokenAddress;
    try {
        normalizedTokenAddress = new PublicKey(tokenAddressParam).toBase58();
    } catch {
        return NextResponse.json({ error: 'Invalid token address' }, { status: 400 });
    }

    let payload;
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    let normalizedRepoUrl;
    try {
        normalizedRepoUrl = normalizeGithubRepoUrl(payload?.repo_url);
    } catch (err) {
        return NextResponse.json({ error: err.message || 'Invalid GitHub repository URL' }, { status: 400 });
    }

    if (!normalizedRepoUrl) {
        return NextResponse.json({ error: 'repo_url is required' }, { status: 400 });
    }

    const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, deployer_id')
        .eq('token_address', normalizedTokenAddress)
        .maybeSingle();

    if (projectError) {
        console.error('Supabase fetch project for repo attach error:', projectError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!project?.id) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    let currentUser = null;
    try {
        currentUser = await fetchCurrentUser(sessionWallet);
    } catch (userError) {
        console.error('Supabase fetch current user for repo attach error:', userError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!currentUser?.id || currentUser.id !== project.deployer_id) {
        return NextResponse.json({ error: 'Only the project owner can link a repository' }, { status: 403 });
    }

    const repoResult = await attachRepositoryToProject({
        userId: currentUser.id,
        projectId: project.id,
        repoUrl: normalizedRepoUrl,
    });

    if (repoResult.error) {
        return NextResponse.json({ error: repoResult.error }, { status: repoResult.status || 500 });
    }

    return NextResponse.json({ repo: repoResult.repo || null }, { status: 200 });
}
