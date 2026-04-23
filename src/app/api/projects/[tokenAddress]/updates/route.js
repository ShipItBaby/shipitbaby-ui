import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { supabase } from '@/lib/supabase';
import { getSessionWalletFromRequest } from '@/lib/authSession';
import {
    getProjectCommentLength,
    normalizeProjectCommentBody,
    PROJECT_COMMENT_MAX_CHARS,
} from '@/lib/projectComments';

function parsePositiveInt(value, fallback) {
    const parsed = Number.parseInt(value || '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
}

function isProjectUpdatesTableMissing(error) {
    return error?.code === '42P01';
}

function sanitizeUpdateRow(update, userById) {
    const user = userById.get(update.author_id);

    return {
        id: update.id,
        title: update.title,
        body: normalizeProjectCommentBody(update.body),
        created_at: update.created_at,
        updated_at: update.updated_at,
        author_wallet: user?.wallet || null,
        author_github_username: user?.github_username || null,
    };
}

async function fetchProjectByTokenAddress(normalizedTokenAddress) {
    const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, deployer_id')
        .eq('token_address', normalizedTokenAddress)
        .maybeSingle();

    if (projectError) {
        throw projectError;
    }

    return project || null;
}

async function fetchUserByWallet(wallet) {
    if (!wallet) return null;

    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, wallet, github_username')
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

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parsePositiveInt(searchParams.get('limit'), 50), 100);

    let project = null;
    try {
        project = await fetchProjectByTokenAddress(normalizedTokenAddress);
    } catch (projectError) {
        console.error('Supabase fetch project for updates error:', projectError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!project?.id) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const sessionWallet = getSessionWalletFromRequest(request);
    let currentUser = null;
    try {
        currentUser = await fetchUserByWallet(sessionWallet);
    } catch (currentUserError) {
        console.error('Supabase fetch current user for updates error:', currentUserError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const canPostUpdates = Boolean(currentUser?.id && currentUser.id === project.deployer_id);

    const { data: updates, error: updatesError } = await supabase
        .from('project_updates')
        .select('id, author_id, title, body, created_at, updated_at')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (updatesError) {
        if (isProjectUpdatesTableMissing(updatesError)) {
            return NextResponse.json(
                { error: 'Project updates are not initialized. Run test/sql/project_updates.sql first.' },
                { status: 503 }
            );
        }
        console.error('Supabase list project updates error:', updatesError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const authorIds = Array.from(
        new Set((updates || []).map((update) => update.author_id).filter(Boolean))
    );
    const userById = new Map();

    if (authorIds.length > 0) {
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, wallet, github_username')
            .in('id', authorIds);

        if (usersError) {
            console.error('Supabase fetch authors for project updates error:', usersError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        for (const user of users || []) {
            if (user?.id) {
                userById.set(user.id, user);
            }
        }
    }

    return NextResponse.json(
        {
            updates: (updates || []).map((update) => sanitizeUpdateRow(update, userById)),
            can_post_updates: canPostUpdates,
        },
        { status: 200 }
    );
}

export async function POST(request, { params }) {
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

    const normalizedBody = normalizeProjectCommentBody(payload?.body);
    const updateLength = getProjectCommentLength(normalizedBody);
    if (updateLength === 0) {
        return NextResponse.json({ error: 'Update body is required' }, { status: 400 });
    }
    if (updateLength > PROJECT_COMMENT_MAX_CHARS) {
        return NextResponse.json(
            { error: `Update body must be at most ${PROJECT_COMMENT_MAX_CHARS} characters` },
            { status: 400 }
        );
    }

    let project = null;
    try {
        project = await fetchProjectByTokenAddress(normalizedTokenAddress);
    } catch (projectError) {
        console.error('Supabase fetch project for update insert error:', projectError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!project?.id) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const { data: user, error: userError } = await supabase
        .from('users')
        .upsert(
            { wallet: sessionWallet, last_seen_at: now, updated_at: now },
            { onConflict: 'wallet', ignoreDuplicates: false }
        )
        .select('id, wallet, github_username')
        .single();

    if (userError || !user?.id) {
        console.error('Supabase upsert user for project update error:', userError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (user.id !== project.deployer_id) {
        return NextResponse.json({ error: 'Only the project owner can post updates' }, { status: 403 });
    }

    const insertPayload = {
        project_id: project.id,
        author_id: user.id,
        body: normalizedBody,
        updated_at: now,
    };

    const { data: insertedUpdate, error: insertError } = await supabase
        .from('project_updates')
        .insert(insertPayload)
        .select('id, author_id, title, body, created_at, updated_at')
        .single();

    if (insertError) {
        if (isProjectUpdatesTableMissing(insertError)) {
            return NextResponse.json(
                { error: 'Project updates are not initialized. Run test/sql/project_updates.sql first.' },
                { status: 503 }
            );
        }
        console.error('Supabase insert project update error:', insertError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const userById = new Map([[user.id, user]]);
    return NextResponse.json(
        { update: sanitizeUpdateRow(insertedUpdate, userById) },
        { status: 201 }
    );
}
