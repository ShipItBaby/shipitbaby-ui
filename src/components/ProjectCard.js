import Link from 'next/link';

function getStageTagClass(stage) {
    const normalizedStage = (stage || '').toLowerCase();
    if (normalizedStage === 'shipping') return 'tag-green';
    if (normalizedStage === 'proof') return 'tag-yellow';
    if (normalizedStage === 'idea') return 'tag-purple';
    return 'tag';
}

function shortenValue(value, start = 6, end = 4) {
    if (!value || typeof value !== 'string') return '';
    if (value.length <= start + end + 3) return value;
    return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export default function ProjectCard({ project, repo, delay = 0 }) {
    const stageClass = getStageTagClass(project?.stage);
    const commits = Number.isFinite(repo?.total_commits_count) ? repo.total_commits_count : 0;
    const tokenAddress = typeof project?.token_address === 'string' ? project.token_address : '';
    const projectPath = tokenAddress ? `/project/${encodeURIComponent(tokenAddress)}` : null;
    const card = (
        <div className="card" style={{ animationDelay: `${delay}ms`, cursor: projectPath ? 'pointer' : 'default' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span className="font-pixel" style={{ fontSize: '1.3rem', color: '#e2e8f0' }}>
                            {project?.ticker || 'N/A'}
                        </span>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        {project?.short_description || 'No description'}
                    </p>
                </div>
                <span className={`tag ${stageClass}`}>{project?.stage || 'unknown'}</span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <span className="tag tag-purple" style={{ fontSize: '0.62rem' }}>
                    {project?.category || 'uncategorized'}
                </span>
                <span className="tag" style={{ fontSize: '0.62rem', color: '#475569', borderColor: '#1e1e30' }}>
                    {project?.launch_type || 'open'}
                </span>
            </div>

            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #1e1e30', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="font-mono" style={{ fontSize: '0.65rem', color: '#64748b' }}>
                    {commits} commits
                </span>
            </div>
        </div>
    );

    if (!projectPath) {
        return card;
    }

    return (
        <Link
            href={projectPath}
            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            aria-label={`Open project ${project?.ticker || tokenAddress}`}
        >
            {card}
        </Link>
    );
}
