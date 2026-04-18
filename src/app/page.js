'use client';

import BetaSignupCard from '@/components/BetaSignupCard';
import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';
import { isValidEmailInput, sanitizeEmailInput } from '@/lib/email';
import { ensureWalletSession } from '@/lib/walletAuthClient';
import { useEffect, useState } from 'react';

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

// ── Main Landing ─────────────────────────────────────────────────────────────
export default function Home() {
    const [typed, setTyped] = useState('');
    const [isBetaSignupSubmitting, setIsBetaSignupSubmitting] = useState(false);
    const [betaSignupFeedback, setBetaSignupFeedback] = useState('');
    const [betaSignupFeedbackTone, setBetaSignupFeedbackTone] = useState('muted');
    const fullText = 'Trade ideas. Not memes.';

    useEffect(() => {
        let i = 0;
        const iv = setInterval(() => {
            setTyped(fullText.slice(0, ++i));
            if (i >= fullText.length) clearInterval(iv);
        }, 25);
        return () => clearInterval(iv);
    }, []);

    function getConnectedWalletContext() {
        if (typeof window === 'undefined') return null;

        const autoConnect = window.localStorage?.getItem('autoConnect');
        if (autoConnect === 'phantom') {
            const provider = window?.solana;
            const walletAddress = provider?.publicKey?.toString();
            if (provider?.isPhantom && walletAddress) {
                return { provider, walletAddress };
            }
        }

        if (autoConnect === 'solflare') {
            const provider = window?.solflare;
            const walletAddress = provider?.publicKey?.toString();
            if (provider?.isSolflare && walletAddress) {
                return { provider, walletAddress };
            }
        }

        return null;
    }

    async function handleBetaSignupSubmit(email) {
        const sanitizedEmail = sanitizeEmailInput(email);
        if (!isValidEmailInput(sanitizedEmail)) {
            setBetaSignupFeedbackTone('error');
            setBetaSignupFeedback('Enter a valid email address.');
            return false;
        }

        setIsBetaSignupSubmitting(true);
        setBetaSignupFeedback('');
        setBetaSignupFeedbackTone('muted');

        try {
            const connectedWallet = getConnectedWalletContext();
            if (connectedWallet) {
                try {
                    await ensureWalletSession(connectedWallet.provider, connectedWallet.walletAddress);
                } catch {
                    setBetaSignupFeedbackTone('error');
                    setBetaSignupFeedback('Wallet session verification failed. Please reconnect and try again.');
                    return false;
                }
            }

            const response = await fetch('/api/beta-signups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: sanitizedEmail }),
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                setBetaSignupFeedbackTone('error');
                setBetaSignupFeedback(data.error || 'Could not submit email right now.');
                return false;
            }

            setBetaSignupFeedbackTone('success');
            setBetaSignupFeedback(
                data.already_joined
                    ? 'Already on the beta list.'
                    : 'Joined beta. We will email you updates.'
            );
            return true;
        } catch {
            setBetaSignupFeedbackTone('error');
            setBetaSignupFeedback('Could not submit email right now.');
            return false;
        } finally {
            setIsBetaSignupSubmitting(false);
        }
    }

    return (
        <div className="grid-bg scanlines" style={{ minHeight: '100vh', position: 'relative' }}>

            <Navbar />

            {/* ── HERO ── */}
            <section className="hero-grid" style={{
                maxWidth: 1100, margin: '0 auto', padding: '80px var(--section-px) 60px',
                display: 'grid', gap: 40, alignItems: 'center',
            }}>
                {/* Left: Text */}
                <div>
                    <div style={{ marginBottom: 20 }}>
                        <span className="tag tag-green" style={{ marginBottom: 16, display: 'inline-flex' }}>
                            <span className="pulse-dot" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#d61e06' }} />
                            &nbsp;SOON on Solana
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

                    <p style={{ fontSize: '1.1rem', color: '#64748b', lineHeight: 1.7, marginBottom: 16, maxWidth: 440 }}>
                        Builders launch apps as <span style={{ color: '#a78bfa' }}>tradable Solana tokens</span> and ship in public.
                        Users speculate on <span style={{ color: '#06d6a0' }}>execution</span> — commits, demos, milestones, speed.
                    </p>
                    <p className="font-mono" style={{ fontSize: '0.95rem', color: '#475569', marginBottom: 36 }}>
                        Not memes. Not equity. Market attention around building.
                    </p>

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        
                    </div>
                </div>

                {/* Right: Coming Soon */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', width: '100%' }}>
                    <BetaSignupCard
                        onSubmit={handleBetaSignupSubmit}
                        isSubmitting={isBetaSignupSubmitting}
                        feedback={betaSignupFeedback}
                        feedbackTone={betaSignupFeedbackTone}
                    />
                    <p className="font-mono" style={{
                        marginTop: 20,
                        fontSize: '1rem',
                        color: '#64748b',
                        letterSpacing: '0.04em',
                    }}>
                        Follow{' '}
                        <a
                            href="https://x.com/shipit_baby"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#a78bfa', textDecoration: 'none', borderBottom: '1px solid #7c3aed' }}
                        >
                            X
                        </a>
                        {' '}for updates
                    </p>
                </div>
            </section>

            {/* ── PIXEL SEPARATOR ── */}
            <div className="pixel-sep" style={{ maxWidth: 1100, margin: '0 auto 60px', width: '90%' }} />

            {/* ── HOW IT WORKS ── */}
            <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 var(--section-px) 80px' }}>
                <div style={{ textAlign: 'center', marginBottom: 48 }}>
                    <span className="font-mono" style={{ color: '#475569', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            // HOW IT WORKS
                    </span>
                    <h2 className="font-pixel" style={{ fontSize: '2rem', color: '#e2e8f0', marginTop: 8 }}>
                        Simple loop. Real stakes.
                    </h2>
                </div>
                <div className="steps-grid">
                    {STEPS.map((step, i) => (
                        <div key={step.num} className="card" style={{ textAlign: 'center', padding: 32 }}>
                            <div className="font-mono" style={{ fontSize: '0.9rem', color: '#475569', marginBottom: 12, letterSpacing: '0.1em' }}>
                                {step.num}
                            </div>
                            <div style={{ fontSize: '2rem', marginBottom: 12 }}>{step.icon}</div>
                            <h3 className="font-pixel" style={{ fontSize: '1.2rem', color: '#a78bfa', marginBottom: 8 }}>
                                {step.label}
                            </h3>
                            <p style={{ fontSize: '1rem', color: '#64748b', lineHeight: 1.6 }}>{step.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── MATURITY STAGES ── */}
            <section style={{ background: '#0f0f1a', borderTop: '1px solid #1e1e30', borderBottom: '1px solid #1e1e30', padding: '60px var(--section-px)' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 40 }}>
                        <span className="font-mono" style={{ color: '#475569', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              // PROJECT MATURITY
                        </span>
                        <h2 className="font-pixel" style={{ fontSize: '1.8rem', color: '#e2e8f0', marginTop: 8 }}>
                            Ship to unlock stages
                        </h2>
                    </div>
                    <div className="stages-row" style={{ display: 'flex', gap: 0, position: 'relative' }}>
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
                                        marginTop: 10, fontSize: '0.88rem', textTransform: 'uppercase',
                                        color: stage.active ? stage.color : '#475569', letterSpacing: '0.08em',
                                    }}>
                                        {stage.label}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="font-mono" style={{
                        textAlign: 'center', marginTop: 32, fontSize: '0.9rem',
                        color: '#475569', letterSpacing: '0.05em',
                    }}>
                        Projects mature through execution — not just market cap
                    </p>
                </div>
            </section>

            {/* ── FEATURES ── */}
            <section style={{ maxWidth: 1100, margin: '0 auto', padding: '80px var(--section-px)' }}>
                <div style={{ textAlign: 'center', marginBottom: 48 }}>
                    <span className="font-mono" style={{ color: '#475569', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            // WHAT MAKES IT DIFFERENT
                    </span>
                    <h2 className="font-pixel" style={{ fontSize: '1.8rem', color: '#e2e8f0', marginTop: 8 }}>
                        Execution is the meta
                    </h2>
                </div>
                <div className="features-grid">
                    {FEATURES.map((f) => (
                        <div key={f.title} className="card" style={{ padding: '24px 20px' }}>
                            <span className="font-pixel" style={{ fontSize: '1.6rem', color: '#7c3aed', display: 'block', marginBottom: 10 }}>
                                {f.icon}
                            </span>
                            <h3 className="font-pixel" style={{ fontSize: '1.1rem', color: '#e2e8f0', marginBottom: 6 }}>
                                {f.title}
                            </h3>
                            <p style={{ fontSize: '1rem', color: '#64748b', lineHeight: 1.6 }}>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── COMMUNITY SIGNALS ── */}
            <section style={{ background: '#0f0f1a', borderTop: '1px solid #1e1e30', borderBottom: '1px solid #1e1e30', padding: '60px var(--section-px)' }}>
                <div className="community-grid" style={{ maxWidth: 1100, margin: '0 auto' }}>
                    <div>
                        <span className="font-mono" style={{ color: '#475569', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              // COMMUNITY SIGNALS
                        </span>
                        <h2 className="font-pixel" style={{ fontSize: '1.8rem', color: '#e2e8f0', marginTop: 8, marginBottom: 16 }}>
                            React faster than text
                        </h2>
                        <p style={{ fontSize: '1rem', color: '#64748b', lineHeight: 1.7 }}>
                            Quick-fire reactions replace long threads. One tap to signal what the crowd thinks.
                        </p>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {[
                            { label: 'bullish', color: '#06d6a0' },
                            { label: 'shipping', color: '#7c3aed' },
                            { label: 'underrated', color: '#ffd60a' },
                            { label: 'would use', color: '#a78bfa' },
                            { label: 'would pay', color: '#06d6a0' },
                            { label: 'vaporware', color: '#ef4444' },
                            { label: 'dead', color: '#475569' },
                            { label: 'revived', color: '#ffd60a' },
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
                                <span className="font-mono" style={{ fontSize: '0.9rem', color: r.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {r.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <section style={{ maxWidth: 1100, margin: '0 auto', padding: '100px var(--section-px)', textAlign: 'center' }}>
                <span className="font-mono" style={{ color: '#475569', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 16 }}>
          // LAUNCH YOUR APP AS A MARKET
                </span>
                <h2 className="font-pixel" style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', color: '#e2e8f0', marginBottom: 20, lineHeight: 1.1 }}>
                    Ship it.<br />
                    <span style={{ color: '#7c3aed', textShadow: '0 0 30px rgba(124,58,237,0.6)' }}>Let the market watch.</span>
                </h2>
                <p style={{ color: '#64748b', fontSize: '1.05rem', marginBottom: 40, maxWidth: 480, margin: '0 auto 40px' }}>
                    Launch your app as a Solana token. Ship fast. Build reputation. Let traders bet on your execution.
                </p>
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <Footer />
        </div>
    );
}
