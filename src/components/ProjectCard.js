import Link from 'next/link';
import { GithubIcon } from '@/components/icons';
import { getProjectCategoryTagStyle } from '@/lib/projectCategories';

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
    const logoUrl = typeof project?.logo_url === 'string' ? project.logo_url.trim() : '';
    const hasLogo = logoUrl.length > 0;
    const tickerValue = typeof project?.ticker === 'string' ? project.ticker.trim() : '';
    const displayTicker = tickerValue ? (tickerValue.startsWith('$') ? tickerValue : `$${tickerValue}`) : 'N/A';
    const categoryTagStyle = getProjectCategoryTagStyle(project?.category);
    const projectPath = tokenAddress ? `/project/${encodeURIComponent(tokenAddress)}` : null;
    const hasLinkedRepo = typeof repo?.url === 'string' && repo.url.trim().length > 0;
    const launchTypeLabel = typeof project?.launch_type === 'string' ? project.launch_type.trim() : '';
    const showLaunchTypeBadge = launchTypeLabel.length > 0 && launchTypeLabel.toLowerCase() !== 'open';
    const card = (
        <div className="card" style={{ animationDelay: `${delay}ms`, cursor: projectPath ? 'pointer' : 'default' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
                    <div
                        style={{
                            width: 54,
                            height: 54,
                            border: '1px solid #1e1e30',
                            background: '#0f0f1a',
                            flexShrink: 0,
                            overflow: 'hidden',
                        }}
                    >
                        {hasLogo ? (
                            <img
                                src={logoUrl}
                                alt={`${project?.ticker || 'Project'} logo`}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                        ) : null}
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span className="font-pixel" style={{ fontSize: '1.3rem', color: '#22c55e' }}>
                                {displayTicker}
                            </span>
                        </div>
                        <p style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {project?.short_description || 'No description'}
                        </p>
                    </div>
                </div>
                <span className={`tag ${stageClass}`}>{project?.stage || 'unknown'}</span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <span className="tag" style={{ fontSize: '0.62rem', ...categoryTagStyle }}>
                    {project?.category || 'uncategorized'}
                </span>
                {showLaunchTypeBadge && (
                    <span className="tag" style={{ fontSize: '0.62rem', color: '#475569', borderColor: '#1e1e30' }}>
                        {launchTypeLabel}
                    </span>
                )}
            </div>

            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #1e1e30', display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
                <span className="font-mono" style={{ fontSize: '0.65rem', color: '#64748b' }}>
                    {commits} commits
                </span>
                {hasLinkedRepo && (
                    <span
                        className="instant-tooltip"
                        data-tooltip="Verified GitHub repo"
                        aria-label="Verified GitHub repository linked"
                        style={{
                            position: 'absolute',
                            right: 0,
                            top: 8,
                            width: 22,
                            height: 22,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#06d6a0',
                            background: 'rgba(6,214,160,0.1)',
                            border: '1px solid rgba(6,214,160,0.75)',
                            borderRadius: '50%',
                            boxShadow: '0 0 10px rgba(6,214,160,0.25)',
                        }}
                    >
                        <GithubIcon size={13} color="currentColor" />
                    </span>
                )}
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
