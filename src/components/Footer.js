'use client';

import { XIcon, GithubIcon } from '@/components/icons';

/**
 * Reusable site-wide footer.
 *
 * Props:
 *  @param {string} maxWidth  — Inner content max-width (default: '1100px')
 */
export default function Footer({ maxWidth = '1100px' }) {
  return (
    <footer style={{ borderTop: '1px solid #1e1e30', padding: '24px 32px', background: '#0a0a0f' }}>
      <div
        style={{
          maxWidth,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {/* Brand */}
        <span className="font-pixel" style={{ fontSize: '1.1rem', color: '#475569' }}>
          SHIPIT.BABY
        </span>

        {/* Disclaimer */}
        <span
          className="font-mono"
          style={{
            fontSize: '0.65rem',
            color: '#2d2d40',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          A public build market on Solana · Not financial advice
        </span>

        {/* Right: social + year */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a
            href="https://x.com/shipit_baby"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Follow ShipIt on X"
            style={{
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              transition: 'color 0.18s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#e2e8f0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
          >
            <XIcon size={20} />
          </a>

          <a
            href="https://github.com/ShipItBaby"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="ShipIt on GitHub"
            style={{
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              transition: 'color 0.18s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#e2e8f0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
          >
            <GithubIcon size={20} />
          </a>

          <span className="font-mono" style={{ fontSize: '0.65rem', color: '#2d2d40' }}>
            © 2026
          </span>
        </div>
      </div>
    </footer>
  );
}
