import { NextResponse } from 'next/server';
import { getSessionWalletFromRequest } from '@/lib/authSession';
import { isValidEmailInput, sanitizeEmailInput } from '@/lib/email';
import { supabase } from '@/lib/supabase';

async function getUserIdBySessionWallet(request) {
    const wallet = getSessionWalletFromRequest(request);
    if (!wallet) return null;

    const { data: existingUser, error: existingUserError } = await supabase
        .from('users')
        .select('id')
        .eq('wallet', wallet)
        .maybeSingle();

    if (existingUserError) {
        console.error('Supabase get user for beta signup error:', existingUserError);
        throw new Error('Database error');
    }

    if (existingUser?.id) return existingUser.id;

    const now = new Date().toISOString();
    const { data: createdUser, error: createUserError } = await supabase
        .from('users')
        .insert({
            wallet,
            last_seen_at: now,
            updated_at: now,
        })
        .select('id')
        .single();

    if (!createUserError && createdUser?.id) {
        return createdUser.id;
    }

    if (createUserError?.code === '23505') {
        const { data: raceWinnerUser, error: raceWinnerUserError } = await supabase
            .from('users')
            .select('id')
            .eq('wallet', wallet)
            .single();

        if (raceWinnerUserError || !raceWinnerUser?.id) {
            console.error('Supabase get user after race conflict error:', raceWinnerUserError);
            throw new Error('Database error');
        }

        return raceWinnerUser.id;
    }

    console.error('Supabase create user for beta signup error:', createUserError);
    throw new Error('Database error');
}

export async function POST(request) {
    let payload;
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const sanitizedEmail = sanitizeEmailInput(payload?.email);
    if (!isValidEmailInput(sanitizedEmail)) {
        return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    let userId = null;
    try {
        userId = await getUserIdBySessionWallet(request);
    } catch (error) {
        return NextResponse.json({ error: error.message || 'Database error' }, { status: 500 });
    }

    const insertPayload = { email: sanitizedEmail };
    if (userId) insertPayload.user_id = userId;

    const { data: insertedSignup, error: insertError } = await supabase
        .from('beta_signups')
        .insert(insertPayload)
        .select('id, email, user_id, created_at')
        .single();

    if (!insertError) {
        return NextResponse.json(
            { ok: true, already_joined: false, signup: insertedSignup },
            { status: 201 }
        );
    }

    if (insertError.code !== '23505') {
        console.error('Supabase beta signup insert error:', insertError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const { data: existingByEmail, error: existingByEmailError } = await supabase
        .from('beta_signups')
        .select('id, email, user_id, created_at')
        .ilike('email', sanitizedEmail)
        .maybeSingle();

    if (existingByEmailError) {
        console.error('Supabase beta signup lookup-by-email error:', existingByEmailError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (existingByEmail) {
        let signup = existingByEmail;

        if (userId && !existingByEmail.user_id) {
            const { data: updatedSignup, error: updateError } = await supabase
                .from('beta_signups')
                .update({ user_id: userId })
                .eq('id', existingByEmail.id)
                .is('user_id', null)
                .select('id, email, user_id, created_at')
                .single();

            if (updateError && updateError.code !== '23505') {
                console.error('Supabase beta signup attach user error:', updateError);
                return NextResponse.json({ error: 'Database error' }, { status: 500 });
            }

            if (updatedSignup) signup = updatedSignup;
        }

        return NextResponse.json(
            { ok: true, already_joined: true, signup },
            { status: 200 }
        );
    }

    if (userId) {
        const { data: existingByUser, error: existingByUserError } = await supabase
            .from('beta_signups')
            .select('id, email, user_id, created_at')
            .eq('user_id', userId)
            .maybeSingle();

        if (existingByUserError) {
            console.error('Supabase beta signup lookup-by-user error:', existingByUserError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        if (existingByUser) {
            return NextResponse.json(
                {
                    error: 'This user already joined beta with another email',
                    already_joined: true,
                    signup: existingByUser,
                },
                { status: 409 }
            );
        }
    }

    return NextResponse.json({ error: 'Database conflict' }, { status: 409 });
}
