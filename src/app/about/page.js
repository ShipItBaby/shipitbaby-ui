'use client';

import Link from 'next/link';

const NAV_LINKS = ['Launches', 'Builders', 'Challenges'];

// ── Reusable section label ──────────────────────────────────────────────────
function Label({ children }) {
  return (
    <span
      className="font-mono"
      style={{
        color: '#7c5cbf',
        fontSize: '0.75rem',
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        display: 'block',
        marginBottom: 10,
      }}
    >
      // {children}
    </span>
  );
}

// ── Section heading ─────────────────────────────────────────────────────────
function SectionHeading({ children, color = '#e2e8f0' }) {
  return (
    <h2
      className="font-pixel"
      style={{ fontSize: 'clamp(1.4rem, 2.5vw, 2rem)', color, marginBottom: 16, lineHeight: 1.15 }}
    >
      {children}
    </h2>
  );
}

// ── Pill tag ────────────────────────────────────────────────────────────────
function Tag({ children, color = '#7c3aed' }) {
  return (
    <span
      className="font-mono"
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        border: `1px solid ${color}`,
        color,
        fontSize: '0.65rem',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginRight: 6,
        marginBottom: 6,
      }}
    >
      {children}
    </span>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────
function Card({ children, style = {} }) {
  return (
    <div
      style={{
        background: '#13131f',
        border: '1px solid #1e1e30',
        padding: '20px 22px',
        position: 'relative',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Divider ─────────────────────────────────────────────────────────────────
function Divider() {
  return (
    <div
      style={{
        height: 1,
        background: 'repeating-linear-gradient(90deg, #1e1e30 0px, #1e1e30 4px, transparent 4px, transparent 8px)',
        margin: '64px 0',
      }}
    />
  );
}

// ── Small row item ──────────────────────────────────────────────────────────
function Row({ icon, title, desc }) {
  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
      <span style={{ fontSize: '1.1rem', marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <div>
        <div className="font-pixel" style={{ fontSize: '0.95rem', color: '#c4b5fd', marginBottom: 4 }}>
          {title}
        </div>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.65 }}>{desc}</p>
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function About() {
  return (
    <div>About</div>
  );
}
