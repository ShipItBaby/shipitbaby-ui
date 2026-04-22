'use client';

import Link from 'next/link';
import Footer from '@/components/Footer';
import { useEffect, useRef, useState } from 'react';
import { getProjectCategoryTagStyle } from '@/lib/projectCategories';

// ── Fake token data for demo cards ──────────────────────────────────────────
const TOKENS = [
    {
        name: 'DevDash',
        ticker: '$DASH',
        pitch: 'AI dashboard for devs',
        category: 'Dev Tools',
        stage: 'SHIPPING',
        stageColor: 'tag-green',
        change: '+284%',
        up: true,
        commits: 47,
        bars: [20, 35, 28, 60, 45, 80, 72, 90, 65, 100, 88, 95],
        challenge: '7d',
    },
    {
        name: 'SolBot',
        ticker: '$SBOT',
        pitch: 'Automated Solana trading',
        category: 'Trading',
        stage: 'PROOF',
        stageColor: 'tag-yellow',
        change: '+91%',
        up: true,
        commits: 12,
        bars: [50, 40, 55, 70, 60, 50, 65, 75, 80, 60, 70, 85],
        challenge: '24h',
    },
    {
        name: 'MemeKit',
        ticker: '$MKIT',
        pitch: 'Meme generator on-chain',
        category: 'Fun',
        stage: 'IDEA',
        stageColor: 'tag-purple',
        change: '-12%',
        up: false,
        commits: 3,
        bars: [80, 70, 60, 50, 40, 45, 35, 30, 40, 25, 30, 20],
        challenge: 'open',
    },
];

const TICKER_ITEMS = [
    { ticker: '$DASH', change: '+284%', up: true },
    { ticker: '$SBOT', change: '+91%', up: true },
    { ticker: '$MKIT', change: '-12%', up: false },
    { ticker: '$AIFY', change: '+540%', up: true },
    { ticker: '$DEVX', change: '+72%', up: true },
    { ticker: '$WASM', change: '+118%', up: true },
    { ticker: '$VOID', change: '-38%', up: false },
    { ticker: '$QNIX', change: '+210%', up: true },
];

const STEPS = [
    { num: '01', label: 'Launch your app', desc: 'Create a token for your idea or MVP. Set a build challenge.', icon: '🚀' },
    { num: '02', label: 'Ship in public', desc: 'Connect GitHub or post updates. Milestones unlock maturity stages.', icon: '⚡' },
    { num: '03', label: 'Market reacts', desc: 'Traders speculate on execution speed, commits, demos, and traction.', icon: '📈' },
];

const FEATURES = [
    { icon: '⚙', title: 'GitHub Integration', desc: 'Live commit feed. PRs, releases, and activity all mapped to price.' },
    { icon: '⏱', title: 'Build Challenges', desc: '24h, 7d, 30d timeboxed sprints. Urgency creates stronger markets.' },
    { icon: '◆', title: 'Builder Rep', desc: 'Persistent reputation across launches. Shipped \u003e abandoned.' },
    { icon: '★', title: 'Maturity Stages', desc: 'Idea → Proof → Shipping → Usage → Graduated.' },
    { icon: '🔑', title: 'Token-Gated Access', desc: 'Hold tokens to unlock beta access, premium features, or community.' },
    { icon: '△', title: 'Chart Events', desc: 'Commits, demos, milestones shown as markers on the price chart.' },
];

// ── Mini pixel chart ─────────────────────────────────────────────────────────
function MiniChart({ bars, up }) {
    const color = up ? '#06d6a0' : '#ef4444';
    const maxH = 40;
    const max = Math.max(...bars);
    return (
        <svg width="100%" height={maxH} viewBox={`0 0 ${bars.length * 8} ${maxH}`} preserveAspectRatio="none">
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                points={bars.map((v, i) => `${i * 8 + 4},${maxH - (v / max) * (maxH - 4)}`).join(' ')}
                opacity="0.8"
            />
            {/* Fill area */}
            <polygon
                fill={color}
                fillOpacity="0.1"
                points={[
                    `0,${maxH}`,
                    ...bars.map((v, i) => `${i * 8 + 4},${maxH - (v / max) * (maxH - 4)}`),
                    `${(bars.length - 1) * 8 + 4},${maxH}`,
                ].join(' ')}
            />
        </svg>
    );
}

// ── Token Card ───────────────────────────────────────────────────────────────
function TokenCard({ token, delay = 0 }) {
    const categoryTagStyle = getProjectCategoryTagStyle(token?.category);
    return (
        <div
            className="card"
            style={{ animationDelay: `${delay}ms` }}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span className="font-pixel" style={{ fontSize: '1.3rem', color: '#e2e8f0' }}>{token.name}</span>
                        <span className="font-mono" style={{ fontSize: '0.65rem', color: '#7c3aed' }}>{token.ticker}</span>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: '#64748b' }}>{token.pitch}</p>
                </div>
                <span className={`tag ${token.stageColor}`}>{token.stage}</span>
            </div>

            {/* Chart */}
            <div style={{ marginBottom: 10 }}>
                <MiniChart bars={token.bars} up={token.up} />
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    <span className="tag" style={{ fontSize: '0.62rem', ...categoryTagStyle }}>{token.category}</span>
                    <span className="tag" style={{ fontSize: '0.62rem', color: '#475569', borderColor: '#1e1e30' }}>
                        ⏱ {token.challenge}
                    </span>
                </div>
                <span
                    className="font-mono"
                    style={{
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: token.up ? '#06d6a0' : '#ef4444',
                    }}
                >
                    {token.change}
                </span>
            </div>

            {/* Commit counter */}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #1e1e30', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#475569', fontSize: '0.65rem' }}>⚙</span>
                <span className="font-mono" style={{ fontSize: '0.65rem', color: '#64748b' }}>
                    {token.commits} commits
                </span>
                <span
                    className="pulse-dot"
                    style={{
                        display: 'inline-block',
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: token.up ? '#06d6a0' : '#ef4444',
                        marginLeft: 'auto',
                    }}
                />
                <span className="font-mono" style={{ fontSize: '0.6rem', color: '#475569' }}>LIVE</span>
            </div>
        </div>
    );
}

// ── Main Landing ─────────────────────────────────────────────────────────────
export default function Home() {
    const [typed, setTyped] = useState('');
    const fullText = 'Trade ideas. Not memes.';

    useEffect(() => {
        let i = 0;
        const iv = setInterval(() => {
            setTyped(fullText.slice(0, ++i));
            if (i >= fullText.length) clearInterval(iv);
        }, 25);
        return () => clearInterval(iv);
    }, []);

    return (
        <div className="grid-bg scanlines" style={{ minHeight: '100vh', position: 'relative' }}>

            {/* ── NAV ── */}
            <nav style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 32px', borderBottom: '1px solid #1e1e30',
                background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(10px)',
                position: 'sticky', top: 0, zIndex: 100,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="font-pixel" style={{ fontSize: '1.6rem', color: '#7c3aed', textShadow: '0 0 20px rgba(124,58,237,0.8)' }}>
                        SHIPIT
                    </span>
                    <span style={{
                        fontSize: '0.6rem', fontFamily: 'Share Tech Mono', textTransform: 'uppercase',
                        color: '#475569', letterSpacing: '0.1em', marginTop: 4,
                    }}>
                        beta
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                    {['Launches', 'Builders', 'Challenges'].map(link => (
                        <a
                            key={link}
                            href="#"
                            className="font-mono"
                            style={{ fontSize: '0.78rem', color: '#64748b', textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                            onMouseEnter={e => e.target.style.color = '#e2e8f0'}
                            onMouseLeave={e => e.target.style.color = '#64748b'}
                        >
                            {link}
                        </a>
                    ))}
                    <a
                        href="/about"
                        className="font-mono"
                        style={{ fontSize: '0.78rem', color: '#64748b', textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                        onMouseEnter={e => e.target.style.color = '#a78bfa'}
                        onMouseLeave={e => e.target.style.color = '#64748b'}
                    >
                        How it works
                    </a>
                    <a href="#" className="btn-pixel btn-pixel-primary" style={{ padding: '6px 18px', fontSize: '0.75rem' }}>
                        Launch App →
                    </a>
                </div>
            </nav>

            {/* ── TICKER TAPE ── */}
            <div style={{
                overflow: 'hidden', background: '#0f0f1a', borderBottom: '1px solid #1e1e30',
                padding: '6px 0',
            }}>
                <div className="ticker-track">
                    {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
                        <span key={i} className="font-mono" style={{ padding: '0 24px', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                            <span style={{ color: '#475569' }}>{item.ticker}</span>
                            {' '}
                            <span style={{ color: item.up ? '#06d6a0' : '#ef4444' }}>{item.change}</span>
                            <span style={{ color: '#1e1e30', margin: '0 8px' }}>|</span>
                        </span>
                    ))}
                </div>
            </div>

            {/* ── HERO ── */}
            <section style={{
                maxWidth: 1100, margin: '0 auto', padding: '80px 32px 60px',
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center',
            }}>
                {/* Left: Text */}
                <div>
                    <div style={{ marginBottom: 20 }}>
                        <span className="tag tag-green" style={{ marginBottom: 16, display: 'inline-flex' }}>
                            <span className="pulse-dot" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#06d6a0' }} />
                            &nbsp;Live on Solana
                        </span>
                    </div>

                    <h1 className="font-pixel" style={{
                        fontSize: 'clamp(2.4rem, 4vw, 3.8rem)',
                        lineHeight: 1.1,
                        color: '#e2e8f0',
                        marginBottom: 24,
                    }}>
                        {typed}
                        <span className="blink" style={{ color: '#7c3aed' }}>_</span>
                    </h1>

                    <p style={{ fontSize: '1rem', color: '#64748b', lineHeight: 1.7, marginBottom: 16, maxWidth: 440 }}>
                        Builders launch apps as <span style={{ color: '#a78bfa' }}>tradable Solana tokens</span> and ship in public.
                        Users speculate on <span style={{ color: '#06d6a0' }}>execution</span> — commits, demos, milestones, speed.
                    </p>
                    <p className="font-mono" style={{ fontSize: '0.78rem', color: '#475569', marginBottom: 36 }}>
                        Not memes. Not equity. Market attention around building.
                    </p>

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <a href="#" className="btn-pixel btn-pixel-primary">
                            🚀 Launch a token
                        </a>
                        <a href="#" className="btn-pixel btn-pixel-secondary">
                            Browse launches
                        </a>
                    </div>

                    {/* Stats row */}
                    <div style={{ display: 'flex', gap: 32, marginTop: 48 }}>
                        {[
                            { val: '142', label: 'Apps launched' },
                            { val: '38', label: 'Shipping now' },
                            { val: '9.4K', label: 'Traders' },
                        ].map(s => (
                            <div key={s.label}>
                                <div className="font-pixel" style={{ fontSize: '1.6rem', color: '#7c3aed' }}>{s.val}</div>
                                <div className="font-mono" style={{ fontSize: '0.65rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Token cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {TOKENS.map((token, i) => (
                        <TokenCard key={token.ticker} token={token} delay={i * 120} />
                    ))}
                </div>
            </section>

            {/* ── PIXEL SEPARATOR ── */}
            <div className="pixel-sep" style={{ maxWidth: 1100, margin: '0 auto 60px', width: '90%' }} />

            {/* ── HOW IT WORKS ── */}
            <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px 80px' }}>
                <div style={{ textAlign: 'center', marginBottom: 48 }}>
                    <span className="font-mono" style={{ color: '#475569', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            // HOW IT WORKS
                    </span>
                    <h2 className="font-pixel" style={{ fontSize: '2rem', color: '#e2e8f0', marginTop: 8 }}>
                        Simple loop. Real stakes.
                    </h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                    {STEPS.map((step, i) => (
                        <div key={step.num} className="card" style={{ textAlign: 'center', padding: 32 }}>
                            <div className="font-mono" style={{ fontSize: '0.65rem', color: '#475569', marginBottom: 12, letterSpacing: '0.1em' }}>
                                {step.num}
                            </div>
                            <div style={{ fontSize: '2rem', marginBottom: 12 }}>{step.icon}</div>
                            <h3 className="font-pixel" style={{ fontSize: '1.1rem', color: '#a78bfa', marginBottom: 8 }}>
                                {step.label}
                            </h3>
                            <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6 }}>{step.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── MATURITY STAGES ── */}
            <section style={{ background: '#0f0f1a', borderTop: '1px solid #1e1e30', borderBottom: '1px solid #1e1e30', padding: '60px 32px' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 40 }}>
                        <span className="font-mono" style={{ color: '#475569', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              // PROJECT MATURITY
                        </span>
                        <h2 className="font-pixel" style={{ fontSize: '1.8rem', color: '#e2e8f0', marginTop: 8 }}>
                            Ship to unlock stages
                        </h2>
                    </div>
                    <div style={{ display: 'flex', gap: 0, position: 'relative' }}>
                        {[
                            { num: 1, label: 'Idea', color: '#475569', active: false },
                            { num: 2, label: 'Proof', color: '#7c3aed', active: true },
                            { num: 3, label: 'Shipping', color: '#06d6a0', active: true },
                            { num: 4, label: 'Usage', color: '#ffd60a', active: false },
                            { num: 5, label: 'Graduated', color: '#ef4444', active: false },
                        ].map((stage, i, arr) => (
                            <div key={stage.label} style={{ flex: 1, position: 'relative' }}>
                                {/* Connector */}
                                {i < arr.length - 1 && (
                                    <div style={{
                                        position: 'absolute', top: 20, left: '50%', width: '100%',
                                        height: 2, background: i < 2 ? stage.color : '#1e1e30', zIndex: 0,
                                    }} />
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                                    <div style={{
                                        width: 40, height: 40, border: `2px solid ${stage.color}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: stage.active ? stage.color : '#0a0a0f',
                                        boxShadow: stage.active ? `0 0 16px ${stage.color}66` : 'none',
                                    }}>
                                        <span className="font-pixel" style={{ fontSize: '1rem', color: stage.active ? '#000' : stage.color }}>
                                            {stage.num}
                                        </span>
                                    </div>
                                    <span className="font-mono" style={{
                                        marginTop: 10, fontSize: '0.68rem', textTransform: 'uppercase',
                                        color: stage.active ? stage.color : '#475569', letterSpacing: '0.08em',
                                    }}>
                                        {stage.label}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="font-mono" style={{
                        textAlign: 'center', marginTop: 32, fontSize: '0.72rem',
                        color: '#475569', letterSpacing: '0.05em',
                    }}>
                        Projects mature through execution — not just market cap
                    </p>
                </div>
            </section>

            {/* ── FEATURES ── */}
            <section style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 32px' }}>
                <div style={{ textAlign: 'center', marginBottom: 48 }}>
                    <span className="font-mono" style={{ color: '#475569', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            // WHAT MAKES IT DIFFERENT
                    </span>
                    <h2 className="font-pixel" style={{ fontSize: '1.8rem', color: '#e2e8f0', marginTop: 8 }}>
                        Execution is the meta
                    </h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {FEATURES.map((f) => (
                        <div key={f.title} className="card" style={{ padding: '24px 20px' }}>
                            <span className="font-pixel" style={{ fontSize: '1.6rem', color: '#7c3aed', display: 'block', marginBottom: 10 }}>
                                {f.icon}
                            </span>
                            <h3 className="font-pixel" style={{ fontSize: '0.95rem', color: '#e2e8f0', marginBottom: 6 }}>
                                {f.title}
                            </h3>
                            <p style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.6 }}>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── COMMUNITY SIGNALS ── */}
            <section style={{ background: '#0f0f1a', borderTop: '1px solid #1e1e30', borderBottom: '1px solid #1e1e30', padding: '60px 32px' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
                    <div>
                        <span className="font-mono" style={{ color: '#475569', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              // COMMUNITY SIGNALS
                        </span>
                        <h2 className="font-pixel" style={{ fontSize: '1.8rem', color: '#e2e8f0', marginTop: 8, marginBottom: 16 }}>
                            React faster than text
                        </h2>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.7 }}>
                            Quick-fire reactions replace long threads. One tap to signal what the crowd thinks.
                        </p>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {[
                            { label: 'bullish', color: '#06d6a0', count: '1.2k' },
                            { label: 'shipping', color: '#7c3aed', count: '847' },
                            { label: 'underrated', color: '#ffd60a', count: '632' },
                            { label: 'would use', color: '#a78bfa', count: '501' },
                            { label: 'would pay', color: '#06d6a0', count: '389' },
                            { label: 'vaporware', color: '#ef4444', count: '210' },
                            { label: 'dead', color: '#475569', count: '98' },
                            { label: 'revived', color: '#ffd60a', count: '74' },
                        ].map(r => (
                            <div
                                key={r.label}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 8,
                                    padding: '6px 14px', border: `1px solid ${r.color}33`,
                                    background: `${r.color}08`, cursor: 'pointer',
                                    transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = `${r.color}18`;
                                    e.currentTarget.style.borderColor = r.color;
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = `${r.color}08`;
                                    e.currentTarget.style.borderColor = `${r.color}33`;
                                }}
                            >
                                <span className="font-mono" style={{ fontSize: '0.72rem', color: r.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {r.label}
                                </span>
                                <span className="font-mono" style={{ fontSize: '0.62rem', color: '#475569' }}>{r.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <section style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 32px', textAlign: 'center' }}>
                <span className="font-mono" style={{ color: '#475569', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 16 }}>
          // LAUNCH YOUR APP AS A MARKET
                </span>
                <h2 className="font-pixel" style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', color: '#e2e8f0', marginBottom: 20, lineHeight: 1.1 }}>
                    Ship it.<br />
                    <span style={{ color: '#7c3aed', textShadow: '0 0 30px rgba(124,58,237,0.6)' }}>Let the market watch.</span>
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: 40, maxWidth: 480, margin: '0 auto 40px' }}>
                    Launch your app as a Solana token. Ship fast. Build reputation. Let traders bet on your execution.
                </p>
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <a href="#" className="btn-pixel btn-pixel-primary" style={{ padding: '14px 36px', fontSize: '0.9rem' }}>
                        🚀 Launch your app
                    </a>
                    <a href="#" className="btn-pixel btn-pixel-secondary" style={{ padding: '14px 36px', fontSize: '0.9rem' }}>
                        Browse all launches
                    </a>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <Footer />
        </div>
    );
}
