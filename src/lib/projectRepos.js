import { supabase } from '@/lib/supabase';

export async function attachRepositoryToProject({ userId, projectId, repoUrl }) {
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
