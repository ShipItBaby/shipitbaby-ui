import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
    SESSION_COOKIE_NAME,
    getSessionWalletFromToken,
} from '@/lib/authSession';

export default async function TokenLayout({ children }) {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const wallet = getSessionWalletFromToken(sessionToken);

    if (!wallet) {
        redirect('/profile');
    }

    const { data: user, error } = await supabase
        .from('users')
        .select('is_beta')
        .eq('wallet', wallet)
        .single();

    if (error || !user || user.is_beta !== true) {
        redirect('/profile');
    }

    return children;
}
