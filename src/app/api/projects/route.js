import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function parsePositiveInt(value, fallback) {
    const parsed = Number.parseInt(value || '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parsePositiveInt(searchParams.get('limit'), 12), 50);
    const isLiveParam = searchParams.get('is_live');
    const onlyLive = isLiveParam === null ? true : isLiveParam === 'true';

    let projectsQuery = supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (onlyLive) {
        projectsQuery = projectsQuery.eq('is_live', true);
    }

    const { data: projects, error: projectsError } = await projectsQuery;
    if (projectsError) {
        console.error('Supabase list projects error:', projectsError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!projects || projects.length === 0) {
        return NextResponse.json({ projects: [] }, { status: 200 });
    }

    const projectIds = projects.map((project) => project.id).filter(Boolean);

    let repos = [];
    let reposError = null;
    let repoForeignKeyColumn = 'project_id';

    const reposByProjectIdQuery = await supabase
        .from('repos')
        .select('*')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false });

    repos = reposByProjectIdQuery.data || [];
    reposError = reposByProjectIdQuery.error;

    if (reposError?.code === '42703') {
        repoForeignKeyColumn = 'token_id';
        const reposByTokenIdQuery = await supabase
            .from('repos')
            .select('*')
            .in('token_id', projectIds)
            .order('created_at', { ascending: false });

        repos = reposByTokenIdQuery.data || [];
        reposError = reposByTokenIdQuery.error;
    }

    if (reposError) {
        console.error('Supabase list repos for projects error:', reposError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const repoByProjectId = new Map();
    for (const repo of repos) {
        const projectId = repo?.[repoForeignKeyColumn] || repo?.project_id || repo?.token_id;
        if (!projectId) continue;
        if (!repoByProjectId.has(projectId)) {
            repoByProjectId.set(projectId, repo);
        }
    }

    const responseRows = projects.map((project) => ({
        project,
        repo: repoByProjectId.get(project.id) || null,
    }));

    return NextResponse.json({ projects: responseRows }, { status: 200 });
}
