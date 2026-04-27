import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { supabase } from '@/lib/supabase';

const TIMEFRAME_MS = {
    '5m': 5 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000,
    '1m': 30 * 24 * 60 * 60 * 1000,
};
const TRADE_SELECT_FIELDS = [
    'id',
    'project_id',
    'token_mint',
    'bonding_curve',
    'trader',
    'signature',
    'event_index',
    'slot',
    'is_buy',
    'token_amount',
    'sol_amount_gross',
    'sol_amount_net',
    'platform_fee',
    'builder_fee',
    'virtual_token_reserves',
    'virtual_sol_reserves',
    'real_token_reserves',
    'real_sol_reserves',
    'event_timestamp',
    'trade_time',
].join(', ');

function parsePositiveInt(value, fallback) {
    const parsed = Number.parseInt(value || '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
}

function parseTimeframe(value) {
    const normalized = (value || '1h').toLowerCase();
    if (normalized === 'all') return 'all';
    if (Object.prototype.hasOwnProperty.call(TIMEFRAME_MS, normalized)) return normalized;
    return '1d';
}

function isTradesTableMissing(error) {
    return error?.code === '42P01';
}

function sanitizeTradeRow(trade) {
    return {
        id: trade.id,
        project_id: trade.project_id,
        token_mint: trade.token_mint,
        bonding_curve: trade.bonding_curve,
        trader: trade.trader,
        signature: trade.signature,
        event_index: trade.event_index,
        slot: trade.slot,
        is_buy: trade.is_buy,
        token_amount: trade.token_amount,
        sol_amount_gross: trade.sol_amount_gross,
        sol_amount_net: trade.sol_amount_net,
        platform_fee: trade.platform_fee,
        builder_fee: trade.builder_fee,
        virtual_token_reserves: trade.virtual_token_reserves,
        virtual_sol_reserves: trade.virtual_sol_reserves,
        real_token_reserves: trade.real_token_reserves,
        real_sol_reserves: trade.real_sol_reserves,
        event_timestamp: trade.event_timestamp,
        trade_time: trade.trade_time,
    };
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
    const limit = Math.min(parsePositiveInt(searchParams.get('limit'), 500), 1000);
    const timeframe = parseTimeframe(searchParams.get('timeframe'));
    const windowStart = timeframe === 'all'
        ? null
        : new Date(Date.now() - TIMEFRAME_MS[timeframe]).toISOString();

    let tradesQuery = supabase
        .from('trades')
        .select(TRADE_SELECT_FIELDS)
        .eq('token_mint', normalizedTokenAddress);

    if (windowStart) {
        tradesQuery = tradesQuery.gte('trade_time', windowStart);
    }

    const { data: trades, error: tradesError } = await tradesQuery
        .order('trade_time', { ascending: false })
        .order('event_index', { ascending: false })
        .limit(limit);

    if (tradesError) {
        if (isTradesTableMissing(tradesError)) {
            return NextResponse.json(
                { error: 'Trades are not initialized. Run test/sql/trades.sql first.' },
                { status: 503 }
            );
        }
        console.error('Supabase list project trades error:', tradesError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    let previousTrade = null;
    if (windowStart) {
        const { data: previousTrades, error: previousTradeError } = await supabase
            .from('trades')
            .select(TRADE_SELECT_FIELDS)
            .eq('token_mint', normalizedTokenAddress)
            .lt('trade_time', windowStart)
            .order('trade_time', { ascending: false })
            .order('event_index', { ascending: false })
            .limit(1);

        if (previousTradeError) {
            if (isTradesTableMissing(previousTradeError)) {
                return NextResponse.json(
                    { error: 'Trades are not initialized. Run test/sql/trades.sql first.' },
                    { status: 503 }
                );
            }
            console.error('Supabase fetch previous project trade error:', previousTradeError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        previousTrade = previousTrades?.[0] || null;
    }

    const responseTrades = [
        ...(previousTrade ? [previousTrade] : []),
        ...(trades || []).reverse(),
    ];

    return NextResponse.json(
        {
            trades: responseTrades.map(sanitizeTradeRow),
            has_previous_trade: Boolean(previousTrade),
            timeframe,
            window_start: windowStart,
        },
        { status: 200 }
    );
}
