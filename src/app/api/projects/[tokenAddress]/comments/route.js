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

function isCommentsTableMissing(error) {
    return error?.code === '42P01';
}

function sanitizeCommentRow(comment, userById) {
    const user = userById.get(comment.user_id);

    return {
        id: comment.id,
        body: normalizeProjectCommentBody(comment.body),
        created_at: comment.created_at,
        updated_at: comment.updated_at,
        author_wallet: user?.wallet || null,
        author_github_username: user?.github_username || null,
    };
}

async function fetchProjectIdByTokenAddress(normalizedTokenAddress) {
    const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .eq('token_address', normalizedTokenAddress)
        .maybeSingle();

    if (projectError) {
        throw projectError;
    }

    return project?.id || null;
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

    let projectId = null;
    try {
        projectId = await fetchProjectIdByTokenAddress(normalizedTokenAddress);
    } catch (projectError) {
        console.error('Supabase fetch project for comments error:', projectError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!projectId) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { data: comments, error: commentsError } = await supabase
        .from('project_comments')
        .select('id, user_id, body, created_at, updated_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (commentsError) {
        if (isCommentsTableMissing(commentsError)) {
            return NextResponse.json(
                { error: 'Comments are not initialized. Run test/sql/project_comments.sql first.' },
                { status: 503 }
            );
        }
        console.error('Supabase list project comments error:', commentsError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const userIds = Array.from(
        new Set((comments || []).map((comment) => comment.user_id).filter(Boolean))
    );
    const userById = new Map();

    if (userIds.length > 0) {
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, wallet, github_username')
            .in('id', userIds);

        if (usersError) {
            console.error('Supabase fetch users for comments error:', usersError);
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
            comments: (comments || []).map((comment) => sanitizeCommentRow(comment, userById)),
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
    const commentLength = getProjectCommentLength(normalizedBody);
    if (commentLength === 0) {
        return NextResponse.json({ error: 'Comment body is required' }, { status: 400 });
    }
    if (commentLength > PROJECT_COMMENT_MAX_CHARS) {
        return NextResponse.json(
            { error: `Comment body must be at most ${PROJECT_COMMENT_MAX_CHARS} characters` },
            { status: 400 }
        );
    }

    let projectId = null;
    try {
        projectId = await fetchProjectIdByTokenAddress(normalizedTokenAddress);
    } catch (projectError) {
        console.error('Supabase fetch project for comment insert error:', projectError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!projectId) {
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
        console.error('Supabase upsert user for project comment error:', userError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const insertPayload = {
        project_id: projectId,
        user_id: user.id,
        body: normalizedBody,
        updated_at: now,
    };

    const { data: insertedComment, error: insertError } = await supabase
        .from('project_comments')
        .insert(insertPayload)
        .select('id, user_id, body, created_at, updated_at')
        .single();

    if (insertError) {
        if (isCommentsTableMissing(insertError)) {
            return NextResponse.json(
                { error: 'Comments are not initialized. Run test/sql/project_comments.sql first.' },
                { status: 503 }
            );
        }
        console.error('Supabase insert project comment error:', insertError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const userById = new Map([[user.id, user]]);
    return NextResponse.json(
        { comment: sanitizeCommentRow(insertedComment, userById) },
        { status: 201 }
    );
}
