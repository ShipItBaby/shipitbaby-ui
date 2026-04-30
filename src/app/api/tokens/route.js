import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { supabase } from '@/lib/supabase';
import { withBeta } from '@/lib/withBeta';
import { getSessionWalletFromRequest } from '@/lib/authSession';
import { normalizeGithubRepoUrl } from '@/lib/githubRepoUrl';
import { normalizeProjectCategory, PROJECT_CATEGORIES } from '@/lib/projectCategories';

function normalizeOptionalText(value, fieldName) {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') {
        throw new Error(`${fieldName} must be a string`);
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

async function attachRepositoryToProject({ userId, projectId, repoUrl }) {
    const { data: existingRepo, error: existingRepoError } = await supabase
        .from('repos')
        .select('id, user_id, project_id, url')
        .eq('url', repoUrl)
        .maybeSingle();

    if (existingRepoError) {
        console.error('Supabase repo lookup error:', existingRepoError);
        return { error: 'Database error', status: 500 };
    }

    if (existingRepo) {
        if (existingRepo.user_id !== userId) {
            return { error: 'Repository is already attached to another account', status: 409 };
        }

        if (existingRepo.project_id && existingRepo.project_id !== projectId) {
            return { error: 'Repository is already attached to another project', status: 409 };
        }

        const { data: updatedRepo, error: updateError } = await supabase
            .from('repos')
            .update({
                project_id: projectId,
                is_tracking_active: true,
            })
            .eq('id', existingRepo.id)
            .select('*')
            .single();

        if (updateError) {
            console.error('Supabase repo update error:', updateError);
            return { error: 'Database error', status: 500 };
        }

        return { repo: updatedRepo };
    }

    const { data: insertedRepo, error: insertError } = await supabase
        .from('repos')
        .insert({
            user_id: userId,
            project_id: projectId,
            url: repoUrl,
            is_tracking_active: true,
        })
        .select('*')
        .single();

    if (insertError) {
        console.error('Supabase repo insert error:', insertError);
        return { error: 'Database error', status: 500 };
    }

    return { repo: insertedRepo };
}

async function handler(request) {
    const wallet = getSessionWalletFromRequest(request);
    if (!wallet) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    let payload;
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const {
        token_address,
        ticker,
        category,
        short_description,
        metadata_link,
        logo_url,
        deployment_tx,
        repo_url,
    } = payload || {};
    if (!token_address || typeof token_address !== 'string') {
        return NextResponse.json({ error: 'token_address is required' }, { status: 400 });
    }
    if (!ticker || typeof ticker !== 'string' || ticker.trim().length === 0) {
        return NextResponse.json({ error: 'ticker is required' }, { status: 400 });
    }
    const hasCategoryInput = typeof category === 'string' && category.trim().length > 0;
    const normalizedCategory = hasCategoryInput ? normalizeProjectCategory(category) : null;
    if (hasCategoryInput && !normalizedCategory) {
        return NextResponse.json(
            { error: `category must be one of: ${PROJECT_CATEGORIES.join(', ')}` },
            { status: 400 }
        );
    }

    let normalizedTokenAddress;
    try {
        normalizedTokenAddress = new PublicKey(token_address).toBase58();
    } catch {
        return NextResponse.json({ error: 'Invalid token address' }, { status: 400 });
    }

    let normalizedShortDescription;
    let normalizedMetadataLink;
    let normalizedLogoUrl;
    let normalizedDeploymentTx;
    let normalizedRepoUrl;
    try {
        normalizedShortDescription = normalizeOptionalText(short_description, 'short_description');
        normalizedMetadataLink = normalizeOptionalText(metadata_link, 'metadata_link');
        normalizedLogoUrl = normalizeOptionalText(logo_url, 'logo_url');
        normalizedDeploymentTx = normalizeOptionalText(deployment_tx, 'deployment_tx');
        normalizedRepoUrl = normalizeGithubRepoUrl(repo_url);
    } catch (err) {
        return NextResponse.json({ error: err.message || 'Invalid payload' }, { status: 400 });
    }

    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('wallet', wallet)
        .single();

    if (userError || !user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const tokenInsertPayload = {
        deployer_id: user.id,
        token_address: normalizedTokenAddress,
        ticker: ticker.trim(),
        category: normalizedCategory,
        stage: 'IDEA',
        short_description: normalizedShortDescription,
        metadata_link: normalizedMetadataLink,
        logo_url: normalizedLogoUrl,
        deployment_tx: normalizedDeploymentTx,
        updated_at: now,
    };

    let tokenRecord;
    let alreadyExists = false;

    const { data: insertedToken, error: insertError } = await supabase
        .from('projects')
        .insert(tokenInsertPayload)
        .select('*')
        .single();

    if (insertError) {
        if (insertError.code === '23505') {
            const { data: existingToken, error: existingTokenError } = await supabase
                .from('projects')
                .select('*')
                .eq('token_address', normalizedTokenAddress)
                .single();

            if (existingTokenError || !existingToken) {
                console.error('Failed to fetch token after unique constraint conflict:', existingTokenError);
                return NextResponse.json({ error: 'Database error' }, { status: 500 });
            }

            if (existingToken.deployer_id !== user.id) {
                return NextResponse.json(
                    { error: 'Token address is already registered by another deployer' },
                    { status: 409 }
                );
            }

            tokenRecord = existingToken;
            alreadyExists = true;
        } else {
            console.error('Supabase token insert error:', insertError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }
    } else {
        tokenRecord = insertedToken;
    }

    let repoRecord = null;
    if (normalizedRepoUrl) {
        const repoResult = await attachRepositoryToProject({
            userId: user.id,
            projectId: tokenRecord.id,
            repoUrl: normalizedRepoUrl,
        });

        if (repoResult.error) {
            return NextResponse.json({ error: repoResult.error }, { status: repoResult.status || 500 });
        }

        repoRecord = repoResult.repo || null;
    }

    const { count, error: countError } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('deployer_id', user.id);

    if (countError || typeof count !== 'number') {
        console.error('Supabase token count error:', countError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const launchedTokensCount = count;
    const hasLaunchedToken = launchedTokensCount > 0;

    const { error: userUpdateError } = await supabase
        .from('users')
        .update({
            launched_tokens_count: launchedTokensCount,
            has_launched_token: hasLaunchedToken,
            last_seen_at: now,
            updated_at: now,
        })
        .eq('id', user.id);

    if (userUpdateError) {
        console.error('Supabase user launch stats update error:', userUpdateError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json(
        {
            token: tokenRecord,
            repo: repoRecord,
            user_stats: {
                launched_tokens_count: launchedTokensCount,
                has_launched_token: hasLaunchedToken,
            },
            already_exists: alreadyExists,
        },
        { status: alreadyExists ? 200 : 201 }
    );
}

export const POST = withBeta(handler);

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const walletQuery = searchParams.get('wallet');
    const sessionWallet = getSessionWalletFromRequest(request);
    const requestedWallet = walletQuery || sessionWallet;

    if (!requestedWallet || typeof requestedWallet !== 'string') {
        return NextResponse.json({ error: 'wallet is required' }, { status: 400 });
    }

    let normalizedWallet;
    try {
        normalizedWallet = new PublicKey(requestedWallet).toBase58();
    } catch {
        return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('wallet', normalizedWallet)
        .single();

    if (userError) {
        if (userError.code === 'PGRST116') {
            return NextResponse.json({ tokens: [] }, { status: 200 });
        }
        console.error('Supabase get user for tokens error:', userError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const { data: tokens, error: tokensError } = await supabase
        .from('projects')
        .select('*')
        .eq('deployer_id', user.id)
        .order('created_at', { ascending: false });

    if (tokensError) {
        console.error('Supabase list tokens error:', tokensError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ tokens: tokens || [] }, { status: 200 });
}
