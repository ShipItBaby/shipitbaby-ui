import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { supabase } from '@/lib/supabase';
import { getSessionWalletFromRequest } from '@/lib/authSession';
import { normalizeSentiment, tallySentimentCounts } from '@/lib/projectSentiment';

function isVotesTableMissing(error) {
    return error?.code === '42P01';
}

async function fetchSentimentCounts(projectId) {
    const { data: voteRows, error: voteRowsError } = await supabase
        .from('project_votes')
        .select('sentiment')
        .eq('project_id', projectId);

    if (voteRowsError) {
        throw voteRowsError;
    }

    return tallySentimentCounts(voteRows || []);
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

    const sentiment = normalizeSentiment(payload?.sentiment);
    if (!sentiment) {
        return NextResponse.json({ error: 'Invalid sentiment' }, { status: 400 });
    }

    const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .eq('token_address', normalizedTokenAddress)
        .maybeSingle();

    if (projectError) {
        console.error('Supabase fetch project for sentiment vote error:', projectError);
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
        .select('id')
        .single();

    if (userError || !user?.id) {
        console.error('Supabase upsert user for sentiment vote error:', userError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const voteUpsertPayload = {
        project_id: project.id,
        user_id: user.id,
        sentiment,
        updated_at: now,
    };

    const { error: upsertError } = await supabase
        .from('project_votes')
        .upsert(voteUpsertPayload, {
            onConflict: 'project_id,user_id',
            ignoreDuplicates: false,
        });

    if (upsertError) {
        if (isVotesTableMissing(upsertError)) {
            return NextResponse.json(
                { error: 'Voting is not initialized. Run sql/project_votes.sql first.' },
                { status: 503 }
            );
        }
        console.error('Supabase upsert sentiment vote error:', upsertError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    try {
        const sentimentCounts = await fetchSentimentCounts(project.id);
        return NextResponse.json(
            {
                user_sentiment: sentiment,
                sentiment_counts: sentimentCounts,
            },
            { status: 200 }
        );
    } catch (countsError) {
        if (isVotesTableMissing(countsError)) {
            return NextResponse.json(
                { error: 'Voting is not initialized. Run sql/project_votes.sql first.' },
                { status: 503 }
            );
        }
        console.error('Supabase fetch sentiment totals after vote error:', countsError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}
