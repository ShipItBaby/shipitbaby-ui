'use client';

import Link from 'next/link';

import Footer from '@/components/Footer';

import { useEffect, useRef, useState } from 'react';


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
      {/* ── HERO ── */}
      <section className="hero-grid" style={{
        maxWidth: 1100, margin: '0 auto', padding: '60px 20px 48px',
        display: 'grid', gap: 40, alignItems: 'center',
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
            Speculate on <span style={{ color: '#06d6a0' }}>execution</span> — commits, demos, milestones, speed.
          </p>
          <p className="font-mono" style={{ fontSize: '0.78rem', color: '#475569', marginBottom: 36 }}>
            Not memes. Not equity. Market attention around building.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>

          </div>

        </div>

        {/* Right: Coming Soon */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start' }}>
          <p className="font-pixel" style={{
            fontSize: 'clamp(3rem, 5.5vw, 5.5rem)',
            lineHeight: 1.05,
            color: '#e2e8f0',
            margin: 0,
          }}>
            Cooking...
          </p>
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


      {/* ── CTA ── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 20px', textAlign: 'center' }}>
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

        </div>
      </section>

      {/* ── FOOTER ── */}
      <Footer />
    </div>
  );
}
