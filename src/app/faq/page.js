'use client';

import { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

// ── FAQ accordion item ───────────────────────────────────────────────────────
function FAQItem({ question, children, defaultOpen = false }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div style={{ borderBottom: '1px solid #1e1e30' }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    width: '100%', background: 'none', border: 'none',
                    padding: '18px 0', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    gap: 12, textAlign: 'left',
                }}
            >
                <span className="font-pixel" style={{ fontSize: '1.4rem', color: '#e2e8f0', lineHeight: 1.4 }}>{question}</span>
                <span style={{ fontSize: '1rem', color: '#7c3aed', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
            </button>
            {open && (
                <div style={{ paddingBottom: 20, paddingRight: 8 }}>
                    {children}
                </div>
            )}
        </div>
    );
}

// ── FAQ section group ────────────────────────────────────────────────────────
function FAQSection({ label, title, children }) {
    return (
        <div style={{ marginBottom: 52 }}>
            <span className="font-mono" style={{ color: '#7c5cbf', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
                // {label}
            </span>
            <h2 className="font-pixel" style={{ fontSize: 'clamp(1.6rem, 2.5vw, 2.2rem)', color: '#e2e8f0', marginBottom: 20, lineHeight: 1.2 }}>{title}</h2>
            <div style={{ border: '1px solid #1e1e30', background: '#13131f', padding: '0 22px' }}>
                {children}
            </div>
        </div>
    );
}

// ── Answer text ──────────────────────────────────────────────────────────────
function A({ children }) {
    return <p style={{ fontSize: '1.15rem', color: '#94a3b8', lineHeight: 1.75 }}>{children}</p>;
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function FAQ() {
    return (
        <div className="grid-bg" style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e2e8f0' }}>
            <Navbar />

            <div style={{ maxWidth: 740, margin: '0 auto', padding: '72px 32px 100px' }}>

                {/* Header */}
                <span className="font-mono" style={{ color: '#7c5cbf', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 10 }}>
                    // FAQ
                </span>
                <h1 className="font-pixel" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#e2e8f0', lineHeight: 1.1, marginBottom: 16 }}>
                    Frequently Asked Questions
                </h1>
                <p style={{ fontSize: '1.15rem', color: '#94a3b8', lineHeight: 1.75, marginBottom: 64, maxWidth: 560 }}>
                    Everything you need to know about ShipIt — how it works, what it costs, and what builders earn.
                </p>

                {/* ── PLATFORM ── */}
                <FAQSection label="Platform" title="The basics">
                    <FAQItem question="What is ShipIt?">
                        <A>ShipIt is a Solana-based platform where builders launch apps as tradable tokens and ship in public. Traders speculate on execution — not memes. GitHub activity, milestones, and demos create a credible market around real building.</A>
                    </FAQItem>
                    <FAQItem question="Who is it for?">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {[
                                { icon: '🚀', who: 'Builders', desc: 'Launch apps, MVPs, AI tools, bots, or micro-startups. Ship publicly, earn reputation and fees.' },
                                { icon: '📈', who: 'Traders', desc: 'Speculate on idea quality, execution speed, and builder credibility.' },
                                { icon: '👁', who: 'Community', desc: 'Follow launches, discuss progress, and watch builders ship live.' },
                            ].map(p => (
                                <div key={p.who} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{p.icon}</span>
                                    <p style={{ fontSize: '1.15rem', color: '#94a3b8', lineHeight: 1.7 }}>
                                        <span className="font-pixel" style={{ color: '#c4b5fd', marginRight: 6 }}>{p.who}.</span>
                                        {p.desc}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </FAQItem>
                </FAQSection>

                {/* ── FEES ── */}
                <FAQSection label="Fees" title="Fee structure">
                    <FAQItem question="Does it cost anything to launch?">
                        <A>No. Launching is completely free — zero launch fee.</A>
                    </FAQItem>
                    <FAQItem question="What are the trading fees?">
                        <A>Every buy and sell has a fixed <span style={{ color: '#c4b5fd' }}>0.75% trade fee</span>, split as follows:</A>
                        <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
                            <div style={{ flex: 1, padding: '14px 16px', border: '1px solid #7c3aed44', background: '#0a0a0f', textAlign: 'center' }}>
                                <div className="font-pixel" style={{ fontSize: '1.8rem', color: '#7c3aed', marginBottom: 4 }}>0.50%</div>
                                <div className="font-mono" style={{ fontSize: '1.1rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Platform</div>
                            </div>
                            <div style={{ flex: 1, padding: '14px 16px', border: '1px solid #06d6a044', background: '#0a0a0f', textAlign: 'center' }}>
                                <div className="font-pixel" style={{ fontSize: '1.8rem', color: '#06d6a0', marginBottom: 4 }}>0.25%</div>
                                <div className="font-mono" style={{ fontSize: '1.1rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Builder</div>
                            </div>
                        </div>
                    </FAQItem>
                    <FAQItem question="How do builders claim their fees?">
                        <A>Fees accrue on-chain as trading happens — no automatic payouts. Builders claim their earned SOL anytime using the claim instruction. Fees stay claimable even after a project graduates.</A>
                    </FAQItem>
                </FAQSection>

                {/* ── LAUNCHING ── */}
                <FAQSection label="Launching" title="How to launch">
                    <FAQItem question="How do I launch a token?">
                        <A>Connect your wallet, create a token for your app, add at least one proof item (GitHub repo, demo video, screenshot, or live URL), and your token goes live for trading — instantly.</A>
                    </FAQItem>
                    <FAQItem question="What launch formats are available?">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                            <div style={{ padding: '16px 18px', border: '1px solid #06d6a022', background: '#0a0a0f' }}>
                                <div className="font-pixel" style={{ fontSize: '1.3rem', color: '#06d6a0', marginBottom: 10 }}>⏱ Timeboxed Challenges</div>
                                <p style={{ fontSize: '1.15rem', color: '#94a3b8', lineHeight: 1.65 }}>Set a deadline and ship publicly — 24h sprints, 7-day, weekend, or 30-day builds. Urgency drives the market.</p>
                            </div>
                            <div style={{ padding: '16px 18px', border: '1px solid #a78bfa22', background: '#0a0a0f' }}>
                                <div className="font-pixel" style={{ fontSize: '1.3rem', color: '#a78bfa', marginBottom: 10 }}>∞ Open Launches</div>
                                <p style={{ fontSize: '1.15rem', color: '#94a3b8', lineHeight: 1.65 }}>No strict deadline. For projects iterating openly — SaaS, AI tools, lifestyle apps, devtools.</p>
                            </div>
                        </div>
                    </FAQItem>
                    <FAQItem question="Do I need a GitHub repo?">
                        <A>No. GitHub is the strongest trust signal, but any proof works — demo video, screenshot, live URL, or wallet proof. At least one is required to launch.</A>
                    </FAQItem>
                </FAQSection>

                {/* ── GITHUB ── */}
                <FAQSection label="Execution Layer" title="GitHub integration">
                    <FAQItem question="What does GitHub integration do?">
                        <A>Connect a repo and every commit, PR, and release is visible on your token page. Activity maps directly onto the price chart — the strongest trust signal on the platform.</A>
                    </FAQItem>
                    <FAQItem question="What signals are tracked?">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                            {[
                                ['⚙', 'Live commit feed', 'Every push is visible on your token page'],
                                ['🔀', 'PRs & releases', 'Merged PRs and releases marked on chart'],
                                ['✅', 'Milestones completed', 'Verified milestones unlock maturity stages'],
                                ['🖥', 'App URL launched', 'Live product proof — highest trust signal'],
                            ].map(([icon, title, desc]) => (
                                <div key={title} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{icon}</span>
                                    <p style={{ fontSize: '1.15rem', color: '#94a3b8', lineHeight: 1.65 }}>
                                        <span style={{ color: '#c4b5fd', marginRight: 6 }}>{title}.</span>{desc}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </FAQItem>
                </FAQSection>

                {/* ── MATURITY ── */}
                <FAQSection label="Project Maturity" title="Stages & progression">
                    <FAQItem question="What are maturity stages?">
                        <A>Projects progress through 5 stages based on real execution proof — not market cap alone.</A>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
                            {[
                                { num: 1, label: 'Idea', color: '#475569', unlock: 'Token live, trading enabled' },
                                { num: 2, label: 'Proof', color: '#7c3aed', unlock: 'Demo, repo, screenshot, or live URL' },
                                { num: 3, label: 'Shipping', color: '#06d6a0', unlock: 'Commits, releases, or milestone completion' },
                                { num: 4, label: 'Usage', color: '#ffd60a', unlock: 'Users, adoption, or traction proof' },
                                { num: 5, label: 'Graduated', color: '#ef4444', unlock: 'Revenue or sustained traction' },
                            ].map(s => (
                                <div key={s.num} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 16px', background: '#0a0a0f', border: `1px solid ${s.color}22` }}>
                                    <span className="font-pixel" style={{ fontSize: '1.3rem', color: s.color, flexShrink: 0, width: 24 }}>{s.num}</span>
                                    <span className="font-pixel" style={{ fontSize: '1.3rem', color: s.color, width: 130, flexShrink: 0 }}>{s.label}</span>
                                    <span className="font-mono" style={{ fontSize: '1.15rem', color: '#94a3b8' }}>{s.unlock}</span>
                                </div>
                            ))}
                        </div>
                    </FAQItem>
                </FAQSection>

                {/* ── BUILDERS ── */}
                <FAQSection label="Builder Benefits" title="What builders earn">
                    <FAQItem question="What do builders get?">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                            {[
                                { icon: '💸', title: '0.25% of every trade', desc: 'Real SOL income while you build — accrued on-chain and claimable anytime.' },
                                { icon: '◆', title: 'Token allocation', desc: 'A portion of the token supply is reserved for the builder at launch.' },
                                { icon: '👥', title: 'Built-in audience', desc: 'Token holders are your potential users. Attention brings adoption.' },
                                { icon: '🏆', title: 'Reputation & ranking', desc: 'Persistent across launches — built on completions, milestones, and community trust.' },
                            ].map(b => (
                                <div key={b.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>{b.icon}</span>
                                    <div>
                                        <span className="font-pixel" style={{ fontSize: '1.3rem', color: '#e2e8f0', display: 'block', marginBottom: 8 }}>{b.title}</span>
                                        <p style={{ fontSize: '1.15rem', color: '#94a3b8', lineHeight: 1.7 }}>{b.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </FAQItem>
                    <FAQItem question="Can I token-gate my app?">
                        <A>Yes. Use token holdings to gate early access, premium features, Discord community, or feature voting. All optional — the platform provides SDK/API tools to implement it easily.</A>
                    </FAQItem>
                </FAQSection>

                {/* ── CTA ── */}
                <div style={{ textAlign: 'center', paddingTop: 8 }}>
                    <h2 className="font-pixel" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', color: '#e2e8f0', marginBottom: 12, lineHeight: 1.1 }}>
                        Ready to ship?<br />
                        <span style={{ color: '#7c3aed', textShadow: '0 0 30px rgba(124,58,237,0.6)' }}>Let the market watch.</span>
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '1.15rem', marginBottom: 32 }}>
                        Free to launch · 0.75% trade fee · Builder earns 0.25% of every trade
                    </p>
                    <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Link href="/" className="btn-pixel btn-pixel-secondary" style={{ padding: '12px 32px' }}>
                            ← Back to home
                        </Link>
                    </div>
                </div>

            </div>

            <Footer maxWidth="740px" />
        </div>
    );
}
