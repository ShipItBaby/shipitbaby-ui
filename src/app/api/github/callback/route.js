import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const wallet = searchParams.get('state'); // We passed wallet perfectly through state!
    const errorParam = searchParams.get('error');

    if (errorParam) {
        return NextResponse.redirect(new URL('/profile?error=github_auth_failed', request.url));
    }

    if (!code || !wallet) {
        return NextResponse.redirect(new URL('/profile?error=invalid_request', request.url));
    }

    try {
        // 1. Exchange code for access token
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                client_id: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code,
            }),
        });

        const tokenData = await tokenRes.json();
        if (tokenData.error) {
            console.error('GitHub token error:', tokenData);
            return NextResponse.redirect(new URL('/profile?error=github_token_failed', request.url));
        }

        const accessToken = tokenData.access_token;

        // 2. Fetch the user's Github profile exactly as they are currently named
        const userRes = await fetch('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const userData = await userRes.json();
        const githubUsername = userData.login;

        if (!githubUsername) {
            return NextResponse.redirect(new URL('/profile?error=github_no_username', request.url));
        }

        // 3. Save the github username securely to the database using the Service Role
        const { error: dbError } = await supabase
            .from('users')
            .update({ github_username: githubUsername })
            .eq('wallet', wallet);

        if (dbError) {
            console.error('Supabase update error:', dbError);
            return NextResponse.redirect(new URL('/profile?error=db_update_failed', request.url));
        }

        // Everything worked! Bounce them right back to their profile.
        return NextResponse.redirect(new URL('/profile?github_connected=true', request.url));

    } catch (err) {
        console.error('GitHub OAuth callback failed:', err);
        return NextResponse.redirect(new URL('/profile?error=internal_error', request.url));
    }
}
